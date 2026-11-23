"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
} from "react";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  ClinicalMediaCategorySchema,
  ClinicalMediaMimeTypeSchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  type AuthenticatedUser,
  type ClinicalMediaCategory,
  type ClinicalMediaMimeType,
  type ClinicalMediaObjectSummary,
  type CountryPack,
  type FacilityMediaDocument,
  type FacilitySummary,
  type LabOrderStatus,
  type LabOrderSummary,
  type LabUrgency,
  type LocaleCode,
  type PresignedUploadResponse,
  type UserMediaDocument,
} from "@medisync/contracts";
import {
  CheckCircle2,
  Columns3,
  Eye,
  FileUp,
  FlaskConical,
  GripVertical,
  List,
  Search,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { listFacilities } from "@/features/auth-portal";
import {
  ClinicalPapersPanel,
  fetchClinicalMedia,
  fetchLabOrders,
  updateLabOrderStatus,
} from "@/features/clinical-workspace";
import {
  FileUploadDropzone,
  formatByteSize,
  inferUploadMimeType,
  listFacilityMedia,
  listMyUserMedia,
  uploadClinicalMediaEndToEnd,
} from "@/features/media-certifications";
import { checkBackendOnline } from "@/shared/api/directory-client";
import { readStoredSession, revokeClientSession } from "@/shared/auth/session-storage";
import { syncPendingSessionStatus } from "@/shared/auth/role-capabilities";
import { WorkspaceRoleGuard } from "@/shared/auth/WorkspaceRoleGuard";
import { ACTIVE_COUNTRY_CODE, resolveActivePack } from "@/shared/config/deployment";
import {
  formatClinicalFileType,
  formatCountryDisplayName,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import {
  formatPractitionerDisplayName,
  StatStrip,
  UiBadge,
  UiButton,
  UiInput,
  UiTabBar,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import { LAB_COPY } from "../lab-i18n";

type LabTab = "queue" | "papers";
type KanbanLaneStatus = "ORDERED" | "SAMPLE_COLLECTED" | "COMPLETED";

const RESULT_CHIPS: ReadonlyArray<{
  id: string;
  labels: Record<LocaleCode, string>;
  text: Record<LocaleCode, string>;
}> = [
  {
    id: "normal",
    labels: { en: "Normal Range", fr: "Valeurs Normales", ar: "المعدل الطبيعي" },
    text: {
      en: "All values within normal clinical reference range.",
      fr: "Toutes les valeurs se situent dans les intervalles de référence normaux.",
      ar: "جميع القيم ضمن المعدلات المرجعية السريرية الطبيعية.",
    },
  },
  {
    id: "crp",
    labels: { en: "Elevated WBC / CRP", fr: "GB / CRP Élevés", ar: "ارتفاع الكريات البيضاء / CRP" },
    text: {
      en: "Elevated WBC / CRP — flagged for attending physician review.",
      fr: "Hyperleucocytose / CRP élevée — signalé au médecin prescripteur.",
      ar: "ارتفاع الكريات البيضاء و CRP — للمراجعة العاجلة من الطبيب المعالج.",
    },
  },
  {
    id: "hba1c",
    labels: { en: "HbA1c Elevated", fr: "HbA1c Élevée", ar: "ارتفاع HbA1c" },
    text: {
      en: "HbA1c above target threshold — glycemic follow-up advised.",
      fr: "HbA1c supérieure à l'objectif — suivi diabétologique conseillé.",
      ar: "معدل HbA1c أعلى من الهدف — يُنصح بمتابعة توازن السكري.",
    },
  },
  {
    id: "trop",
    labels: { en: "Troponin Negative", fr: "Troponine Négative", ar: "تروبونين سلبي" },
    text: {
      en: "High-sensitivity Troponin negative (<14 ng/L); no acute myocardial injury.",
      fr: "Troponine ultrasensible négative (< 14 ng/L) ; pas de souffrance myocardique aiguë.",
      ar: "تروبونين عالي الحساسية سلبي (<14 ng/L)؛ لا علامات إصابة قلبية حادة.",
    },
  },
  {
    id: "imaging",
    labels: { en: "Imaging Clear", fr: "Imagerie Normale", ar: "الأشعة سليمة" },
    text: {
      en: "Clear diagnostic imaging — no acute abnormalities observed.",
      fr: "Imagerie diagnostique sans anomalie aiguë décelée.",
      ar: "التصوير الطبي سليم — لم تُلاحظ أي علامات غير طبيعية.",
    },
  },
  {
    id: "iso",
    labels: { en: "NM ISO 15189 Validated", fr: "Validé NM ISO 15189", ar: "مصادق NM ISO 15189" },
    text: {
      en: "Specimen analyzed & validated per Moroccan Law 12-01 / NM ISO 15189 protocol.",
      fr: "Prélèvement analysé et validé selon la Loi 12-01 / NM ISO 15189.",
      ar: "تم تحليل العينة والمصادقة عليها وفق القانون 12-01 ومعيار NM ISO 15189.",
    },
  },
];

const LAB_MEDIA_CATEGORIES: ReadonlyArray<{
  id: ClinicalMediaCategory;
  labels: Record<LocaleCode, string>;
}> = [
  { id: "LAB_REPORT", labels: { en: "Lab Report PDF", fr: "Compte-rendu Labo PDF", ar: "تقرير المختبر PDF" } },
  { id: "RADIOLOGY_SCAN", labels: { en: "Radiology / DICOM", fr: "Radiologie / DICOM", ar: "الأشعة / DICOM" } },
  { id: "FHIR_BUNDLE", labels: { en: "FHIR Bundle", fr: "Dossier FHIR", ar: "ملف FHIR" } },
];

function formatLabPriority(level: LabUrgency, locale: string): string {
  if (level === "EMERGENCY") return "STAT";
  if (level === "URGENT") return locale === "ar" ? "مستعجل" : "Urgent";
  return locale === "ar" ? "عادي" : "Routine";
}

interface LabWorkbenchProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

export function LabWorkbench({ packs, apiBaseUrl }: LabWorkbenchProps) {
  const { locale, isRtl } = useLocale();
  const c = LAB_COPY[locale] ?? LAB_COPY.en;
  const setBanner = useToastSetter();
  const { openImage } = useImageLightbox();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);

  const defaultCountry = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [activeTab, setActiveTab] = useState<LabTab>("queue");

  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [mediaObjects, setMediaObjects] = useState<ClinicalMediaObjectSummary[]>([]);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [userDocs, setUserDocs] = useState<UserMediaDocument[]>([]);
  const [facilityDocs, setFacilityDocs] = useState<FacilityMediaDocument[]>([]);

  const [viewMode, setViewMode] = useState<"BOARD" | "LIST">("BOARD");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LabOrderStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<KanbanLaneStatus | null>(null);

  const [resultSummaryInput, setResultSummaryInput] = useState(
    RESULT_CHIPS[0]!.text[locale],
  );
  useEffect(() => {
    setResultSummaryInput((prev) => {
      const matchedChip = RESULT_CHIPS.find(
        (chip) =>
          chip.text.en === prev ||
          chip.text.fr === prev ||
          chip.text.ar === prev,
      );
      return matchedChip ? matchedChip.text[locale] : prev;
    });
  }, [locale]);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMime, setUploadMime] = useState<ClinicalMediaMimeType>("application/pdf");
  const [uploadCategory, setUploadCategory] = useState<ClinicalMediaCategory>("LAB_REPORT");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [latestPresigned, setLatestPresigned] =
    useState<PresignedUploadResponse | null>(null);

  const [specialtyInput, setSpecialtyInput] = useState("Clinical Pathology & ISO LIMS");
  const [licenseInput, setLicenseInput] = useState("MA-LAB-15189");
  const [feeMinorInput, setFeeMinorInput] = useState("0");

  const isPendingStaff = isPendingStaffVerification(currentUser);
  const activePack = packs.find((p) => p.code === selectedCountry) ?? packs[0];

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("LIST");
    }
  }, []);

  const refreshPapers = useCallback(
    async (token: string, user: AuthenticatedUser) => {
      const [myRes, facMediaRes, facListRes] = await Promise.all([
        listMyUserMedia(apiBaseUrl, token),
        user.facilityId
          ? listFacilityMedia(apiBaseUrl, token, user.facilityId)
          : Promise.resolve({ ok: true as const, data: { documents: [] } }),
        listFacilities(apiBaseUrl, token, user.countryCode),
      ]);
      if (myRes.ok) setUserDocs(myRes.data.documents);
      if (facMediaRes.ok) setFacilityDocs(facMediaRes.data.documents);
      if (facListRes.ok) setFacilities(facListRes.data.facilities);
    },
    [apiBaseUrl],
  );

  const refreshLabData = useCallback(
    async (token: string, countryCode: string, user: AuthenticatedUser | null) => {
      if (!token || !user || isPendingStaffVerification(user) || user.role !== "LAB_TECH") {
        return;
      }
      const [ordersRes, mediaRes] = await Promise.all([
        fetchLabOrders(apiBaseUrl, token, countryCode),
        fetchClinicalMedia(apiBaseUrl, token, countryCode),
      ]);
      if (ordersRes.ok) {
        setLabOrders(ordersRes.data.labOrders);
        if (ordersRes.data.labOrders[0]) {
          setSelectedOrderForUpload((prev) => prev || ordersRes.data.labOrders[0]!.id);
        }
      }
      if (mediaRes.ok) setMediaObjects(mediaRes.data.mediaObjects);
      await refreshPapers(token, user);
    },
    [apiBaseUrl, refreshPapers],
  );

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedCountry(stored.user.countryCode);
    }
    setSessionHydrated(true);

    let active = true;
    checkBackendOnline().then((online) => {
      if (!active) return;
      setApiOnline(online);
      if (online && stored) {
        void syncPendingSessionStatus(apiBaseUrl, stored, { force: true }).then((syncRes) => {
          if (!active) return;
          if (syncRes.status === "updated" && syncRes.session) {
            setCurrentUser(syncRes.session.user);
            setSelectedCountry(syncRes.session.user.countryCode);
          } else if (syncRes.status === "expired") {
            setSessionToken(null);
            setCurrentUser(null);
          }
        });
      }
    });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiOnline || !sessionToken || !currentUser || currentUser.role !== "LAB_TECH") {
      return;
    }
    if (isPendingStaff) {
      void refreshPapers(sessionToken, currentUser);
      return;
    }
    void refreshLabData(sessionToken, selectedCountry, currentUser);
  }, [apiOnline, currentUser, isPendingStaff, refreshLabData, refreshPapers, selectedCountry, sessionToken]);

  const metrics = useMemo(() => {
    let ordered = 0;
    let collected = 0;
    let completed = 0;
    for (const order of labOrders) {
      if (order.status === "ORDERED") ordered += 1;
      else if (order.status === "SAMPLE_COLLECTED") collected += 1;
      else if (order.status === "COMPLETED") completed += 1;
    }
    return { ordered, collected, completed };
  }, [labOrders]);

  const filteredOrders = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return labOrders.filter((o) => {
      if (viewMode === "LIST" && statusFilter !== "ALL" && o.status !== statusFilter) {
        return false;
      }
      if (needle) {
        const hay =
          `${o.panelName} ${o.patientName} ${o.orderedByDoctorName} ${o.facilityName} ${o.resultSummary ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [deferredSearch, labOrders, statusFilter, viewMode]);

  const myFacility = useMemo(() => {
    if (!currentUser?.facilityId) return null;
    return facilities.find((f) => f.id === currentUser.facilityId) ?? null;
  }, [currentUser?.facilityId, facilities]);

  async function handleOrderTransition(
    order: LabOrderSummary,
    nextStatus: "SAMPLE_COLLECTED" | "COMPLETED",
  ) {
    if (!sessionToken || actionLockRef.current || order.status === nextStatus) return;
    actionLockRef.current = true;
    const snapshot = labOrders;
    const summaryText =
      resultSummaryInput.trim() ||
      (locale === "fr"
        ? "Résultat biologique validé (Loi 12-01)."
        : locale === "ar"
          ? "نتيجة مخبرية مصادق عليها (قانون 12-01)."
          : "Verified laboratory result.");

    setLabOrders((prev) =>
      prev.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: nextStatus,
              ...(nextStatus === "COMPLETED" ? { resultSummary: summaryText } : {}),
            }
          : item,
      ),
    );
    setBusy(true);
    try {
      const res = await updateLabOrderStatus(apiBaseUrl, sessionToken, order.id, {
        status: nextStatus,
        ...(nextStatus === "COMPLETED"
          ? {
              resultSummary: summaryText,
              ...(latestPresigned
                ? { reportObjectKey: latestPresigned.mediaObject.objectKey }
                : {}),
            }
          : {}),
      });
      if (!res.ok) {
        setLabOrders(snapshot);
        setBanner({ tone: "error", text: res.error });
        return;
      }
      setLabOrders((prev) =>
        prev.map((item) => (item.id === order.id ? res.data.labOrder : item)),
      );
      setBanner({
        tone: "success",
        text:
          nextStatus === "SAMPLE_COLLECTED"
            ? c.specimenCollectedMsg(order.panelName)
            : c.completedMsg(order.panelName),
      });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  function handleCardDragStart(e: ReactDragEvent<HTMLElement>, order: LabOrderSummary) {
    if (busy || isPendingStaff || order.status === "COMPLETED" || order.status === "CANCELLED") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", order.id);
    setDraggingOrderId(order.id);
  }

  function handleLaneDrop(e: ReactDragEvent<HTMLDivElement>, targetLane: KanbanLaneStatus) {
    e.preventDefault();
    const orderId = draggingOrderId || e.dataTransfer.getData("text/plain");
    setDraggingOrderId(null);
    setDropLane(null);
    if (!orderId || targetLane === "ORDERED") return;
    const targetOrder = labOrders.find((o) => o.id === orderId);
    if (!targetOrder || targetOrder.status === targetLane || targetOrder.status === "COMPLETED") {
      return;
    }
    void handleOrderTransition(targetOrder, targetLane);
  }

  async function handleUploadReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionToken || !selectedFile || actionLockRef.current) return;
    const matchedOrder = labOrders.find((o) => o.id === selectedOrderForUpload);
    const targetPatientId = matchedOrder?.patientUserId ?? labOrders[0]?.patientUserId;
    if (!targetPatientId) {
      setBanner({ tone: "error", text: "Select an ordered lab panel first." });
      return;
    }

    actionLockRef.current = true;
    setBusy(true);
    setUploadProgress(5);
    try {
      const res = await uploadClinicalMediaEndToEnd({
        apiBaseUrl,
        token: sessionToken,
        patientUserId: targetPatientId,
        ...(selectedOrderForUpload ? { labOrderId: selectedOrderForUpload } : {}),
        mediaCategory: uploadCategory,
        file: selectedFile,
        mimeType: uploadMime,
        onProgress: (pct) => setUploadProgress(pct),
      });
      if (!res.ok) {
        setBanner({ tone: "error", text: res.error });
        return;
      }
      setLatestPresigned(res.presigned);
      setMediaObjects((prev) => [res.confirmed.mediaObject, ...prev]);
      setSelectedFile(null);
      setBanner({
        tone: "success",
        text: c.uploadDoneMsg(res.confirmed.mediaObject.fileName),
      });
    } finally {
      actionLockRef.current = false;
      setUploadProgress(null);
      setBusy(false);
    }
  }

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
  }

  const ui =
    locale === "fr"
      ? {
          searchPlaceholder: "Rechercher patient, bilan, médecin…",
          board: "Tableau",
          list: "Liste",
          stages: ["1. Prescrit", "2. Prélèvement", "3. Résultat validé"] as const,
          linkOrder: "Associer à un bilan",
          standalone: "Rapport indépendant",
          noReports: "Aucun rapport de laboratoire téléversé.",
          open: "Ouvrir",
        }
      : locale === "ar"
        ? {
            searchPlaceholder: "ابحث عن مريض، تحليل، طبيب…",
            board: "لوحة",
            list: "قائمة",
            stages: ["1. مطلوب", "2. أخذ العينة", "3. النتيجة جاهزة"] as const,
            linkOrder: "ربط بطلب تحليل",
            standalone: "تقرير مستقل",
            noReports: "لا توجد تقارير مخبرية مرفوعة بعد.",
            open: "فتح",
          }
        : {
            searchPlaceholder: "Search patient, panel, doctor…",
            board: "Board",
            list: "List",
            stages: ["1. Ordered", "2. Sample Collected", "3. Result Released"] as const,
            linkOrder: "Link Lab Order",
            standalone: "Standalone Report",
            noReports: "No uploaded lab reports yet.",
            open: "Open",
          };

  function renderOrderCard(order: LabOrderSummary, compact = false) {
    const canDrag =
      !busy && !isPendingStaff && order.status !== "COMPLETED" && order.status !== "CANCELLED";
    const isUrgent = order.urgency === "EMERGENCY";
    const stageIdx =
      order.status === "COMPLETED" ? 2 : order.status === "SAMPLE_COLLECTED" ? 1 : 0;

    return (
      <article
        key={order.id}
        draggable={canDrag}
        onDragStart={(e) => handleCardDragStart(e, order)}
        onDragEnd={() => {
          setDraggingOrderId(null);
          setDropLane(null);
        }}
        className={`space-y-2.5 rounded-2xl border bg-white p-3.5 text-xs shadow-2xs transition-[border-color,box-shadow,opacity] ${
          isUrgent
            ? "border-rose-300 border-s-4 border-s-[#DC2626]"
            : order.urgency === "URGENT"
              ? "border-amber-200 border-s-4 border-s-amber-500"
              : "border-[#D7E4F2]"
        } ${draggingOrderId === order.id ? "opacity-50" : "hover:border-[#0066CC]"} ${
          canDrag ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {canDrag ? (
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#87A0BC]" aria-hidden="true" />
              ) : null}
              <p className="font-bold text-[#0F243E]">
                <bdi dir="auto">{order.panelName}</bdi>
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
                {formatLabPriority(order.urgency, locale)}
              </UiBadge>
            </div>
            <p className="text-[11.5px] font-semibold text-[#2F4661]">
              <bdi dir="auto">{order.patientName}</bdi>
            </p>
            <p className="truncate text-[11px] text-[#556E89]">
              {formatPractitionerDisplayName(order.orderedByDoctorName)} · {order.facilityName}
            </p>
          </div>

          {!compact ? (
            <UiBadge
              tone={
                order.status === "COMPLETED"
                  ? "emerald"
                  : order.status === "SAMPLE_COLLECTED"
                    ? "teal"
                    : "amber"
              }
            >
              {order.status}
            </UiBadge>
          ) : null}
        </div>

        {order.clinicalNotes ? (
          <p className="rounded-xl bg-[#F3F8FD] px-2.5 py-1.5 text-[11px] text-[#2F4661]">
            <bdi dir="auto">{order.clinicalNotes}</bdi>
          </p>
        ) : null}

        {order.resultSummary ? (
          <p className="rounded-xl border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-1.5 text-[11px] font-medium text-[#0B6B5C]">
            <bdi dir="auto">{order.resultSummary}</bdi>
          </p>
        ) : null}

        {!compact ? (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {ui.stages.map((stage, idx) => (
              <div key={stage} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full ${
                    idx <= stageIdx
                      ? stageIdx === 2
                        ? "bg-[#0F9D88]"
                        : "bg-[#0066CC]"
                      : "bg-[#D7E4F2]"
                  }`}
                />
                <span
                  className={`block truncate text-[10px] font-semibold ${
                    idx <= stageIdx ? "text-[#0F243E]" : "text-[#87A0BC]"
                  }`}
                >
                  {stage}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {order.status !== "COMPLETED" && order.status !== "CANCELLED" ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {order.status === "ORDERED" ? (
              <UiButton
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || isPendingStaff}
                onClick={() => void handleOrderTransition(order, "SAMPLE_COLLECTED")}
              >
                <TestTube2 className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{c.collectSpecimenBtn}</span>
              </UiButton>
            ) : null}
            <UiButton
              type="button"
              size="sm"
              variant="primary"
              disabled={busy || isPendingStaff}
              onClick={() => void handleOrderTransition(order, "COMPLETED")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{c.completeOrderBtn}</span>
            </UiButton>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={c.title}
        countryCode={selectedCountry}
        countryName={formatCountryDisplayName(
          selectedCountry,
          activePack?.name ?? selectedCountry,
          locale,
        )}
        currencyCode={activePack?.currencyCode ?? selectedCountry}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={currentUser}
        guestLabel={c.guestLabel}
        onSignOut={handleSignOut}
        actions={
          currentUser && sessionToken && !isPendingStaff ? (
            <UiButton
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshLabData(sessionToken, selectedCountry, currentUser)}
            >
              {c.syncBtn}
            </UiButton>
          ) : undefined
        }
      />

      <VerificationGateNotice user={currentUser} compact />

      <WorkspaceRoleGuard
        user={currentUser}
        hydrated={sessionHydrated}
        allowedRoles={["LAB_TECH"]}
        workspaceTitle={c.guardTitle}
        requiredRoleDescription={c.guardRoles}
        allowPendingMatchingRole
      >
        <UiTabBar
          ariaLabel="Laboratory workbench tabs"
          activeTab={activeTab}
          onSelect={setActiveTab}
          tabs={[
            {
              id: "queue",
              label: c.tabQueue,
              icon: <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />,
            },
            {
              id: "papers",
              label: c.tabPapers,
              icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
            },
          ]}
        />

        {activeTab === "queue" ? (
          <div className="space-y-4">
            <StatStrip
              columns={3}
              ariaLabel="Laboratory queue summary"
              items={[
                { label: c.kpiOrdered, value: String(metrics.ordered), tone: "amber" },
                { label: c.kpiCollected, value: String(metrics.collected), tone: "neutral" },
                { label: c.kpiCompleted, value: String(metrics.completed), tone: "emerald" },
              ]}
            />

            {/* Industrial Bench Control Bar: Search + Board/List + 1-Tap Sign-off Result Chips */}
            <section className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-editorial text-sm font-bold text-[#0F243E]">
                    {c.queueHeading(filteredOrders.length)}
                  </h2>
                  <MoroccanComplianceBadge domain="lab" locale={locale} />
                  <div className="relative flex items-center">
                    <Search
                      className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-[#6B829D]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={ui.searchPlaceholder}
                      className="h-9 w-52 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] pe-3 ps-8 text-xs text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {viewMode === "LIST" ? (
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          { id: "ALL" as const, label: c.filterAll },
                          { id: "ORDERED" as const, label: c.filterOrdered },
                          { id: "SAMPLE_COLLECTED" as const, label: c.filterCollected },
                          { id: "COMPLETED" as const, label: c.filterCompleted },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setStatusFilter(f.id)}
                          className={`min-h-[32px] rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                            statusFilter === f.id
                              ? "border-[#0052A3] bg-[#0066CC] text-white"
                              : "border-[#CBDDF0] bg-[#F3F8FD] text-[#4A627D] hover:bg-white"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="inline-flex rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("BOARD")}
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                        viewMode === "BOARD"
                          ? "bg-[#0066CC] text-white"
                          : "text-[#4A627D] hover:text-[#0F243E]"
                      }`}
                    >
                      <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{ui.board}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("LIST")}
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                        viewMode === "LIST"
                          ? "bg-[#0066CC] text-white"
                          : "text-[#4A627D] hover:text-[#0F243E]"
                      }`}
                    >
                      <List className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{ui.list}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1-Tap Sign-Off Result Chips + Editable Result Summary */}
              <div className="space-y-2 border-t border-[#E8F1FA] pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {RESULT_CHIPS.map((chip) => {
                    const active = resultSummaryInput === chip.text[locale];
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setResultSummaryInput(chip.text[locale])}
                        className={`min-h-[30px] rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                          active
                            ? "border-[#0052A3] bg-[#0066CC] text-white"
                            : "border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3] hover:bg-[#0066CC] hover:text-white"
                        }`}
                      >
                        {chip.labels[locale]}
                      </button>
                    );
                  })}
                </div>
                <UiInput
                  type="text"
                  aria-label={c.summaryLabel}
                  value={resultSummaryInput}
                  onChange={(e) => setResultSummaryInput(e.target.value)}
                  placeholder={c.summaryPlaceholder}
                  className="h-9 bg-[#F8FBFE] text-xs focus:bg-white"
                />
              </div>
            </section>

            {/* 3-Lane Drag-and-Drop LIMS Specimen Kanban OR List View */}
            {viewMode === "BOARD" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {(
                  [
                    {
                      status: "ORDERED" as const,
                      title: c.filterOrdered,
                      dot: "bg-amber-500",
                      items: filteredOrders.filter((o) => o.status === "ORDERED"),
                    },
                    {
                      status: "SAMPLE_COLLECTED" as const,
                      title: c.filterCollected,
                      dot: "bg-[#0066CC]",
                      items: filteredOrders.filter((o) => o.status === "SAMPLE_COLLECTED"),
                    },
                    {
                      status: "COMPLETED" as const,
                      title: c.filterCompleted,
                      dot: "bg-[#0F9D88]",
                      items: filteredOrders.filter((o) => o.status === "COMPLETED"),
                    },
                  ] as const
                ).map((lane) => {
                  const isDropTarget =
                    dropLane === lane.status && lane.status !== "ORDERED";
                  return (
                    <div
                      key={lane.status}
                      onDragOver={(e) => {
                        if (lane.status === "ORDERED" || !draggingOrderId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dropLane !== lane.status) setDropLane(lane.status);
                      }}
                      onDragLeave={() => {
                        if (dropLane === lane.status) setDropLane(null);
                      }}
                      onDrop={(e) => handleLaneDrop(e, lane.status)}
                      className={`flex min-h-[260px] flex-col gap-3 rounded-2xl border p-3.5 transition-colors ${
                        isDropTarget
                          ? "border-[#0066CC] bg-[#EBF4FF]/70 ring-2 ring-[#0066CC]/30"
                          : "border-[#D7E4F2] bg-[#F8FBFE]"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-[#E8F1FA] pb-2.5">
                        <span className="flex items-center gap-2 text-xs font-bold text-[#0F243E]">
                          <span className={`h-2.5 w-2.5 rounded-full ${lane.dot}`} />
                          <span>{lane.title}</span>
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-0.5 font-mono-tabular text-[11px] font-bold text-[#0052A3] ring-1 ring-[#D7E4F2]">
                          {lane.items.length}
                        </span>
                      </div>

                      {lane.items.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#CBDDF0] p-6 text-center text-xs text-[#6B829D]">
                          {c.emptyQueue}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {lane.items.map((order) => renderOrderCard(order, true))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="rounded-2xl border border-[#D7E4F2] bg-white p-6 text-center text-xs text-[#4A627D]">
                {c.emptyQueue}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => renderOrderCard(order, false))}
              </div>
            )}

            {/* Report Upload Dock + Confirmed Lab Media Lightbox Gallery */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] lg:col-span-6">
                <h3 className="font-editorial text-sm font-bold text-[#0F243E]">
                  {c.attachReportTitle}
                </h3>
                <form onSubmit={(e) => void handleUploadReport(e)} className="mt-3 space-y-3 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {LAB_MEDIA_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setUploadCategory(ClinicalMediaCategorySchema.parse(cat.id))
                        }
                        className={`min-h-[30px] rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                          uploadCategory === cat.id
                            ? "border-[#0052A3] bg-[#0066CC] text-white"
                            : "border-[#D7E4F2] bg-[#F8FBFE] text-[#4A627D] hover:border-[#0066CC]"
                        }`}
                      >
                        {cat.labels[locale]}
                      </button>
                    ))}
                  </div>

                  <FileUploadDropzone
                    id="lab-workbench-file"
                    label={c.dropzoneLabel}
                    hint={c.dropzoneHint}
                    accept={ALLOWED_MEDIA_MIME_TYPES.join(",")}
                    maxBytes={MAX_CLINICAL_UPLOAD_BYTES}
                    selectedFile={selectedFile}
                    progressPercent={uploadProgress}
                    disabled={busy || isPendingStaff}
                    onFileSelected={(file) => {
                      setSelectedFile(file);
                      if (file) {
                        const mime = inferUploadMimeType(file, ALLOWED_MEDIA_MIME_TYPES);
                        if (mime) {
                          setUploadMime(ClinicalMediaMimeTypeSchema.parse(mime));
                        }
                      }
                    }}
                  />

                  <div className="space-y-3">
                    <EntityPicker
                      id="lab-order-upload-link"
                      label={ui.linkOrder}
                      placeholder={ui.searchPlaceholder}
                      emptyLabel={ui.standalone}
                      value={selectedOrderForUpload}
                      onChange={setSelectedOrderForUpload}
                      options={labOrders.map((o) => ({
                        id: o.id,
                        label: o.panelName,
                        sublabel: o.patientName,
                      }))}
                    />
                    <div className="flex justify-end">
                      <UiButton type="submit" disabled={busy || !selectedFile || isPendingStaff}>
                        <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{c.uploadBtn}</span>
                      </UiButton>
                    </div>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] lg:col-span-6">
                <h3 className="font-editorial text-sm font-bold text-[#0F243E]">
                  {c.uploadedArchiveHeading(mediaObjects.length)}
                </h3>
                {mediaObjects.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-[#CBDDF0] bg-[#F8FBFE] p-6 text-center text-xs text-[#6B829D]">
                    {ui.noReports}
                  </p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
                    {mediaObjects.slice(0, 20).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#0F243E]">{m.fileName}</p>
                          <p className="font-mono-tabular text-[11px] text-[#556E89]">
                            {formatByteSize(m.confirmedSizeBytes ?? m.sizeBytes)} ·{" "}
                            {formatClinicalFileType(m.mimeType, locale)}
                          </p>
                        </div>
                        <UiButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openImage({
                              src: m.downloadUrl,
                              downloadUrl: m.downloadUrl,
                              mimeType: m.mimeType,
                              alt: m.fileName,
                              title: m.fileName,
                              subtitle: m.uploadStatus,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ui.open}</span>
                        </UiButton>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {activeTab === "papers" && currentUser && sessionToken ? (
          <ClinicalPapersPanel
            apiBaseUrl={apiBaseUrl}
            token={sessionToken}
            user={currentUser}
            currencyCode={activePack?.currencyCode ?? selectedCountry}
            isPendingStaff={isPendingStaff}
            facilityName={myFacility?.name ?? null}
            facilityKind={myFacility?.kind}
            userDocs={userDocs}
            facilityDocs={facilityDocs}
            specialtyInput={specialtyInput}
            mdLicenseInput={licenseInput}
            feeMinorInput={feeMinorInput}
            busy={busy}
            onSpecialtyChange={setSpecialtyInput}
            onLicenseChange={setLicenseInput}
            onFeeChange={setFeeMinorInput}
            onSavePracticeProfile={async (e) => e.preventDefault()}
            onBusyChange={setBusy}
            onDocumentsUpdated={() => refreshPapers(sessionToken, currentUser)}
            onFeedback={(tone, text) => setBanner({ tone, text })}
          />
        ) : null}
      </WorkspaceRoleGuard>
    </div>
  );
}
