"use client";

import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import type {
  AuthenticatedUser,
  CreatePrescriptionInput,
  CreateVisitNoteInput,
  MedicationItem,
  PatientMedicalProfile,
  PrescriptionSummary,
  VisitNoteSummary,
} from "@medisync/contracts";
import {
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  Phone,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
} from "lucide-react";
import {
  detectAllergyConflicts,
  formatRxDurationChip,
  ICD10_QUICK_CHIPS,
  RX_DURATION_PILLS,
  RX_FREQUENCY_PILLS,
  SOAP_TEMPLATES,
} from "@/shared/config/clinical-cds";
import { MOROCCAN_FORMULARY_PRESETS } from "@/shared/config/morocco-standards";
import { formatCountryDisplayName } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { EntityPicker, type EntityOption } from "@/shared/ui/EntityPicker";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import {
  formatPractitionerDisplayName,
  UiBadge,
  UiButton,
  UiSwitch,
} from "@/shared/ui/primitives";
import {
  ClinicalStepper,
  MoroccanComplianceBadge,
} from "@/shared/ui/TactileControls";
import { CLINICAL_COPY } from "../clinical-i18n";

interface ClinicalConsultationDeskProps {
  currentUser: AuthenticatedUser | null;
  selectedCountry: string;
  patientOptions: readonly EntityOption[];
  patientUuid: string;
  onPatientChange: (id: string) => void;
  patientProfile: PatientMedicalProfile | null;
  patientProfileLoading: boolean;
  visitNotes: readonly VisitNoteSummary[];
  prescriptions: readonly PrescriptionSummary[];
  busy: boolean;
  isPendingStaff: boolean;
  hasSession: boolean;
  onSaveVisitNote: (input: CreateVisitNoteInput) => Promise<boolean>;
  onIssuePrescription: (input: CreatePrescriptionInput) => Promise<boolean>;
  onJumpToLabs?: () => void;
}

