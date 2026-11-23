"use client";

import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  ClinicalMediaCategorySchema,
  ClinicalMediaMimeTypeSchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  type AuthenticatedUser,
  type ClinicalMediaCategory,
  type ClinicalMediaMimeType,
  type ClinicalMediaObjectSummary,
  type CreateLabOrderInput,
  type LabOrderSummary,
  type LabUrgency,
  type LocaleCode,
  type PresignedUploadResponse,
} from "@medisync/contracts";
import {
  CheckCircle2,
  Eye,
  FileText,
  FileUp,
  FlaskConical,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import {
  FileUploadDropzone,
  formatByteSize,
  inferUploadMimeType,
} from "@/features/media-certifications";
import {
  formatClinicalFileType,
  formatCountryDisplayName,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityPicker, type EntityOption } from "@/shared/ui/EntityPicker";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { StatStrip, UiBadge, UiButton } from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import { CLINICAL_COPY } from "../clinical-i18n";

interface ClinicalLabsImagingDeskProps {
  currentUser: AuthenticatedUser | null;
  roleFocus?: "DOCTOR" | "LAB_TECH" | undefined;
  selectedCountry: string;
  patientOptions: readonly EntityOption[];
  patientUuid: string;
  onPatientChange: (id: string) => void;
  labFacilityOptions: readonly EntityOption[];
  labFacilityId: string;
  onLabFacilityChange: (id: string) => void;
  labOrders: readonly LabOrderSummary[];
  mediaObjects: readonly ClinicalMediaObjectSummary[];
  latestPresigned: PresignedUploadResponse | null;
  uploadProgress: number | null;
  busy: boolean;
  isPendingStaff: boolean;
  hasSession: boolean;
  onCreateLabOrder: (input: CreateLabOrderInput) => Promise<boolean>;
  onCompleteLabOrder: (orderId: string) => Promise<void>;
  onUploadClinicalFile: (params: {
    file: File;
    mimeType: ClinicalMediaMimeType;
    mediaCategory: ClinicalMediaCategory;
    labOrderId?: string;
  }) => Promise<boolean>;
}

const LAB_ORDER_SETS: ReadonlyArray<{
  id: string;
  labels: Record<LocaleCode, string>;
  panelName: Record<LocaleCode, string>;
  urgency: LabUrgency;
  notes: Record<LocaleCode, string>;
}> = [
  {
    id: "cbc",
    labels: { en: "CBC + CRP + ESR", fr: "NFS + CRP + VS", ar: "تحليل الدم + CRP" },
    panelName: {
      en: "Complete Blood Count (CBC) + CRP + ESR",
      fr: "Numération Formule Sanguine (NFS) + CRP + VS",
      ar: "تعداد الدم الكامل (NFS) + CRP + سرعة الترسب",
    },
    urgency: "ROUTINE",
    notes: {
      en: "Evaluate infection / inflammatory markers",
      fr: "Bilan infectieux et inflammatoire",
      ar: "تقييم مؤشرات العدوى والالتهاب",
    },
  },
  {
    id: "cardio",
    labels: { en: "Cardio Panel", fr: "Bilan Cardiaque", ar: "تحاليل القلب" },
    panelName: {
      en: "High-Sensitivity Troponin + BNP + Lipid Profile",
      fr: "Troponine HS + BNP + Bilan Lipidique",
      ar: "تروبونين عالي الحساسية + BNP + تحليل الدهون",
    },
    urgency: "URGENT",
    notes: {
      en: "Rule out acute coronary syndrome & evaluate cardiac risk",
      fr: "Éliminer un syndrome coronarien aigu et évaluer le risque cardiaque",
      ar: "استبعاد المتلازمة التاجية الحادة وتقييم صحة القلب",
    },
  },
  {
    id: "metabolic",
    labels: { en: "Metabolic + HbA1c", fr: "Glycémie + HbA1c", ar: "السكري + الخزان HbA1c" },
    panelName: {
      en: "Comprehensive Metabolic Panel + Fasting Glucose + HbA1c",
      fr: "Ionogramme complet + Glycémie à jeun + HbA1c",
      ar: "التحاليل الاستقلابية + السكر الصائم + HbA1c",
    },
    urgency: "ROUTINE",
    notes: {
      en: "Glycemic & renal/electrolyte monitoring",
      fr: "Suivi glycémique et ionogramme rénal",
      ar: "متابعة السكري ووظائف الكلى والأملاح",
    },
  },
  {
    id: "thyroid",
    labels: { en: "Thyroid Panel", fr: "Bilan Thyroïdien", ar: "تحاليل الغدة الدرقية" },
    panelName: {
      en: "TSH + Free T4 + Free T3",
      fr: "TSH us + T4 libre + T3 libre",
      ar: "تحاليل الغدة الدرقية TSH + T4 + T3",
    },
    urgency: "ROUTINE",
    notes: {
      en: "Screen thyroid endocrine function",
      fr: "Bilan endocrinien thyroïdien",
      ar: "فحص وظيفة الغدة الدرقية",
    },
  },
  {
    id: "imaging",
    labels: { en: "Chest X-Ray / ECG", fr: "Radio Thorax / ECG", ar: "أشعة الصدر / ECG" },
    panelName: {
      en: "Chest X-Ray (PA/Lateral) + 12-Lead ECG",
      fr: "Radiographie Thoracique (F+P) + ECG 12 dérivations",
      ar: "أشعة الصدر + تخطيط القلب ECG",
    },
    urgency: "URGENT",
    notes: {
      en: "Cardiopulmonary diagnostic imaging",
      fr: "Exploration diagnostique cardio-pulmonaire",
      ar: "تصوير تشخيصي للقلب والرئتين",
    },
  },
  {
    id: "renal-liver",
    labels: { en: "Renal + Liver", fr: "Bilan Rénal + Hépatique", ar: "وظائف الكلى والكبد" },
    panelName: {
      en: "Creatinine/eGFR + AST/ALT + Bilirubin",
      fr: "Créatininémie/DFG + Transaminases (ASAT/ALAT) + Bilirubine",
      ar: "الكرياتينين + إنزيمات الكبد + البيليروبين",
    },
    urgency: "ROUTINE",
    notes: {
      en: "Baseline hepatic & renal safety before therapy",
      fr: "Bilan hépatique et rénal pré-thérapeutique",
      ar: "تقييم سلامة الكلى والكبد قبل العلاج",
    },
  },
];

const MEDIA_CATEGORIES: ReadonlyArray<{
  id: ClinicalMediaCategory;
  labels: Record<LocaleCode, string>;
}> = [
  { id: "RADIOLOGY_SCAN", labels: { en: "Radiology / DICOM", fr: "Radiologie / DICOM", ar: "الأشعة / DICOM" } },
  { id: "LAB_REPORT", labels: { en: "Lab Report PDF", fr: "Compte-rendu Labo PDF", ar: "تقرير المختبر PDF" } },
  { id: "REFERRAL_LETTER", labels: { en: "Referral Letter", fr: "Lettre d'Orientation", ar: "رسالة توجيه طبي" } },
  { id: "DISCHARGE_SUMMARY", labels: { en: "Discharge Summary", fr: "Compte-rendu Sortie", ar: "ملخص الخروج الطبي" } },
  { id: "PRESCRIPTION_SCAN", labels: { en: "Rx Scan", fr: "Scan Ordonnance", ar: "نسخة الوصفة الطبية" } },
  { id: "FHIR_BUNDLE", labels: { en: "FHIR Bundle", fr: "Dossier FHIR", ar: "ملف FHIR" } },
];

function formatLabPriorityLabel(level: LabUrgency, locale: string): string {
  if (level === "EMERGENCY") return "STAT";
  if (level === "URGENT") return locale === "ar" ? "مستعجل" : "Urgent";
  return locale === "ar" ? "عادي" : "Routine";
}

export function ClinicalLabsImagingDesk({
  currentUser,
  roleFocus,
  selectedCountry,
  patientOptions,
  patientUuid,
  onPatientChange,
  labFacilityOptions,
  labFacilityId,
  onLabFacilityChange,
  labOrders,
  mediaObjects,
  latestPresigned,
  uploadProgress,
  busy,
  isPendingStaff,
  hasSession,
  onCreateLabOrder,
  onCompleteLabOrder,
  onUploadClinicalFile,
}: ClinicalLabsImagingDeskProps) {
  const { locale, isRtl, t } = useLocale();
  const c = CLINICAL_COPY[locale] ?? CLINICAL_COPY.en;
  const { openImage } = useImageLightbox();
  void roleFocus;

  const [labPanelName, setLabPanelName] = useState("Complete Blood Count (CBC) + CRP");
  const [labUrgency, setLabUrgency] = useState<LabUrgency>("ROUTINE");
  const [labClinicalNotes, setLabClinicalNotes] = useState("");

  const [orderScope, setOrderScope] = useState<"ALL" | "PATIENT">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const deferredSearch = useDeferredValue(orderSearch);

  // Clinical Media Upload State
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadMime, setUploadMime] = useState<ClinicalMediaMimeType>("application/pdf");
  const [uploadCategory, setUploadCategory] =
    useState<ClinicalMediaCategory>("RADIOLOGY_SCAN");
  const [selectedLabOrderForUpload, setSelectedLabOrderForUpload] = useState("");

  const filteredOrders = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return labOrders.filter((order) => {
      if (orderScope === "PATIENT" && patientUuid && order.patientUserId !== patientUuid) {
        return false;
      }
      if (statusFilter === "PENDING" && order.status === "COMPLETED") return false;
      if (statusFilter === "COMPLETED" && order.status !== "COMPLETED") return false;
      if (needle) {
        const hay =
          `${order.panelName} ${order.patientName} ${order.facilityName} ${order.resultSummary ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [deferredSearch, labOrders, orderScope, patientUuid, statusFilter]);

  async function handleOrderSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientUuid.trim() || !labFacilityId) return;
    const ok = await onCreateLabOrder({
      patientUserId: patientUuid.trim(),
      facilityId: labFacilityId,
      panelName: labPanelName.trim(),
      urgency: labUrgency,
      ...(labClinicalNotes.trim() ? { clinicalNotes: labClinicalNotes.trim() } : {}),
    });
    if (ok) {
      setLabClinicalNotes("");
    }
  }

  async function handleFileUploadSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedUploadFile) return;
    const ok = await onUploadClinicalFile({
      file: selectedUploadFile,
      mimeType: uploadMime,
      mediaCategory: uploadCategory,
      ...(selectedLabOrderForUpload ? { labOrderId: selectedLabOrderForUpload } : {}),
    });
    if (ok) {
      setSelectedUploadFile(null);
    }
  }

  const orderedCount = useMemo(
    () => labOrders.filter((o) => o.status === "ORDERED").length,
    [labOrders],
  );
  const collectedCount = useMemo(
    () => labOrders.filter((o) => o.status === "SAMPLE_COLLECTED").length,
    [labOrders],
  );
  const completedCount = useMemo(
    () => labOrders.filter((o) => o.status === "COMPLETED").length,
    [labOrders],
  );

  const ui =
    locale === "fr"
      ? {
          reqTitle: "Demande d'Analyses & Imagerie",
          notesLabel: "Indication clinique / Notes (Optionnel)",
          notesPlaceholder: "ex. À jeun, recherche infectieuse…",
          searchPlaceholder: "Rechercher analyse ou résultat…",
          filterAll: "Tout",
          filterInProgress: "En cours",
          filterCompleted: "Terminé",
          thisPatient: "Ce patient",
          allPatients: "Tous les patients",
          stages: ["1. Prescrit", "2. Prélèvement", "3. Résultat validé"] as const,
          resultSummary: "Résultat :",
          autoFormat: "Format détecté",
        }
      : locale === "ar"
        ? {
            reqTitle: "طلب التحاليل والأشعة التشخيصية",
            notesLabel: "الدواعي السريرية / ملاحظات (اختياري)",
            notesPlaceholder: "مثال: صيام 12 ساعة، فحص التهاب…",
            searchPlaceholder: "ابحث عن تحليل أو نتيجة…",
            filterAll: "الكل",
            filterInProgress: "قيد الإنجاز",
            filterCompleted: "مكتمل",
            thisPatient: "هذا المريض",
            allPatients: "جميع المرضى",
            stages: ["1. مطلوب", "2. أخذ العينة", "3. النتيجة جاهزة"] as const,
            resultSummary: "النتيجة:",
            autoFormat: "صيغة الملف",
          }
        : {
            reqTitle: "Diagnostic Lab & Radiology Requisition",
            notesLabel: "Clinical Indication / Lab Notes (Optional)",
            notesPlaceholder: "e.g., Fasting sample, rule out infection…",
            searchPlaceholder: "Search panels or results…",
            filterAll: "All",
            filterInProgress: "In Progress",
            filterCompleted: "Completed",
            thisPatient: "This Patient Only",
            allPatients: "All Patients",
            stages: ["1. Ordered", "2. Sample Collected", "3. Result Released"] as const,
            resultSummary: "Result Summary:",
            autoFormat: "Detected Format",
          };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
      <StatStrip
        ariaLabel={c.aside.labMetricsTitle}
        columns={4}
        items={[
          {
            label: c.aside.orderedQueue,
            value: String(orderedCount),
            tone: "neutral",
          },
          {
            label: c.aside.inProcessing,
            value: String(collectedCount),
            tone: "amber",
          },
          {
            label: c.aside.completedPanels,
            value: String(completedCount),
            tone: "emerald",
          },
          {
            label: c.aside.uploadedScans,
            value: String(mediaObjects.length),
            tone: "neutral",
          },
        ]}
      />

      {/* 1. Industrial Diagnostic Requisition & 1-Tap Order Sets */}
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F1FA] pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC]">
              <FlaskConical className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <h2 className="font-editorial text-base font-bold text-[#0F243E]">
              {ui.reqTitle}
            </h2>
          </div>
          <MoroccanComplianceBadge domain="lab" locale={locale} />
        </div>

        {/* 1-Tap Clinical Order Set Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {LAB_ORDER_SETS.map((preset) => {
            const active = labPanelName === preset.panelName[locale];
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setLabPanelName(preset.panelName[locale]);
                  setLabUrgency(preset.urgency);
                  setLabClinicalNotes(preset.notes[locale]);
                }}
                className={`min-h-[30px] rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                  active
                    ? "border-[#0052A3] bg-[#0066CC] text-white"
                    : "border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3] hover:bg-[#0066CC] hover:text-white"
                }`}
              >
                {preset.labels[locale]}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => void handleOrderSubmit(e)}
          className="mt-4 space-y-3.5"
        >
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <EntityPicker
              id="clin-lab-patient"
              label={c.doctorTab.patientLabel}
              placeholder={c.doctorTab.patientPlaceholder}
              emptyLabel={c.doctorTab.patientEmpty}
              options={patientOptions}
              value={patientUuid}
              onChange={onPatientChange}
              disabled={currentUser?.role === "PATIENT"}
            />
            <EntityPicker
              id="clin-lab-facility"
              label={c.labsTab.diagnosticLabLabel}
              placeholder={c.labsTab.diagnosticLabPlaceholder}
              emptyLabel={c.labsTab.diagnosticLabEmpty}
              options={labFacilityOptions}
              value={labFacilityId}
              onChange={onLabFacilityChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#2F4661]">
                {c.labsTab.diagnosticPanelLabel}
              </label>
              <input
                type="text"
                required
                value={labPanelName}
                onChange={(e) => setLabPanelName(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2F4661]">
                {ui.notesLabel}
              </label>
              <input
                type="text"
                value={labClinicalNotes}
                onChange={(e) => setLabClinicalNotes(e.target.value)}
                placeholder={ui.notesPlaceholder}
                className="mt-1 h-10 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:max-w-md sm:flex-1">
              <span className="block text-xs font-semibold text-[#2F4661]">
                {c.labsTab.urgencyLabel}
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["ROUTINE", "URGENT", "EMERGENCY"] as const).map((level) => {
                  const active = labUrgency === level;
                  const tone =
                    level === "EMERGENCY"
                      ? active
                        ? "border-[#DC2626] bg-[#DC2626] text-white"
                        : "border-rose-200 bg-rose-50 text-[#DC2626] hover:bg-rose-100"
                      : level === "URGENT"
                        ? active
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        : active
                          ? "border-[#0052A3] bg-[#0066CC] text-white"
                          : "border-[#D7E4F2] bg-[#F8FBFE] text-[#2F4661] hover:border-[#0066CC]";
                  const label =
                    level === "EMERGENCY"
                      ? "STAT"
                      : level === "URGENT"
                        ? locale === "ar"
                          ? "مستعجل"
                          : "Urgent"
                        : locale === "ar"
                          ? "عادي"
                          : "Routine";
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLabUrgency(level)}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold transition-colors active:scale-95 ${tone}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <UiButton
              type="submit"
              variant="primary"
              disabled={busy || !hasSession || isPendingStaff}
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              <span>{c.labsTab.createOrderBtn}</span>
            </UiButton>
          </div>
        </form>
      </section>

      {/* 2. Live 3-Stage Diagnostic Specimen & Result Pipeline */}
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8F1FA] pb-3">
          <h3 className="font-editorial text-sm font-bold text-[#0F243E]">
            {t("clinical.labsHeading")} ({filteredOrders.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-[#6B829D]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={ui.searchPlaceholder}
                className="h-8 w-44 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] pe-2.5 ps-8 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="inline-flex rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-0.5">
              {(["ALL", "PENDING", "COMPLETED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    statusFilter === st
                      ? "bg-[#0066CC] text-white"
                      : "text-[#4A627D] hover:text-[#0F243E]"
                  }`}
                >
                  {st === "ALL"
                    ? ui.filterAll
                    : st === "PENDING"
                      ? ui.filterInProgress
                      : ui.filterCompleted}
                </button>
              ))}
            </div>
            {patientUuid ? (
              <button
                type="button"
                onClick={() =>
                  setOrderScope((prev) => (prev === "ALL" ? "PATIENT" : "ALL"))
                }
                className={`min-h-[30px] rounded-xl border px-2.5 text-[11px] font-semibold transition-colors ${
                  orderScope === "PATIENT"
                    ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                    : "border-[#D7E4F2] bg-white text-[#4A627D]"
                }`}
              >
                {orderScope === "PATIENT" ? ui.thisPatient : ui.allPatients}
              </button>
            ) : null}
          </div>
        </div>

        {!currentUser ? (
          <p className="mt-3 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-3 text-xs text-[#4A627D]">
            {c.labsTab.signInHint}
          </p>
        ) : filteredOrders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#CBDDF0] bg-[#F8FBFE] p-5 text-center text-xs text-[#556E89]">
            {c.labsTab.noActiveOrders(
              formatCountryDisplayName(selectedCountry, selectedCountry, locale),
            )}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {filteredOrders.map((order) => {
              const stageIdx =
                order.status === "COMPLETED"
                  ? 2
                  : order.status === "SAMPLE_COLLECTED"
                    ? 1
                    : 0;
              return (
                <li
                  key={order.id}
                  className="space-y-3 rounded-2xl border border-[#E8F1FA] bg-[#F8FBFE] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#0F243E]">
                          {order.panelName} ·{" "}
                          <bdi dir="auto">{order.patientName}</bdi>
                        </p>
                        <UiBadge
                          tone={
                            order.urgency === "EMERGENCY"
                              ? "red"
                              : order.urgency === "URGENT"
                                ? "amber"
                                : "teal"
                          }
                        >
                          {formatLabPriorityLabel(order.urgency, locale)}
                        </UiBadge>
                      </div>
                      <p className="mt-0.5 text-[#556E89]">
                        <bdi dir="auto">{order.facilityName}</bdi> ·{" "}
                        <span dir="ltr" className="font-mono-tabular">
                          {order.createdAtIso.slice(0, 10)}
                        </span>
                      </p>
                    </div>

                    {order.status !== "COMPLETED" ? (
                      <UiButton
                        size="sm"
                        variant="primary"
                        disabled={busy || isPendingStaff}
                        onClick={() => void onCompleteLabOrder(order.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{c.labsTab.markCompletedBtn}</span>
                      </UiButton>
                    ) : (
                      <span className="rounded-full bg-[#E6F7F4] px-3 py-1 font-mono-tabular text-[11px] font-bold text-[#0B6B5C]">
                        {c.enums.labStatus.COMPLETED}
                      </span>
                    )}
                  </div>

                  {/* 3-Stage Specimen Progress Pipeline */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {ui.stages.map(
                      (stepLabel, idx) => {
                        const done = idx <= stageIdx;
                        return (
                          <div key={stepLabel} className="space-y-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                done
                                  ? idx === 2
                                    ? "bg-[#0F9D88]"
                                    : "bg-[#0066CC]"
                                  : "bg-[#D7E4F2]"
                              }`}
                            />
                            <p
                              className={`truncate text-[10px] font-semibold ${
                                done ? "text-[#0F243E]" : "text-[#87A0BC]"
                              }`}
                            >
                              {stepLabel}
                            </p>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {order.resultSummary ? (
                    <p className="rounded-xl border border-[#B2E5DC] bg-white px-3 py-2 text-[#0B6B5C]">
                      <strong>{ui.resultSummary}</strong>{" "}
                      <bdi dir="auto">{order.resultSummary}</bdi>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Encrypted Radiology / DICOM / PDF Clinical Media Desk */}
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
        <h3 className="border-b border-[#E8F1FA] pb-3 font-editorial text-sm font-bold text-[#0F243E]">
          {c.labsTab.attachSectionTitle}
        </h3>

        <form
          onSubmit={(e) => void handleFileUploadSubmit(e)}
          className="mt-4 space-y-3.5"
        >
          {/* Visual Document Classification Pills */}
          <div className="flex flex-wrap gap-1.5">
            {MEDIA_CATEGORIES.map((cat) => {
              const active = uploadCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setUploadCategory(ClinicalMediaCategorySchema.parse(cat.id))
                  }
                  className={`min-h-[30px] rounded-full border px-3 text-[11px] font-semibold transition-colors active:scale-95 ${
                    active
                      ? "border-[#0052A3] bg-[#0066CC] text-white"
                      : "border-[#D7E4F2] bg-[#F8FBFE] text-[#4A627D] hover:border-[#0066CC]"
                  }`}
                >
                  {cat.labels[locale]}
                </button>
              );
            })}
          </div>

          <FileUploadDropzone
            id="s3-clinical-file"
            label={c.labsTab.dropzoneLabel}
            hint={c.labsTab.dropzoneHint}
            accept={ALLOWED_MEDIA_MIME_TYPES.join(",")}
            maxBytes={MAX_CLINICAL_UPLOAD_BYTES}
            selectedFile={selectedUploadFile}
            progressPercent={uploadProgress}
            disabled={busy || !hasSession}
            onFileSelected={(file) => {
              setSelectedUploadFile(file);
              if (file) {
                const detected = inferUploadMimeType(file, ALLOWED_MEDIA_MIME_TYPES);
                if (detected) {
                  setUploadMime(ClinicalMediaMimeTypeSchema.parse(detected));
                }
              }
            }}
          />

          <div className="space-y-3">
            {selectedUploadFile ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-1 text-[11px] font-semibold text-[#0052A3]">
                <span>{ui.autoFormat}:</span>
                <span className="font-mono-tabular">
                  {formatClinicalFileType(uploadMime, locale)}
                </span>
              </div>
            ) : null}

            <EntityPicker
              id="s3-lab-order-link"
              label={c.labsTab.linkLabOrderLabel}
              placeholder={ui.searchPlaceholder}
              emptyLabel={c.labsTab.standaloneFileOption}
              value={selectedLabOrderForUpload}
              onChange={setSelectedLabOrderForUpload}
              options={labOrders.map((order) => ({
                id: order.id,
                label: order.panelName,
                sublabel: order.patientName,
              }))}
            />
          </div>

          <UiButton
            type="submit"
            variant="primary"
            disabled={busy || !hasSession || !selectedUploadFile}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            <span>{t("clinical.uploadScanBtn")}</span>
          </UiButton>
        </form>

        {latestPresigned ? (
          <div className="mt-3 rounded-xl border border-[#B2E5DC] bg-[#E6F7F4] p-3 text-xs font-semibold text-[#0B6B5C]">
            {c.labsTab.uploadedSuccessPrefix} {latestPresigned.mediaObject.fileName}
          </div>
        ) : null}

        {mediaObjects.length > 0 ? (
          <div className="mt-5 space-y-2.5 border-t border-[#E8F1FA] pt-4">
            <p className="font-mono-tabular text-xs font-bold text-[#0F243E]">
              {c.labsTab.uploadedFilesTitle(mediaObjects.length)}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {mediaObjects.map((media) => {
                const isImg = media.mimeType.startsWith("image/");
                const localizedStatus =
                  c.enums.uploadStatus[media.uploadStatus] ?? media.uploadStatus;
                const openLightbox = () =>
                  openImage({
                    src: media.downloadUrl,
                    downloadUrl: media.downloadUrl,
                    mimeType: media.mimeType,
                    alt: media.fileName,
                    title: media.fileName,
                    subtitle: c.labsTab.clinicalMediaSubtitle(localizedStatus),
                    specs: [
                      {
                        label: c.labsTab.specFileSize,
                        value: formatByteSize(
                          media.confirmedSizeBytes ?? media.sizeBytes,
                        ),
                      },
                      {
                        label: c.labsTab.specFormat,
                        value: formatClinicalFileType(media.mimeType, locale),
                      },
                      {
                        label: c.labsTab.specStatus,
                        value: localizedStatus,
                      },
                    ],
                  });

                return (
                  <article
                    key={media.id}
                    className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#E8F1FA] bg-[#F8FBFE] p-3 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {isImg && media.uploadStatus === "UPLOADED" ? (
                        <button
                          type="button"
                          onClick={openLightbox}
                          aria-label={c.labsTab.zoomScanAria(media.fileName)}
                          className="h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-[#D7E4F2] bg-white transition hover:border-[#0066CC]"
                        >
                          <img
                            src={media.downloadUrl}
                            alt={media.fileName}
                            className="h-full w-full bg-[#F8FBFE] object-contain p-0.5"
                          />
                        </button>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#0066CC]">
                          {isImg ? (
                            <ImageIcon className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <FileText className="h-5 w-5" aria-hidden="true" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#0F243E]">
                          <bdi dir="auto">{media.fileName}</bdi>
                        </p>
                        <p className="font-mono-tabular text-[11px] text-[#556E89]">
                          {formatByteSize(media.sizeBytes)} ·{" "}
                          <span
                            className={
                              media.uploadStatus === "UPLOADED"
                                ? "font-semibold text-[#0066CC]"
                                : media.uploadStatus === "FAILED"
                                  ? "font-semibold text-[#DC2626]"
                                  : "font-semibold text-amber-700"
                            }
                          >
                            {localizedStatus}
                          </span>
                        </p>
                      </div>
                    </div>

                    {media.uploadStatus === "UPLOADED" ? (
                      <UiButton
                        size="sm"
                        variant="secondary"
                        onClick={openLightbox}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{c.labsTab.previewBtn}</span>
                      </UiButton>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