export function ClinicalConsultationDesk({
  currentUser,
  selectedCountry,
  patientOptions,
  patientUuid,
  onPatientChange,
  patientProfile,
  patientProfileLoading,
  visitNotes,
  prescriptions,
  busy,
  isPendingStaff,
  hasSession,
  onSaveVisitNote,
  onIssuePrescription,
  onJumpToLabs,
}: ClinicalConsultationDeskProps) {
  const { locale, isRtl, t } = useLocale();
  const c = CLINICAL_COPY[locale] ?? CLINICAL_COPY.en;

  // SOAP + Live Vitals State
  const [icd10Input, setIcd10Input] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [tempC, setTempC] = useState("36.8");
  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("78");
  const [heartRate, setHeartRate] = useState("72");
  const [includeVitals, setIncludeVitals] = useState(true);

  // Multi-Drug E-Prescription Builder State
  const [rxQueue, setRxQueue] = useState<MedicationItem[]>([]);
  const [rxMedName, setRxMedName] = useState("Paracetamol");
  const [rxDosage, setRxDosage] = useState("500 mg");
  const [rxFrequency, setRxFrequency] = useState("Twice daily");
  const [rxDurationDays, setRxDurationDays] = useState("5");
  const [rxInstructions, setRxInstructions] = useState("");
  const [rxGeneralNotes, setRxGeneralNotes] = useState("");
  const [overrideAckKey, setOverrideAckKey] = useState("");

  // Patient History Scope & Search
  const [chartScope, setChartScope] = useState<"PATIENT" | "ALL">("PATIENT");
  const [historySearch, setHistorySearch] = useState("");
  const deferredHistorySearch = useDeferredValue(historySearch);

  // Live Vitals Clinical Thresholds (strictly aligned with VisitNoteVitalsSchema; supports FR/MA decimal commas)
  const rawT = Number.parseFloat(tempC.replace(",", "."));
  const rawS = Number.parseFloat(systolic.replace(",", "."));
  const rawD = Number.parseFloat(diastolic.replace(",", "."));
  const rawH = Number.parseFloat(heartRate.replace(",", "."));
  const tVal = Number.isFinite(rawT) ? Number(rawT.toFixed(1)) : Number.NaN;
  const sVal = Number.isFinite(rawS) ? Math.round(rawS) : Number.NaN;
  const dVal = Number.isFinite(rawD) ? Math.round(rawD) : Number.NaN;
  const hVal = Number.isFinite(rawH) ? Math.round(rawH) : Number.NaN;
  const tempState = !Number.isFinite(tVal)
    ? "neutral"
    : tVal >= 38 || tVal < 35.5
      ? "alert"
      : tVal >= 37.5
        ? "warn"
        : "ok";
  const bpState =
    !Number.isFinite(sVal) || !Number.isFinite(dVal)
      ? "neutral"
      : sVal >= 140 || dVal >= 90 || sVal < 90
        ? "alert"
        : sVal >= 130 || dVal >= 85
          ? "warn"
          : "ok";
  const hrState = !Number.isFinite(hVal)
    ? "neutral"
    : hVal > 100 || hVal < 55
      ? "alert"
      : hVal > 90 || hVal < 60
        ? "warn"
        : "ok";

  const activeDraftMed = useMemo<MedicationItem | null>(() => {
    if (!rxMedName.trim() || !rxDosage.trim() || !rxFrequency.trim()) return null;
    return {
      name: rxMedName.trim(),
      dosage: rxDosage.trim(),
      frequency: rxFrequency.trim(),
      durationDays: Math.max(1, Math.min(365, Number(rxDurationDays) || 7)),
      ...(rxInstructions.trim() ? { instructions: rxInstructions.trim() } : {}),
    };
  }, [rxDosage, rxDurationDays, rxFrequency, rxInstructions, rxMedName]);

  const effectiveRxMedications = useMemo<MedicationItem[]>(() => {
    if (rxQueue.length === 0) {
      return activeDraftMed ? [activeDraftMed] : [];
    }
    if (!activeDraftMed) return rxQueue;
    const isDup = rxQueue.some(
      (m) =>
        m.name.toLowerCase() === activeDraftMed.name.toLowerCase() &&
        m.dosage.toLowerCase() === activeDraftMed.dosage.toLowerCase(),
    );
    return isDup ? rxQueue : [...rxQueue, activeDraftMed];
  }, [activeDraftMed, rxQueue]);

  // Real-time Drug-Allergy Cross-Reactivity Check across queued meds + active medication name (even before dosage/frequency are entered)
  const cdsCandidateMeds = useMemo<Array<{ name: string }>>(() => {
    const cleanDraftName = rxMedName.trim();
    if (!cleanDraftName) return rxQueue;
    const alreadyQueued = rxQueue.some(
      (m) => m.name.trim().toLowerCase() === cleanDraftName.toLowerCase(),
    );
    return alreadyQueued ? rxQueue : [...rxQueue, { name: cleanDraftName }];
  }, [rxMedName, rxQueue]);

  const allergyConflicts = useMemo(
    () => detectAllergyConflicts(cdsCandidateMeds, patientProfile, locale),
    [cdsCandidateMeds, patientProfile, locale],
  );
  const conflictSignature = useMemo(
    () =>
      allergyConflicts.length === 0
        ? ""
        : `${patientUuid}|${allergyConflicts
            .map((cf) => `${cf.medName}:${cf.allergen}`)
            .join(",")}`,
    [allergyConflicts, patientUuid],
  );
  const allergyOverrideConfirmed =
    conflictSignature !== "" && overrideAckKey === conflictSignature;

  const activeIcdList = useMemo(
    () =>
      icd10Input
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    [icd10Input],
  );

  function toggleIcdCode(code: string) {
    const upper = code.toUpperCase();
    if (activeIcdList.includes(upper)) {
      setIcd10Input(activeIcdList.filter((x) => x !== upper).join(", "));
    } else {
      setIcd10Input([...activeIcdList, upper].join(", "));
    }
  }

  function handleAddMedToQueue() {
    if (!activeDraftMed) return;
    setRxQueue((prev) => {
      const exists = prev.some(
        (m) =>
          m.name.toLowerCase() === activeDraftMed.name.toLowerCase() &&
          m.dosage.toLowerCase() === activeDraftMed.dosage.toLowerCase(),
      );
      return exists ? prev : [...prev, activeDraftMed];
    });
    setRxMedName("");
    setRxDosage("");
    setRxFrequency("");
    setRxDurationDays("7");
    setRxInstructions("");
  }

  function handleApplyPreset(preset: MedicationItem) {
    setRxMedName(preset.name);
    setRxDosage(preset.dosage);
    setRxFrequency(preset.frequency);
    setRxDurationDays(String(preset.durationDays));
    setRxInstructions(preset.instructions ?? "");
  }

  function handleRenewPrescription(rx: PrescriptionSummary) {
    setRxQueue(rx.medications.map((m) => ({ ...m })));
    setRxGeneralNotes(rx.notes ?? "");
    if (rx.patientUserId && rx.patientUserId !== patientUuid) {
      onPatientChange(rx.patientUserId);
    }
  }

  async function submitSoapNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientUuid.trim()) return;
    const vitalsPayload =
      includeVitals &&
      (Number.isFinite(tVal) ||
        Number.isFinite(sVal) ||
        Number.isFinite(dVal) ||
        Number.isFinite(hVal))
        ? {
            ...(Number.isFinite(tVal) ? { temperatureC: tVal } : {}),
            ...(Number.isFinite(sVal) ? { systolicMmHg: sVal } : {}),
            ...(Number.isFinite(dVal) ? { diastolicMmHg: dVal } : {}),
            ...(Number.isFinite(hVal) ? { heartRateBpm: hVal } : {}),
          }
        : undefined;

    const ok = await onSaveVisitNote({
      patientUserId: patientUuid.trim(),
      icd10Codes: activeIcdList,
      subjective,
      objective,
      assessment,
      plan,
      ...(vitalsPayload ? { vitals: vitalsPayload } : {}),
    });
    if (ok) {
      setIcd10Input("");
      setSubjective("");
      setObjective("");
      setAssessment("");
      setPlan("");
    }
  }

  async function submitPrescription(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientUuid.trim()) return;
    if (allergyConflicts.length > 0 && !allergyOverrideConfirmed) return;
    const meds = effectiveRxMedications;
    if (meds.length === 0) return;

    const ok = await onIssuePrescription({
      patientUserId: patientUuid.trim(),
      medications: meds,
      ...(rxGeneralNotes.trim() ? { notes: rxGeneralNotes.trim() } : {}),
    });
    if (ok) {
      setRxQueue([]);
      setRxMedName("");
      setRxDosage("");
      setRxFrequency("");
      setRxDurationDays("7");
      setRxGeneralNotes("");
      setRxInstructions("");
      setOverrideAckKey("");
    }
  }

  const scopedNotes = useMemo(() => {
    const needle = deferredHistorySearch.trim().toLowerCase();
    return visitNotes.filter((note) => {
      if (chartScope === "PATIENT" && patientUuid && note.patientUserId !== patientUuid) {
        return false;
      }
      if (needle) {
        const hay =
          `${note.patientName} ${note.assessment} ${note.plan} ${note.icd10Codes.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [chartScope, deferredHistorySearch, patientUuid, visitNotes]);

  const scopedPrescriptions = useMemo(() => {
    const needle = deferredHistorySearch.trim().toLowerCase();
    return prescriptions.filter((rx) => {
      if (chartScope === "PATIENT" && patientUuid && rx.patientUserId !== patientUuid) {
        return false;
      }
      if (needle) {
        const medsText = rx.medications.map((m) => m.name).join(" ");
        const hay = `${rx.patientName} ${medsText} ${rx.status}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [chartScope, deferredHistorySearch, patientUuid, prescriptions]);

  const isNurse = currentUser?.role === "NURSE";
  const ui =
    locale === "fr"
      ? {
          blood: "Groupe",
          dob: "Né(e)",
          orderLab: "Prescrire Bilan / Radio",
          printChart: "Imprimer",
          loadingEhr: "Chargement du dossier sécurité patient…",
          allergies: "Allergies :",
          nkda: "Aucune allergie médicamenteuse connue",
          conditions: "Antécédents :",
          activeMeds: "Traitements en cours :",
          nurseHeading: "Soins Infirmiers & Constantes",
          recordVitals: "Inclure les constantes",
          tempLabel: "Température",
          sysLabel: "TA Systolique",
          diaLabel: "TA Diastolique",
          hrLabel: "Fréquence cardiaque",
          clearDraft: "Effacer le brouillon",
          rxTitle: "Ordonnance Électronique QR (Loi 17-04)",
          medReady: (n: number) => `${n} médicament${n > 1 ? "s" : ""}`,
          addMed: "Ajouter à l'ordonnance",
          lineInstrPlaceholder: "Posologie (ex. Pendant les repas)",
          generalNotePlaceholder: "Note pharmacien / substitution DCI (optionnel)",
          filterPlaceholder: "Filtrer notes ou ordonnances…",
          thisPatient: "Ce patient",
          allPatients: (n: number) => `Tous (${n})`,
          renewRx: "Renouveler dans l'ordonnance",
        }
      : locale === "ar"
        ? {
            blood: "فصيلة الدم",
            dob: "الميلاد",
            orderLab: "طلب تحليل / أشعة",
            printChart: "طباعة",
            loadingEhr: "جاري تحميل ملف السلامة للمريض…",
            allergies: "الحساسية:",
            nkda: "لا توجد حساسية دوائية مسجلة",
            conditions: "الأمراض المزمنة:",
            activeMeds: "الأدوية الجارية:",
            nurseHeading: "العناية التمريضية والعلامات الحيوية",
            recordVitals: "تسجيل العلامات الحيوية",
            tempLabel: "الحرارة",
            sysLabel: "الضغط الانقباضي",
            diaLabel: "الضغط الانبساطي",
            hrLabel: "نبض القلب",
            clearDraft: "مسح المسودة",
            rxTitle: "وصفة إلكترونية QR (قانون 17-04)",
            medReady: (n: number) => `${n} دواء جاهز`,
            addMed: "إضافة دواء للوصفة",
            lineInstrPlaceholder: "تعليمات الجرعة (مثال: بعد الأكل)",
            generalNotePlaceholder: "ملاحظة للصيدلي (اختياري)",
            filterPlaceholder: "تصفية الملاحظات أو الوصفات…",
            thisPatient: "هذا المريض",
            allPatients: (n: number) => `الجميع (${n})`,
            renewRx: "تجديد الوصفة",
          }
        : {
            blood: "Blood",
            dob: "DOB",
            orderLab: "Order Lab / Scan",
            printChart: "Print Chart",
            loadingEhr: "Loading patient EHR safety profile…",
            allergies: "Allergies:",
            nkda: "No Known Drug Allergies (NKDA)",
            conditions: "Conditions:",
            activeMeds: "Active Meds:",
            nurseHeading: "Nursing Care & Vitals Charting",
            recordVitals: "Record Vitals",
            tempLabel: "Temp",
            sysLabel: "BP Systolic",
            diaLabel: "BP Diastolic",
            hrLabel: "Heart Rate",
            clearDraft: "Clear draft",
            rxTitle: "QR E-Prescription (Ordonnance)",
            medReady: (n: number) => `${n} ${n === 1 ? "medication" : "medications"} ready`,
            addMed: "Add Medication to Rx",
            lineInstrPlaceholder: "Line dosage instructions (e.g., Take after meals)",
            generalNotePlaceholder: "Pharmacist / Ordonnance notes (optional)",
            filterPlaceholder: "Filter notes or Rx…",
            thisPatient: "This Patient",
            allPatients: (n: number) => `All Patients (${n})`,
            renewRx: "Renew / Load into Rx Builder",
          };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
      {/* 1. Persistent Clinical Patient Banner (Epic / Doctolib Pro Header) */}
      <section className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EBF4FF]/80 via-white to-white p-4 shadow-[0_6px_22px_-12px_rgba(0,102,204,0.14)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <EntityPicker
              id="clin-patient-uuid"
              label={c.doctorTab.patientLabel}
              placeholder={c.doctorTab.patientPlaceholder}
              emptyLabel={c.doctorTab.patientEmpty}
              options={patientOptions}
              value={patientUuid}
              onChange={onPatientChange}
              disabled={currentUser?.role === "PATIENT"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {patientProfile?.bloodType ? (
              <UiBadge tone="teal">
                {ui.blood}: {patientProfile.bloodType}
              </UiBadge>
            ) : null}
            {patientProfile?.dateOfBirth ? (
              <span
                dir="ltr"
                className="rounded-full border border-[#D7E4F2] bg-white px-2.5 py-1 font-mono-tabular text-[11px] font-semibold text-[#2F4661]"
              >
                {ui.dob}: {patientProfile.dateOfBirth}
              </span>
            ) : null}
            {patientProfile?.emergencyContactPhone ? (
              <a
                href={`tel:${patientProfile.emergencyContactPhone}`}
                dir="ltr"
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] transition-colors hover:border-[#0066CC] hover:text-[#0066CC]"
              >
                <Phone className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>ICE: {patientProfile.emergencyContactPhone}</span>
              </a>
            ) : null}
            {onJumpToLabs ? (
              <UiButton
                size="sm"
                variant="secondary"
                onClick={onJumpToLabs}
              >
                <FlaskConical className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{ui.orderLab}</span>
              </UiButton>
            ) : null}
            <UiButton
              size="sm"
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
              className="bg-white"
            >
              <Printer className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
              <span>{ui.printChart}</span>
            </UiButton>
          </div>
        </div>

        {/* High-Visibility Patient Allergy & Chronic Context Bar */}
        {patientProfileLoading ? (
          <p className="mt-3 text-xs text-[#6B829D]">{ui.loadingEhr}</p>
        ) : patientProfile ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#D7E4F2]/70 pt-3 text-xs">
            {patientProfile.allergies.length > 0 ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 font-bold text-rose-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                <span>
                  {ui.allergies}{" "}
                  {patientProfile.allergies
                    .map((a) => `${a.allergen} (${a.severity})`)
                    .join(", ")}
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#B2E5DC] bg-[#E6F7F4] px-3 py-1.5 font-semibold text-[#0B6B5C]">
                {ui.nkda}
              </span>
            )}
            {patientProfile.chronicConditions.length > 0 ? (
              <span className="rounded-xl border border-[#D7E4F2] bg-white px-3 py-1.5 text-[#2F4661]">
                <strong className="text-[#0F243E]">{ui.conditions}</strong>{" "}
                {patientProfile.chronicConditions.join(", ")}
              </span>
            ) : null}
            {patientProfile.currentMedications.length > 0 ? (
              <span className="rounded-xl border border-[#D7E4F2] bg-white px-3 py-1.5 text-[#2F4661]">
                <strong className="text-[#0F243E]">{ui.activeMeds}</strong>{" "}
                {patientProfile.currentMedications.join(", ")}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* 2. Clinical Encounter Editor: Live Vitals + SOAP Note + ICD-10 Chips */}
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8F1FA] pb-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC]">
              <Stethoscope className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <h2 className="font-editorial text-base font-bold text-[#0F243E]">
              {isNurse ? ui.nurseHeading : c.doctorTab.heading}
            </h2>
            <MoroccanComplianceBadge
              domain={isNurse ? "nurse" : "doctor"}
              locale={locale}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {SOAP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setIcd10Input(tpl.icd);
                  setSubjective(tpl.s[locale]);
                  setObjective(tpl.o[locale]);
                  setAssessment(tpl.a[locale]);
                  setPlan(tpl.p[locale]);
                  setTempC(tpl.vitals.temp);
                  setSystolic(tpl.vitals.sys);
                  setDiastolic(tpl.vitals.dia);
                  setHeartRate(tpl.vitals.hr);
                  setIncludeVitals(true);
                }}
                className="min-h-[30px] rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#0052A3] transition-colors hover:bg-[#0066CC] hover:text-white active:scale-95"
              >
                {tpl.labels[locale]}
              </button>
            ))}
          </div>
        </div>

        {/* Live Color-Coded Clinical Vitals Bar with Tactile Steppers */}
        <div className="mt-4 space-y-2.5">
          <UiSwitch
            checked={includeVitals}
            onChange={setIncludeVitals}
            label={ui.recordVitals}
          />

          {includeVitals ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <ClinicalStepper
                id="clin-vital-temp"
                label={ui.tempLabel}
                value={tempC}
                onChange={setTempC}
                step={0.1}
                min={30}
                max={45}
                decimals={1}
                unit="°C"
                tone={tempState === "alert" ? "alert" : "default"}
                presets={[
                  { label: "36.6", value: "36.6" },
                  { label: "37.2", value: "37.2" },
                  { label: "38.5", value: "38.5" },
                ]}
              />
              <ClinicalStepper
                id="clin-vital-sys"
                label={ui.sysLabel}
                value={systolic}
                onChange={setSystolic}
                step={5}
                min={40}
                max={300}
                unit="mmHg"
                tone={bpState === "alert" ? "alert" : "default"}
                presets={[
                  { label: "115", value: "115" },
                  { label: "120", value: "120" },
                  { label: "145", value: "145" },
                ]}
              />
              <ClinicalStepper
                id="clin-vital-dia"
                label={ui.diaLabel}
                value={diastolic}
                onChange={setDiastolic}
                step={5}
                min={20}
                max={200}
                unit="mmHg"
                tone={bpState === "alert" ? "alert" : "default"}
                presets={[
                  { label: "75", value: "75" },
                  { label: "80", value: "80" },
                  { label: "95", value: "95" },
                ]}
              />
              <ClinicalStepper
                id="clin-vital-hr"
                label={ui.hrLabel}
                value={heartRate}
                onChange={setHeartRate}
                step={2}
                min={20}
                max={260}
                unit="bpm"
                tone={hrState === "alert" ? "alert" : "default"}
                presets={[
                  { label: "68", value: "68" },
                  { label: "76", value: "76" },
                  { label: "98", value: "98" },
                ]}
              />
            </div>
          ) : null}
        </div>

        {/* ICD-10 Coding Field + Clickable Diagnostic Code Chips */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <label
                htmlFor="clin-icd10"
                className="block text-xs font-semibold text-[#2F4661]"
              >
                {c.doctorTab.icd10Label}
              </label>
              <input
                id="clin-icd10"
                type="text"
                dir="ltr"
                value={icd10Input}
                onChange={(e) => setIcd10Input(e.target.value)}
                placeholder="I10, E11.9"
                className="mt-1 h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 font-mono-tabular text-xs font-semibold text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {ICD10_QUICK_CHIPS.map((chip) => {
                const selected = activeIcdList.includes(chip.code);
                return (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => toggleIcdCode(chip.code)}
                    className={`min-h-[28px] rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors active:scale-95 ${
                      selected
                        ? "border-[#0052A3] bg-[#0066CC] text-white"
                        : "border-[#D7E4F2] bg-[#F8FBFE] text-[#4A627D] hover:border-[#0066CC] hover:text-[#0066CC]"
                    }`}
                  >
                    <span dir="ltr" className="font-mono-tabular font-bold">
                      {chip.code}
                    </span>{" "}
                    · {chip.labels[locale]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SOAP Clinical Form */}
        <form
          onSubmit={(e) => void submitSoapNote(e)}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="clin-soap-subjective" className="block text-xs font-semibold text-[#2F4661]">
              {c.doctorTab.subjectiveLabel}
            </label>
            <textarea
              id="clin-soap-subjective"
              rows={2}
              required
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              placeholder={c.doctorTab.subjectivePlaceholder}
              className="mt-1 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 py-2 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="clin-soap-objective" className="block text-xs font-semibold text-[#2F4661]">
              {c.doctorTab.objectiveLabel}
            </label>
            <textarea
              id="clin-soap-objective"
              rows={2}
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={c.doctorTab.objectivePlaceholder}
              className="mt-1 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 py-2 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="clin-soap-assessment" className="block text-xs font-semibold text-[#2F4661]">
              {c.doctorTab.assessmentLabel}
            </label>
            <textarea
              id="clin-soap-assessment"
              rows={2}
              required
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder={c.doctorTab.assessmentPlaceholder}
              className="mt-1 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 py-2 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="clin-soap-plan" className="block text-xs font-semibold text-[#2F4661]">
              {c.doctorTab.planLabel}
            </label>
            <textarea
              id="clin-soap-plan"
              rows={2}
              required
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder={c.doctorTab.planPlaceholder}
              className="mt-1 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 py-2 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-2">
            <UiButton
              type="submit"
              variant="primary"
              disabled={busy || !hasSession || isPendingStaff}
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              <span>{t("clinical.saveNote")}</span>
            </UiButton>
            {(icd10Input || subjective || objective || assessment || plan) ? (
              <button
                type="button"
                onClick={() => {
                  setIcd10Input("");
                  setSubjective("");
                  setObjective("");
                  setAssessment("");
                  setPlan("");
                }}
                className="text-xs font-semibold text-[#6B829D] hover:text-[#0F243E]"
              >
                {ui.clearDraft}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {/* 3. Industrial Multi-Drug QR E-Prescription Builder (with Real-Time Allergy CDS) */}
      {!isNurse ? (
        <section className="rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F1FA] pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E6F7F4] text-[#0F9D88]">
                <Pill className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <h3 className="font-editorial text-base font-bold text-[#0F243E]">
                {ui.rxTitle}
              </h3>
            </div>
            <span className="rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-3 py-1 font-mono-tabular text-xs font-bold text-[#0B6B5C]">
              {ui.medReady(effectiveRxMedications.length)}
            </span>
          </div>

          {/* Real-Time Clinical Decision Support (CDS): Drug-Allergy Conflict Warning */}
          {allergyConflicts.length > 0 ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border-2 border-[#DC2626] bg-rose-50 p-3.5 text-xs text-rose-950"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#DC2626]"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <p className="font-bold text-[#DC2626]">
                    {locale === "fr"
                      ? "ALERTE SÉCURITÉ CLINIQUE — Contre-indication allergique potentielle"
                      : locale === "ar"
                        ? "تحذير السلامة السريرية — تعارض محتمل مع حساسية مسجلة"
                        : "CLINICAL SAFETY WARNING — Potential Allergy Contraindication"}
                  </p>
                  <ul className="space-y-0.5">
                    {allergyConflicts.map((cf, i) => (
                      <li key={`${cf.medName}-${cf.allergen}-${i}`}>
                        <strong>{cf.medName}</strong>{" "}
                        {locale === "fr"
                          ? "entre en conflit avec"
                          : locale === "ar"
                            ? "يتعارض مع"
                            : "conflicts with documented"}{" "}
                        <strong>
                          {cf.allergen} ({cf.severity})
                        </strong>{" "}
                        — {cf.reason}.
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <UiSwitch
                      checked={allergyOverrideConfirmed}
                      onChange={(checked) =>
                        setOverrideAckKey(checked ? conflictSignature : "")
                      }
                      label={
                        locale === "fr"
                          ? "J'ai vérifié cette contre-indication allergique et je confirme la dérogation clinique"
                          : locale === "ar"
                            ? "راجعت هذا التعارض التحسسي وأؤكد التجاوز السريري تحت مسؤوليتي الطبية"
                            : "I have reviewed this allergy contraindication and clinically confirm override"
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Moroccan Formulary Quick Presets (Law 17-04 DCI) */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {MOROCCAN_FORMULARY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  handleApplyPreset({
                    name: preset.medication,
                    dosage: preset.dosage,
                    frequency: preset.frequency,
                    durationDays: preset.durationDays,
                    instructions: preset.note,
                  })
                }
                className="min-h-[30px] rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-1 text-[11px] font-semibold text-[#0B6B5C] transition-colors hover:bg-[#0F9D88] hover:text-white active:scale-95"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Queued Multi-Drug Lines */}
          {rxQueue.length > 0 ? (
            <ul className="mt-3 space-y-2 rounded-2xl border border-[#D7E4F2] bg-[#F8FBFE] p-3">
              {rxQueue.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8F1FA] bg-white px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0F243E]">
                      {idx + 1}. {item.name}{" "}
                      <span className="font-mono-tabular text-[#0066CC]">
                        {item.dosage}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#556E89]">
                      {item.frequency} · {item.durationDays}{" "}
                      {locale === "fr" ? "jours" : locale === "ar" ? "أيام" : "days"}
                      {item.instructions ? ` · ${item.instructions}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      setRxQueue((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#DC2626] transition-colors hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <form
            onSubmit={(e) => void submitPrescription(e)}
            className="mt-4 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label htmlFor="clin-rx-med" className="block text-xs font-semibold text-[#2F4661]">
                  {c.doctorTab.medicationLabel}
                </label>
                <input
                  id="clin-rx-med"
                  type="text"
                  required={rxQueue.length === 0}
                  value={rxMedName}
                  onChange={(e) => setRxMedName(e.target.value)}
                  placeholder="e.g., Amlodipine"
                  className="mt-1 h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="clin-rx-dosage" className="block text-xs font-semibold text-[#2F4661]">
                  {c.doctorTab.dosageLabel}
                </label>
                <input
                  id="clin-rx-dosage"
                  type="text"
                  required={rxQueue.length === 0}
                  value={rxDosage}
                  onChange={(e) => setRxDosage(e.target.value)}
                  placeholder="5 mg"
                  className="mt-1 h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="clin-rx-frequency" className="block text-xs font-semibold text-[#2F4661]">
                  {c.doctorTab.frequencyLabel}
                </label>
                <input
                  id="clin-rx-frequency"
                  type="text"
                  required={rxQueue.length === 0}
                  value={rxFrequency}
                  onChange={(e) => setRxFrequency(e.target.value)}
                  placeholder="Once daily"
                  className="mt-1 h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {RX_FREQUENCY_PILLS[locale].map((fp) => (
                    <button
                      key={fp.label}
                      type="button"
                      onClick={() => setRxFrequency(fp.value)}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                        rxFrequency === fp.value
                          ? "bg-[#0066CC] text-white"
                          : "bg-[#F3F8FD] text-[#4A627D] hover:text-[#0066CC]"
                      }`}
                    >
                      {fp.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2F4661]">
                  {c.doctorTab.daysLabel}
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {RX_DURATION_PILLS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setRxDurationDays(String(days))}
                      className={`h-9 min-w-[34px] rounded-lg border px-2 font-mono-tabular text-[11px] font-bold transition ${
                        rxDurationDays === String(days)
                          ? "border-[#0066CC] bg-[#0066CC] text-white"
                          : "border-[#D7E4F2] bg-[#F8FBFE] text-[#2F4661] hover:border-[#0066CC]"
                      }`}
                    >
                      {formatRxDurationChip(days, locale)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={rxInstructions}
                onChange={(e) => setRxInstructions(e.target.value)}
                placeholder={ui.lineInstrPlaceholder}
                className="h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                value={rxGeneralNotes}
                onChange={(e) => setRxGeneralNotes(e.target.value)}
                placeholder={ui.generalNotePlaceholder}
                className="h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <UiButton
                type="button"
                size="sm"
                variant="outline"
                disabled={!activeDraftMed}
                onClick={handleAddMedToQueue}
              >
                <Plus className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{ui.addMed}</span>
              </UiButton>

              <UiButton
                type="submit"
                variant="primary"
                disabled={
                  busy ||
                  !hasSession ||
                  isPendingStaff ||
                  effectiveRxMedications.length === 0 ||
                  (allergyConflicts.length > 0 && !allergyOverrideConfirmed)
                }
              >
                <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {t("clinical.issueRx")}
                  {effectiveRxMedications.length > 1
                    ? ` (${effectiveRxMedications.length})`
                    : ""}
                </span>
              </UiButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* 4. Patient Longitudinal Chart History (Scoped to Patient or All + Instant Search + 1-Click Rx Renewal) */}
      <section className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8F1FA] pb-3">
          <h3 className="font-editorial text-sm font-bold text-[#0F243E]">
            {c.doctorTab.historyTitle(scopedNotes.length)} ·{" "}
            {scopedPrescriptions.length} E-Rx
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-[#6B829D]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={ui.filterPlaceholder}
                className="h-8 w-44 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] pe-2.5 ps-8 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="inline-flex rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-0.5">
              <button
                type="button"
                onClick={() => setChartScope("PATIENT")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  chartScope === "PATIENT"
                    ? "bg-[#0066CC] text-white"
                    : "text-[#4A627D] hover:text-[#0F243E]"
                }`}
              >
                {ui.thisPatient}
              </button>
              <button
                type="button"
                onClick={() => setChartScope("ALL")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  chartScope === "ALL"
                    ? "bg-[#0066CC] text-white"
                    : "text-[#4A627D] hover:text-[#0F243E]"
                }`}
              >
                {ui.allPatients(visitNotes.length)}
              </button>
            </div>
          </div>
        </div>

        {/* Encounter History */}
        {scopedNotes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#CBDDF0] bg-[#F8FBFE] p-4 text-xs text-[#556E89]">
            {c.doctorTab.historyEmpty(
              formatCountryDisplayName(selectedCountry, selectedCountry, locale),
            )}
          </p>
        ) : (
          <ul className="max-h-[340px] space-y-2.5 overflow-y-auto overscroll-y-contain pe-1">
            {scopedNotes.map((note) => (
              <li
                key={note.id}
                className="rounded-2xl border border-[#E8F1FA] bg-[#F8FBFE] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-[#0F243E]">
                    <EntityAvatar
                      name={note.doctorName}
                      role="DOCTOR"
                      size="xs"
                    />
                    <span>
                      <bdi dir="auto">{note.patientName}</bdi> ·{" "}
                      {formatPractitionerDisplayName(note.doctorName)}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {note.vitals
                      ? (() => {
                          const parts = [
                            note.vitals.temperatureC !== undefined
                              ? `${note.vitals.temperatureC}°C`
                              : "",
                            note.vitals.systolicMmHg !== undefined &&
                            note.vitals.diastolicMmHg !== undefined
                              ? `${note.vitals.systolicMmHg}/${note.vitals.diastolicMmHg} mmHg`
                              : "",
                            note.vitals.heartRateBpm !== undefined
                              ? `${note.vitals.heartRateBpm} bpm`
                              : "",
                          ].filter(Boolean);
                          return parts.length > 0 ? (
                            <span
                              dir="ltr"
                              className="rounded-full border border-[#BFDBFE] bg-white px-2.5 py-0.5 font-mono-tabular text-[10.5px] font-bold text-[#0052A3]"
                            >
                              {parts.join(" · ")}
                            </span>
                          ) : null;
                        })()
                      : null}
                    <span
                      dir="ltr"
                      className="rounded-full bg-[#E6F7F4] px-2 py-0.5 font-mono-tabular text-[10.5px] font-bold text-[#0B6B5C]"
                    >
                      {note.icd10Codes.join(", ") || c.doctorTab.unspecifiedCode}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono-tabular text-[10.5px] text-[#6B829D]"
                    >
                      {note.createdAtIso.slice(0, 10)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[#2F4661]">
                  <strong className="text-[#0F243E]">
                    {c.doctorTab.assessmentInlinePrefix}
                  </strong>{" "}
                  <bdi dir="auto">{note.assessment}</bdi> —{" "}
                  <strong className="text-[#0F243E]">
                    {c.doctorTab.planInlinePrefix}
                  </strong>{" "}
                  <bdi dir="auto">{note.plan}</bdi>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Signed QR Prescriptions with 1-Click Renew */}
        {scopedPrescriptions.length > 0 ? (
          <div className="space-y-2.5 border-t border-[#E8F1FA] pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#556E89]">
              {c.doctorTab.qrPrescriptionsTitle(scopedPrescriptions.length)}
            </h4>
            <div className="space-y-2.5">
              {scopedPrescriptions.map((rx) => (
                <div key={rx.id} className="space-y-1.5">
                  <QrPrescriptionCard prescription={rx} />
                  {!isNurse ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRenewPrescription(rx)}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#0052A3] transition-colors hover:bg-[#0066CC] hover:text-white active:scale-95"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        <span>{ui.renewRx}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
