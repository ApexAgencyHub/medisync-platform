"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CreateScheduleSchema,
  type AppointmentSummary,
  type AuthenticatedUser,
  type ClinicalMediaCategory,
  type ClinicalMediaMimeType,
  type ClinicalMediaObjectSummary,
  type CountryPack,
  type CreateLabOrderInput,
  type CreatePrescriptionInput,
  type CreateVisitNoteInput,
  type DirectoryDoctorSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type DoctorScheduleSummary,
  type FacilityMediaDocument,
  type FacilitySummary,
  type LabOrderSummary,
  type LocaleCode,
  type PatientMedicalProfile,
  type PresignedUploadResponse,
  type PrescriptionSummary,
  type UpdateScheduleInput,
  type UserMediaDocument,
  type UserRole,
  type VisitMode,
  type VisitNoteSummary,
} from "@medisync/contracts";
import { listFacilities } from "@/features/auth-portal";
import {
  createSchedule,
  deleteSchedule,
  fetchAppointments,
  fetchSchedules,
  transitionAppointmentStatus,
  updateSchedule,
  upsertDoctorProfile,
} from "@/features/booking";
import {
  listFacilityMedia,
  listMyUserMedia,
  uploadClinicalMediaEndToEnd,
} from "@/features/media-certifications";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryFacilities,
  fetchDirectoryPatients,
} from "@/shared/api/directory-client";
import {
  formatCountryDisplayName,
  formatFacilityKind,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { useLocale } from "@/shared/i18n/locale-store";
import { CLINICAL_COPY } from "../clinical-i18n";
import { VerificationGateNotice, isPendingStaffVerification } from "@/shared/ui/VerificationGateNotice";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import { isNursingSpecialty } from "@/shared/config/morocco-standards";
import {
  UiButton,
  UiTabBar,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import {
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import { WorkspaceRoleGuard } from "@/shared/auth/WorkspaceRoleGuard";
import {
  BOOKING_VIEWER_ROLES,
  EHR_ACCESS_ROLES,
  LAB_ORDER_VIEWER_ROLES,
  PATIENT_DIRECTORY_VIEWER_ROLES,
  RX_VIEWER_ROLES,
  VISIT_NOTE_VIEWER_ROLES,
  hasRoleCapability,
  syncPendingSessionStatus,
} from "@/shared/auth/role-capabilities";
import {
  Calendar,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import {
  createLabOrder,
  createPrescription,
  createVisitNote,
  fetchClinicalMedia,
  fetchLabOrders,
  fetchPatientMedicalProfile,
  fetchPrescriptions,
  fetchVisitNotes,
  updateLabOrderStatus,
} from "../api-client";
import { ClinicalConsultationDesk } from "./ClinicalConsultationDesk";
import { ClinicalLabsImagingDesk } from "./ClinicalLabsImagingDesk";
import { ClinicalPapersPanel } from "./ClinicalPapersPanel";
import { DoctorCalendarAgenda } from "./DoctorCalendarAgenda";
import { VisualScheduleBuilder } from "./VisualScheduleBuilder";

type ClinicalTab = "calendar" | "doctor" | "schedule" | "labs" | "papers";

const EXTRA_CLINICAL_COPY: Record<
  LocaleCode,
  {
    tabPapers: string;
    nurseCareHeading: string;
    nurseRxNotice: string;
    publishWeekdaysLabel: string;
    activeStatus: string;
    pausedStatus: string;
    pauseBtn: string;
    resumeBtn: string;
    deleteBtn: string;
    scheduleUpdated: (active: boolean) => string;
    scheduleDeleted: string;
    profileSaved: string;
    batchShiftsPublished: (count: number) => string;
  }
> = {
  en: {
    tabPapers: "Papers & Licenses",
    nurseCareHeading: "Nursing Care, Vitals & Chart Note",
    nurseRxNotice:
      "Nursing care & vitals notes save directly to the patient EHR. Prescription issuing (E-Rx) is reserved for physicians.",
    publishWeekdaysLabel: "Apply across Mon–Fri weekdays",
    activeStatus: "Active",
    pausedStatus: "Paused",
    pauseBtn: "Pause",
    resumeBtn: "Resume",
    deleteBtn: "Delete",
    scheduleUpdated: (active) => (active ? "Shift resumed and visible for booking." : "Shift paused."),
    scheduleDeleted: "Shift deleted from roster.",
    profileSaved: "Practitioner profile updated.",
    batchShiftsPublished: (count) => `Published ${count} weekly shift windows.`,
  },
  fr: {
    tabPapers: "Justificatifs & Ordre",
    nurseCareHeading: "Soins Infirmiers, Constantes & Dossier",
    nurseRxNotice:
      "Les notes de soins et constantes sont enregistrées au dossier patient. La prescription E-Rx est réservée aux médecins.",
    publishWeekdaysLabel: "Publier sur Lun–Ven (5 jours)",
    activeStatus: "Actif",
    pausedStatus: "En pause",
    pauseBtn: "Pause",
    resumeBtn: "Reprendre",
    deleteBtn: "Supprimer",
    scheduleUpdated: (active) => (active ? "Créneau réactivé." : "Créneau mis en pause."),
    scheduleDeleted: "Créneau supprimé du planning.",
    profileSaved: "Fiche praticien mise à jour.",
    batchShiftsPublished: (count) => `${count} créneaux hebdomadaires publiés.`,
  },
  ar: {
    tabPapers: "الوثائق والتراخيص",
    nurseCareHeading: "العناية التمريضية، المؤشرات الحيوية والتقرير",
    nurseRxNotice:
      "تحفظ ملاحظات التمريض والمؤشرات الحيوية في الملف الطبي للمريض، بينما إصدار الوصفة الرقمية E-Rx مخصص للأطباء.",
    publishWeekdaysLabel: "نشر طيلة أيام الأسبوع (الإثنين - الجمعة)",
    activeStatus: "نشط",
    pausedStatus: "متوقف مؤقتاً",
    pauseBtn: "إيقاف مؤقت",
    resumeBtn: "تفعيل",
    deleteBtn: "حذف",
    scheduleUpdated: (active) => (active ? "تم تفعيل المداومة." : "تم إيقاف المداومة مؤقتاً."),
    scheduleDeleted: "تم حذف المداومة من الجدول.",
    profileSaved: "تم تحديث ملف المزاولة.",
    batchShiftsPublished: (count) => `تم نشر ${count} فترات عمل أسبوعية.`,
  },
};

interface ClinicalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
  initialTab?: ClinicalTab;
}

export function ClinicalWorkspace({
  packs,
  apiBaseUrl,
  initialTab,
}: ClinicalWorkspaceProps) {
  const { locale, t, isRtl } = useLocale();
  const c = CLINICAL_COPY[locale];
  const m = c.messages;
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [activeTab, setActiveTab] = useState<ClinicalTab>(
    initialTab ?? "doctor",
  );

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const isPendingStaff = isPendingStaffVerification(currentUser);
  const allowedWorkspaceRoles = useMemo<readonly UserRole[]>(
    () => ["DOCTOR"],
    [],
  );
  const isAuthorizedClinicalViewer = Boolean(
    currentUser && allowedWorkspaceRoles.includes(currentUser.role),
  );
  const actionLockRef = useRef(false);

  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [patientProfile, setPatientProfile] =
    useState<PatientMedicalProfile | null>(null);
  const [patientProfileLoading, setPatientProfileLoading] = useState(false);

  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [mediaObjects, setMediaObjects] = useState<
    ClinicalMediaObjectSummary[]
  >([]);
  const [schedules, setSchedules] = useState<DoctorScheduleSummary[]>([]);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [directoryDoctors, setDirectoryDoctors] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [directoryClinics, setDirectoryClinics] = useState<
    DirectoryFacilitySummary[]
  >([]);
  const [userDocs, setUserDocs] = useState<UserMediaDocument[]>([]);
  const [facilityDocs, setFacilityDocs] = useState<FacilityMediaDocument[]>([]);
  const [publishWeekdays, setPublishWeekdays] = useState(false);

  // Clinic & Practitioner Shift Publishing
  const [specialtyInput, setSpecialtyInput] = useState("Cardiology");
  const [mdLicenseInput, setMdLicenseInput] = useState("MA-MD-44021");
  const [feeMinorInput, setFeeMinorInput] = useState("35000");
  const [schedFacilityId, setSchedFacilityId] = useState("");
  const [schedDoctorId, setSchedDoctorId] = useState("");
  const [schedDay, setSchedDay] = useState(1);
  const [schedStart, setSchedStart] = useState("09:00");
  const [schedEnd, setSchedEnd] = useState("12:00");
  const [schedDuration, setSchedDuration] = useState("30");
  const [schedMode, setSchedMode] = useState<VisitMode>("IN_PERSON");

  // Active Patient & Diagnostic Lab Selection
  const [patientUuid, setPatientUuid] = useState("");
  const [labFacilityId, setLabFacilityId] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [latestPresigned, setLatestPresigned] =
    useState<PresignedUploadResponse | null>(null);
  const [directoryPatients, setDirectoryPatients] = useState<
    DirectoryPatientSummary[]
  >([]);
  const [directoryLabs, setDirectoryLabs] = useState<
    DirectoryFacilitySummary[]
  >([]);
  const [apiOnline, setApiOnline] = useState(false);

  const [busy, setBusy] = useState(false);
  const setBanner = useToastSetter();

  const activePack =
    packs.find((pack) => pack.code === selectedCountry) ?? packs[0];

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedCountry(resolveEffectiveCountryCode(stored.user.countryCode));
      if (stored.user.role === "PATIENT") {
        setPatientUuid(stored.user.id);
      }
      if (stored.user.role === "DOCTOR" || stored.user.role === "NURSE") {
        setSchedDoctorId(stored.user.id);
      }
      if (stored.user.role === "NURSE") {
        setSpecialtyInput("Home Nursing & Wound Care");
        setMdLicenseInput("MA-RN-20418");
        setFeeMinorInput("20000");
        setSchedMode("HOME_VISIT");
      }
      if (
        !initialTab &&
        (stored.user.role === "DOCTOR" ||
          stored.user.role === "NURSE" ||
          stored.user.role === "CLINIC_STAFF")
      ) {
        setActiveTab("calendar");
      }
    }
    setSessionHydrated(true);

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (cancelled) return;
      setApiOnline(online);
      if (online && stored && isPendingStaffVerification(stored.user)) {
        void syncPendingSessionStatus(apiBaseUrl, stored).then((syncRes) => {
          if (cancelled) return;
          if (syncRes.status === "expired") {
            setSessionToken(null);
            setCurrentUser(null);
          } else if (syncRes.status === "updated" && syncRes.session) {
            setCurrentUser(syncRes.session.user);
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const ec = EXTRA_CLINICAL_COPY[locale];

  async function refreshPapersData(
    token: string,
    actor: AuthenticatedUser | null,
  ) {
    const [myRes, facRes] = await Promise.all([
      listMyUserMedia(apiBaseUrl, token),
      actor?.facilityId
        ? listFacilityMedia(apiBaseUrl, token, actor.facilityId)
        : Promise.resolve({ ok: true as const, data: { documents: [] } }),
    ]);
    if (myRes.ok) setUserDocs(myRes.data.documents);
    if (facRes.ok) setFacilityDocs(facRes.data.documents);
  }

  async function refreshClinicalData(
    token: string,
    countryCode: string,
    explicitRole?: UserRole | null,
  ) {
    const stored = readStoredSession();
    const pendingNow =
      isPendingStaff || Boolean(stored && isPendingStaffVerification(stored.user));
    const papersPromise = refreshPapersData(token, stored?.user ?? currentUser);
    if (pendingNow) {
      await papersPromise;
      return;
    }

    const effectiveRole =
      explicitRole ?? currentUser?.role ?? stored?.user.role ?? null;
    const canReadVisitNotes = hasRoleCapability(
      effectiveRole,
      pendingNow,
      VISIT_NOTE_VIEWER_ROLES,
    );
    const canReadPrescriptions = hasRoleCapability(
      effectiveRole,
      pendingNow,
      RX_VIEWER_ROLES,
    );
    const canReadLabOrders = hasRoleCapability(
      effectiveRole,
      pendingNow,
      LAB_ORDER_VIEWER_ROLES,
    );
    const canReadPatientDir = hasRoleCapability(
      effectiveRole,
      pendingNow,
      PATIENT_DIRECTORY_VIEWER_ROLES,
    );
    const canReadAppointments = hasRoleCapability(
      effectiveRole,
      pendingNow,
      BOOKING_VIEWER_ROLES,
    );

    const [
      notesRes,
      rxRes,
      labsRes,
      mediaRes,
      patDirRes,
      labFacRes,
      docsDirRes,
      clinicsRes,
      facListRes,
      schedRes,
      apptsRes,
    ] = await Promise.all([
      canReadVisitNotes
        ? fetchVisitNotes(apiBaseUrl, token, countryCode)
        : Promise.resolve({ ok: true as const, data: { visitNotes: [] } }),
      canReadPrescriptions
        ? fetchPrescriptions(apiBaseUrl, token, countryCode)
        : Promise.resolve({ ok: true as const, data: { prescriptions: [] } }),
      canReadLabOrders
        ? fetchLabOrders(apiBaseUrl, token, countryCode)
        : Promise.resolve({ ok: true as const, data: { labOrders: [] } }),
      canReadLabOrders
        ? fetchClinicalMedia(apiBaseUrl, token, countryCode)
        : Promise.resolve({ ok: true as const, data: { mediaObjects: [] } }),
      canReadPatientDir
        ? fetchDirectoryPatients(apiBaseUrl, token, { countryCode })
        : Promise.resolve({ ok: true as const, patients: [] }),
      fetchDirectoryFacilities(apiBaseUrl, {
        countryCode,
        kind: "DIAGNOSTIC_LAB",
      }),
      fetchDirectoryDoctors(apiBaseUrl, { countryCode }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode }),
      listFacilities(apiBaseUrl, token, countryCode),
      fetchSchedules(apiBaseUrl, { countryCode, includeInactive: true }),
      canReadAppointments
        ? fetchAppointments(apiBaseUrl, token, countryCode)
        : Promise.resolve({ ok: true as const, data: { appointments: [] } }),
    ]);

    if (notesRes.ok) setVisitNotes(notesRes.data.visitNotes);
    if (rxRes.ok) setPrescriptions(rxRes.data.prescriptions);
    if (labsRes.ok) setLabOrders(labsRes.data.labOrders);
    if (mediaRes.ok) setMediaObjects(mediaRes.data.mediaObjects);
    if (patDirRes.ok) {
      setDirectoryPatients(patDirRes.patients);
    }
    if (!patientUuid) {
      const preferredPatientId =
        (apptsRes.ok
          ? (apptsRes.data.appointments.find(
              (a) =>
                a.status !== "CANCELLED" &&
                a.status !== "NO_SHOW" &&
                a.patientName !== "Guest Care Pass",
            )?.patientUserId ??
            apptsRes.data.appointments.find(
              (a) => a.patientName !== "Guest Care Pass",
            )?.patientUserId)
          : undefined) ??
        (patDirRes.ok ? patDirRes.patients[0]?.id : undefined);
      if (preferredPatientId) {
        setPatientUuid(preferredPatientId);
      }
    }
    if (labFacRes.ok) {
      setDirectoryLabs(labFacRes.facilities);
      if (!labFacilityId && labFacRes.facilities[0]) {
        setLabFacilityId(labFacRes.facilities[0].id);
      }
    }
    if (docsDirRes.ok) {
      setDirectoryDoctors(docsDirRes.doctors);
      if (!schedDoctorId && docsDirRes.doctors[0]) {
        setSchedDoctorId(docsDirRes.doctors[0].id);
      }
      const actorId = stored?.user.id ?? currentUser?.id;
      const ownDoc = actorId
        ? docsDirRes.doctors.find((d) => d.id === actorId)
        : undefined;
      if (ownDoc) {
        if (ownDoc.specialty) setSpecialtyInput(ownDoc.specialty);
        if (typeof ownDoc.consultationFeeMinor === "number") {
          setFeeMinorInput(String(ownDoc.consultationFeeMinor));
        }
      }
    }
    if (clinicsRes.ok) {
      setDirectoryClinics(clinicsRes.facilities);
      if (!schedFacilityId) {
        const actorFacilityId = stored?.user.facilityId ?? currentUser?.facilityId;
        const preferred =
          (actorFacilityId
            ? clinicsRes.facilities.find((f) => f.id === actorFacilityId)
            : undefined) ??
          clinicsRes.facilities.find(
            (f) => f.kind === "CLINIC" || f.kind === "HOSPITAL",
          ) ??
          clinicsRes.facilities[0];
        if (preferred) {
          setSchedFacilityId(preferred.id);
        }
      }
    }
    if (facListRes.ok) {
      setFacilities(facListRes.data.facilities);
      if (!schedFacilityId && (!clinicsRes.ok || clinicsRes.facilities.length === 0)) {
        const actorFacilityId = stored?.user.facilityId ?? currentUser?.facilityId;
        const preferred =
          (actorFacilityId
            ? facListRes.data.facilities.find((f) => f.id === actorFacilityId)
            : undefined) ??
          facListRes.data.facilities.find(
            (f) => f.kind === "CLINIC" || f.kind === "HOSPITAL",
          ) ??
          facListRes.data.facilities[0];
        if (preferred) {
          setSchedFacilityId(preferred.id);
        }
      }
    }
    if (schedRes.ok) {
      setSchedules(schedRes.data.schedules);
    }
    if (apptsRes.ok) {
      setAppointments(apptsRes.data.appointments);
    }
    await papersPromise;
  }

  useEffect(() => {
    const sessionRole = readStoredSession()?.user.role ?? null;
    if (
      !apiOnline ||
      !sessionToken ||
      isPendingStaff ||
      !isAuthorizedClinicalViewer ||
      !sessionRole ||
      !EHR_ACCESS_ROLES.has(sessionRole) ||
      !patientUuid.trim()
    ) {
      setPatientProfile(null);
      return;
    }
    let cancelled = false;
    setPatientProfileLoading(true);
    fetchPatientMedicalProfile(apiBaseUrl, sessionToken, patientUuid.trim())
      .then((res) => {
        if (cancelled) return;
        setPatientProfile(res.ok ? res.data.profile : null);
      })
      .finally(() => {
        if (!cancelled) setPatientProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    apiOnline,
    isAuthorizedClinicalViewer,
    isPendingStaff,
    patientUuid,
    sessionToken,
  ]);

  async function handleTransitionAppointment(
    appointmentId: string,
    status: "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
  ) {
    if (!sessionToken || actionLockRef.current) return;
    actionLockRef.current = true;
    const snapshot = appointments;
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a)),
    );
    try {
      const res = await transitionAppointmentStatus(
        apiBaseUrl,
        sessionToken,
        appointmentId,
        { status },
      );
      if (!res.ok) {
        setAppointments(snapshot);
        setBanner({
          tone: "error",
          text:
            res.status === 409
              ? m.conflictRefreshed
              : m.apptUpdateFailed(res.error),
        });
        if (res.status === 409) {
          const synced = await fetchAppointments(apiBaseUrl, sessionToken, selectedCountry);
          if (synced.ok) setAppointments(synced.data.appointments);
        }
      } else {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? res.data.appointment : a)),
        );
        setBanner({
          tone: "success",
          text: m.apptUpdated(
            res.data.appointment.patientName,
            c.enums.appointmentStatus[res.data.appointment.status] ??
              res.data.appointment.status,
          ),
        });
      }
    } finally {
      actionLockRef.current = false;
    }
  }

  useEffect(() => {
    if (!apiOnline) return;
    if (
      sessionToken &&
      currentUser &&
      !isPendingStaff &&
      !allowedWorkspaceRoles.includes(currentUser.role)
    ) {
      return;
    }
    let active = true;

    if (
      sessionToken &&
      currentUser &&
      allowedWorkspaceRoles.includes(currentUser.role)
    ) {
      if (isPendingStaff) {
        void refreshPapersData(sessionToken, currentUser);
      } else {
        void refreshClinicalData(sessionToken, selectedCountry);
      }
      return () => {
        active = false;
      };
    }

    Promise.all([
      fetchDirectoryFacilities(apiBaseUrl, {
        countryCode: selectedCountry,
        kind: "DIAGNOSTIC_LAB",
      }),
      fetchDirectoryDoctors(apiBaseUrl, { countryCode: selectedCountry }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode: selectedCountry }),
      fetchSchedules(apiBaseUrl, { countryCode: selectedCountry }),
    ]).then(([labRes, docsRes, facRes, schedRes]) => {
      if (!active) return;
      if (labRes.ok) {
        setDirectoryLabs(labRes.facilities);
        if (labRes.facilities[0]) {
          setLabFacilityId((prev) => prev || labRes.facilities[0]!.id);
        }
      }
      if (docsRes.ok) {
        setDirectoryDoctors(docsRes.doctors);
        if (docsRes.doctors[0]) {
          setSchedDoctorId((prev) => prev || docsRes.doctors[0]!.id);
        }
      }
      if (facRes.ok) {
        setDirectoryClinics(facRes.facilities);
        if (facRes.facilities[0]) {
          setSchedFacilityId((prev) => prev || facRes.facilities[0]!.id);
        }
      }
      if (schedRes.ok) {
        setSchedules(schedRes.data.schedules);
      }
    });

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    apiBaseUrl,
    allowedWorkspaceRoles,
    currentUser,
    isPendingStaff,
    selectedCountry,
    sessionToken,
  ]);

  const patientPickerOptions = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; label: string; sublabel: string; priority: number }
    >();
    const dirById = new Map(directoryPatients.map((p) => [p.id, p] as const));

    const statusRank = (s: AppointmentSummary["status"]) =>
      s === "CHECKED_IN"
        ? 0
        : s === "CONFIRMED"
          ? 1
          : s === "COMPLETED"
            ? 2
            : 3;

    const sortedAppointments = [...appointments].sort((a, b) => {
      const diff = statusRank(a.status) - statusRank(b.status);
      if (diff !== 0) return diff;
      return b.slotStartIso.localeCompare(a.slotStartIso);
    });

    for (const appt of sortedAppointments) {
      if (
        appt.patientName === "Guest Care Pass" &&
        appt.patientUserId !== patientUuid
      ) {
        continue;
      }
      if (!byId.has(appt.patientUserId)) {
        const dirInfo = dirById.get(appt.patientUserId);
        const contactHint = dirInfo?.email ?? dirInfo?.phone;
        const dateTag = appt.slotStartIso.slice(0, 10);
        const statusLabel =
          c.enums.appointmentStatus[appt.status] ?? appt.status;
        byId.set(appt.patientUserId, {
          id: appt.patientUserId,
          label: appt.patientName,
          sublabel: contactHint
            ? `${statusLabel} (${dateTag}) · ${contactHint}`
            : `${statusLabel} (${dateTag}) · ${appt.countryCode}`,
          priority: statusRank(appt.status),
        });
      }
    }
    for (const note of visitNotes) {
      if (!byId.has(note.patientUserId)) {
        const dirInfo = dirById.get(note.patientUserId);
        byId.set(note.patientUserId, {
          id: note.patientUserId,
          label: note.patientName,
          sublabel: `${dirInfo?.email ?? c.enums.patientAccount} · ${note.countryCode}`,
          priority: 2,
        });
      }
    }
    for (const rx of prescriptions) {
      if (!byId.has(rx.patientUserId)) {
        const dirInfo = dirById.get(rx.patientUserId);
        byId.set(rx.patientUserId, {
          id: rx.patientUserId,
          label: rx.patientName,
          sublabel: `${dirInfo?.email ?? c.enums.patientAccount} · ${rx.countryCode}`,
          priority: 2,
        });
      }
    }
    for (const order of labOrders) {
      if (!byId.has(order.patientUserId)) {
        const dirInfo = dirById.get(order.patientUserId);
        byId.set(order.patientUserId, {
          id: order.patientUserId,
          label: order.patientName,
          sublabel: `${dirInfo?.email ?? c.enums.patientAccount} · ${order.countryCode}`,
          priority: 2,
        });
      }
    }
    for (const p of directoryPatients) {
      if (!byId.has(p.id)) {
        byId.set(p.id, {
          id: p.id,
          label: p.fullName,
          sublabel: `${p.email ?? p.phone ?? c.enums.patientAccount} · ${p.countryCode}`,
          priority: 4,
        });
      }
    }

    // Collapse redundant historical cancelled/no-show duplicates with the exact same name unless currently selected
    const seenByName = new Set<string>();
    return Array.from(byId.values())
      .sort((a, b) => a.priority - b.priority)
      .filter((opt) => {
        const norm = opt.label.trim().toLowerCase();
        if (opt.id === patientUuid) {
          seenByName.add(norm);
          return true;
        }
        if (opt.priority >= 3 && seenByName.has(norm)) {
          return false;
        }
        seenByName.add(norm);
        return true;
      })
      .map(({ id, label, sublabel }) => ({ id, label, sublabel }));
  }, [
    appointments,
    c.enums.appointmentStatus,
    c.enums.patientAccount,
    directoryPatients,
    labOrders,
    patientUuid,
    prescriptions,
    visitNotes,
  ]);

  const labFacilityPickerOptions = useMemo(
    () =>
      directoryLabs.map((f) => ({
        id: f.id,
        label: f.name,
        sublabel: `${f.licenseNumber} · ${f.address}`,
      })),
    [directoryLabs],
  );

  const doctorPickerOptions = useMemo(
    () =>
      directoryDoctors.map((d) => ({
        id: d.id,
        label: d.fullName,
        sublabel: `${formatSpecialtyLabel(d.specialty, locale)}${d.facilityName ? ` · ${d.facilityName}` : ""}`,
      })),
    [directoryDoctors, locale],
  );

  const clinicFacilityPickerOptions = useMemo(() => {
    const isClinicalSite = (kind: string) =>
      kind === "CLINIC" || kind === "HOSPITAL";
    if (facilities.length > 0) {
      const clinicalOnly = facilities.filter((f) => isClinicalSite(f.kind));
      const list = clinicalOnly.length > 0 ? clinicalOnly : facilities;
      return list.map((fac) => ({
        id: fac.id,
        label: fac.name,
        sublabel: `${formatFacilityKind(fac.kind, locale)} · ${
          c.enums.verifiedStatus[fac.verificationStatus] ?? fac.verificationStatus
        }`,
      }));
    }
    const clinicalOnly = directoryClinics.filter((f) => isClinicalSite(f.kind));
    const list = clinicalOnly.length > 0 ? clinicalOnly : directoryClinics;
    return list.map((fac) => ({
      id: fac.id,
      label: fac.name,
      sublabel: `${formatFacilityKind(fac.kind, locale)} · ${formatOpenStatus(
        fac.openStatus,
        locale,
      )}`,
    }));
  }, [c.enums.verifiedStatus, directoryClinics, facilities, locale]);

  const canManageSchedule =
    currentUser !== null &&
    ["DOCTOR", "NURSE", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
      currentUser.role,
    );

  async function handleSavePracticeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) return;
    setBusy(true);
    const res = await upsertDoctorProfile(apiBaseUrl, sessionToken, {
      specialty: specialtyInput.trim() || "General Practice",
      licenseNumber: mdLicenseInput.trim() || "LIC-PENDING",
      consultationFeeMinor: Number(feeMinorInput) || 0,
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: m.shiftPublishFailed(res.error) });
      return;
    }
    setBanner({ tone: "success", text: ec.profileSaved });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handleToggleSchedule(sched: DoctorScheduleSummary) {
    if (!sessionToken) return;
    const snapshot = schedules;
    setSchedules((prev) =>
      prev.map((item) =>
        item.id === sched.id ? { ...item, isActive: !item.isActive } : item,
      ),
    );
    const res = await updateSchedule(apiBaseUrl, sessionToken, sched.id, {
      isActive: !sched.isActive,
    });
    if (!res.ok) {
      setSchedules(snapshot);
      setBanner({ tone: "error", text: m.shiftPublishFailed(res.error) });
      return;
    }
    setSchedules((prev) =>
      prev.map((item) => (item.id === sched.id ? res.data.schedule : item)),
    );
    setBanner({ tone: "success", text: ec.scheduleUpdated(res.data.schedule.isActive) });
  }

  async function handleUpdateSchedule(
    scheduleId: string,
    patch: UpdateScheduleInput,
  ) {
    if (!sessionToken) return;
    const snapshot = schedules;
    setSchedules((prev) =>
      prev.map((item) =>
        item.id === scheduleId
          ? {
              ...item,
              ...(patch.dayOfWeek !== undefined ? { dayOfWeek: patch.dayOfWeek } : {}),
              ...(patch.startTimeUtc !== undefined ? { startTimeUtc: patch.startTimeUtc } : {}),
              ...(patch.endTimeUtc !== undefined ? { endTimeUtc: patch.endTimeUtc } : {}),
              ...(patch.slotDurationMinutes !== undefined
                ? { slotDurationMinutes: patch.slotDurationMinutes }
                : {}),
              ...(patch.visitMode !== undefined ? { visitMode: patch.visitMode } : {}),
              ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
            }
          : item,
      ),
    );
    const res = await updateSchedule(apiBaseUrl, sessionToken, scheduleId, patch);
    if (!res.ok) {
      setSchedules(snapshot);
      setBanner({ tone: "error", text: m.shiftPublishFailed(res.error) });
      return;
    }
    setSchedules((prev) =>
      prev.map((item) => (item.id === scheduleId ? res.data.schedule : item)),
    );
    setBanner({
      tone: "success",
      text: `${res.data.schedule.startTimeUtc}–${res.data.schedule.endTimeUtc} · ${res.data.schedule.facilityName}`,
    });
  }

  async function handleDuplicateSchedule(
    sched: DoctorScheduleSummary,
    targetDayOfWeek: number,
  ) {
    if (!sessionToken || !currentUser) return;
    const isSelfPractitioner =
      currentUser.role === "DOCTOR" || currentUser.role === "NURSE";
    const res = await createSchedule(apiBaseUrl, sessionToken, {
      facilityId: sched.facilityId,
      doctorUserId: isSelfPractitioner ? undefined : sched.doctorUserId,
      dayOfWeek: targetDayOfWeek,
      startTimeUtc: sched.startTimeUtc,
      endTimeUtc: sched.endTimeUtc,
      slotDurationMinutes: sched.slotDurationMinutes,
      visitMode: sched.visitMode,
    });
    if (!res.ok) {
      setBanner({ tone: "error", text: m.shiftPublishFailed(res.error) });
      return;
    }
    setSchedules((prev) => [...prev, res.data.schedule]);
    setBanner({
      tone: "success",
      text: m.shiftPublished(res.data.schedule.doctorName, res.data.schedule.facilityName),
    });
  }

  async function handleDeleteSchedule(sched: DoctorScheduleSummary) {
    if (!sessionToken) return;
    const snapshot = schedules;
    setSchedules((prev) => prev.filter((item) => item.id !== sched.id));
    const res = await deleteSchedule(apiBaseUrl, sessionToken, sched.id);
    if (!res.ok) {
      setSchedules(snapshot);
      setBanner({ tone: "error", text: m.shiftPublishFailed(res.error) });
      return;
    }
    setBanner({ tone: "success", text: ec.scheduleDeleted });
  }

  async function handlePublishSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) {
      setBanner({
        tone: "error",
        text: m.signInToPublish,
      });
      return;
    }

    const isSelfPractitioner =
      currentUser.role === "DOCTOR" || currentUser.role === "NURSE";
    const targetDays = publishWeekdays ? [1, 2, 3, 4, 5] : [schedDay];

    const firstParsed = CreateScheduleSchema.safeParse({
      facilityId: schedFacilityId,
      doctorUserId: isSelfPractitioner
        ? undefined
        : schedDoctorId.trim() || undefined,
      dayOfWeek: targetDays[0],
      startTimeUtc: schedStart,
      endTimeUtc: schedEnd,
      slotDurationMinutes: Number(schedDuration),
      visitMode: schedMode,
    });

    if (!firstParsed.success) {
      setBanner({
        tone: "error",
        text:
          firstParsed.error.issues[0]?.message ?? m.invalidShiftWindow,
      });
      return;
    }

    setBusy(true);
    if (isSelfPractitioner) {
      await upsertDoctorProfile(apiBaseUrl, sessionToken, {
        specialty: specialtyInput,
        licenseNumber: mdLicenseInput,
        consultationFeeMinor: Number(feeMinorInput) || 0,
      });
    }

    const createdResults = await Promise.all(
      targetDays.map((day) =>
        createSchedule(apiBaseUrl, sessionToken, {
          ...firstParsed.data,
          dayOfWeek: day,
        }),
      ),
    );
    setBusy(false);

    const createdSchedules: DoctorScheduleSummary[] = [];
    for (const res of createdResults) {
      if (!res.ok) {
        if (createdSchedules.length > 0) {
          setSchedules((prev) => [...prev, ...createdSchedules]);
        }
        setBanner({
          tone: "error",
          text: m.shiftPublishFailed(res.error),
        });
        return;
      }
      createdSchedules.push(res.data.schedule);
    }

    setSchedules((prev) => [...prev, ...createdSchedules]);
    const publishedCount = createdSchedules.length;
    const lastSchedule = createdSchedules[createdSchedules.length - 1] ?? null;

    if (publishedCount > 1) {
      setBanner({
        tone: "success",
        text: ec.batchShiftsPublished(publishedCount),
      });
    } else if (lastSchedule) {
      setBanner({
        tone: "success",
        text: m.shiftPublished(
          lastSchedule.doctorName,
          lastSchedule.facilityName,
        ),
      });
    }
  }

  async function handleSaveSoapNote(
    input: CreateVisitNoteInput,
  ): Promise<boolean> {
    if (!sessionToken) return false;

    setBusy(true);
    const res = await createVisitNote(apiBaseUrl, sessionToken, input);
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: m.visitNoteError(res.error) });
      return false;
    }

    setVisitNotes((prev) => [res.data.visitNote, ...prev]);
    setBanner({
      tone: "success",
      text: m.visitNoteSaved(res.data.visitNote.patientName),
    });
    return true;
  }

  async function handleIssueRx(
    input: CreatePrescriptionInput,
  ): Promise<boolean> {
    if (!sessionToken) return false;

    setBusy(true);
    const res = await createPrescription(apiBaseUrl, sessionToken, input);
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: m.rxError(res.error) });
      return false;
    }

    setPrescriptions((prev) => [res.data.prescription, ...prev]);
    const warnings = res.data.allergyWarnings ?? [];
    if (warnings.length > 0) {
      setBanner({
        tone: "info",
        text: `${m.rxIssued(res.data.prescription.id.slice(0, 8))} — ${warnings[0]!.message}`,
      });
    } else {
      setBanner({
        tone: "success",
        text: m.rxIssued(res.data.prescription.id.slice(0, 8)),
      });
    }
    return true;
  }

  async function handleCreateLabOrder(
    input: CreateLabOrderInput,
  ): Promise<boolean> {
    if (!sessionToken) return false;
    setBusy(true);
    const res = await createLabOrder(apiBaseUrl, sessionToken, input);
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: m.labOrderError(res.error) });
      return false;
    }
    setLabOrders((prev) => [res.data.labOrder, ...prev]);
    setBanner({
      tone: "success",
      text: m.labOrderQueued(res.data.labOrder.panelName),
    });
    return true;
  }

  async function handleUploadClinicalFile(params: {
    file: File;
    mimeType: ClinicalMediaMimeType;
    mediaCategory: ClinicalMediaCategory;
    labOrderId?: string;
  }): Promise<boolean> {
    if (!sessionToken) return false;

    const effectivePatientId =
      patientUuid.trim() || currentUser?.id || "";
    if (!effectivePatientId) {
      setBanner({
        tone: "error",
        text: m.selectPatientForUpload,
      });
      return false;
    }

    setBusy(true);
    setUploadProgress(5);
    const res = await uploadClinicalMediaEndToEnd({
      apiBaseUrl,
      token: sessionToken,
      patientUserId: effectivePatientId,
      ...(params.labOrderId ? { labOrderId: params.labOrderId } : {}),
      mediaCategory: params.mediaCategory,
      file: params.file,
      mimeType: params.mimeType,
      onProgress: (pct) => setUploadProgress(pct),
    });
    setBusy(false);
    setUploadProgress(null);

    if (!res.ok) {
      setBanner({ tone: "error", text: m.binaryUploadFailed(res.error) });
      return false;
    }

    setLatestPresigned(res.presigned);
    setMediaObjects((prev) => [res.confirmed.mediaObject, ...prev]);
    setBanner({
      tone: "success",
      text: m.uploadedDiagnosticFile(res.confirmed.mediaObject.fileName),
    });
    return true;
  }

  async function handleCompleteLab(orderId: string) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await updateLabOrderStatus(apiBaseUrl, sessionToken, orderId, {
      status: "COMPLETED",
      resultSummary: "Reviewed and signed off in diagnostic portal.",
      ...(latestPresigned
        ? { reportObjectKey: latestPresigned.mediaObject.objectKey }
        : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: m.labUpdateFailed(res.error) });
      return;
    }
    setLabOrders((prev) =>
      prev.map((order) => (order.id === orderId ? res.data.labOrder : order)),
    );
    setBanner({
      tone: "success",
      text: m.labCompleted(res.data.labOrder.panelName),
    });
  }

  async function handleSelectPatientFromCalendar(
    nextPatientId: string,
    patientName: string,
  ) {
    setPatientUuid(nextPatientId);
    setActiveTab("doctor");
    setBanner({
      tone: "info",
      text: m.loadedPatientIntoComposer(patientName),
    });
  }

  const signedInDirectorySpecialty = useMemo(() => {
    if (!currentUser) return null;
    const match = directoryDoctors.find((d) => d.id === currentUser.id);
    return match?.specialty ?? null;
  }, [currentUser, directoryDoctors]);

  const isNursePractitioner = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === "NURSE" || currentUser.role === "CLINIC_STAFF") {
      return true;
    }
    return Boolean(
      currentUser.role === "DOCTOR" &&
        isNursingSpecialty(signedInDirectorySpecialty),
    );
  }, [currentUser, signedInDirectorySpecialty]);

  const isHomeNursePractitioner = Boolean(
    isNursePractitioner &&
      (currentUser?.role === "NURSE" ||
        (signedInDirectorySpecialty &&
          /home|domicile/i.test(signedInDirectorySpecialty))),
  );

  const visibleTabs = useMemo<readonly ClinicalTab[]>(
    () => ["calendar", "doctor", "schedule", "labs", "papers"],
    [],
  );

  const headerTitle = isHomeNursePractitioner
    ? c.header.homeNursingTitle
    : isNursePractitioner
      ? c.header.nursingTitle
      : currentUser?.role === "DOCTOR"
        ? c.header.doctorTitle
        : t("clinical.heading");

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
    setAppointments([]);
    setPatientProfile(null);
    setVisitNotes([]);
    setPrescriptions([]);
    setLabOrders([]);
    setMediaObjects([]);
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={headerTitle}
        countryCode={selectedCountry}
        countryName={formatCountryDisplayName(
          selectedCountry,
          activePack?.name ?? selectedCountry,
          locale,
        )}
        currencyCode={activePack?.currencyCode ?? selectedCountry}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={currentUser}
        guestLabel={
          isNursePractitioner
            ? c.header.guestNursing
            : c.header.guestClinical
        }
        onSignOut={handleSignOut}
        actions={
          currentUser && sessionToken && !isPendingStaff && isAuthorizedClinicalViewer ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshClinicalData(sessionToken, selectedCountry)}
              className="inline-flex h-10 items-center rounded-xl border border-[#D7E4F2] bg-white px-4 text-xs font-semibold text-[#0F243E] shadow-2xs transition hover:border-[#0066CC] hover:bg-[#F3F8FD] hover:text-[#0066CC] disabled:opacity-50"
            >
              {c.header.syncBtn}
            </button>
          ) : undefined
        }
      />

      <VerificationGateNotice user={currentUser} compact />

      <WorkspaceRoleGuard
        user={currentUser}
        hydrated={sessionHydrated}
        allowedRoles={allowedWorkspaceRoles}
        workspaceTitle={c.header.guardClinicalTitle}
        requiredRoleDescription={c.header.guardClinicalRoles}
        allowPendingMatchingRole
      >
      <UiTabBar
        ariaLabel={c.header.tabsAria}
        activeTab={activeTab}
        onSelect={setActiveTab}
        tabs={[
          ...(visibleTabs.includes("calendar")
            ? [
                {
                  id: "calendar" as const,
                  label: t("clinical.tabCalendar"),
                  icon: <Calendar className="h-3.5 w-3.5" aria-hidden="true" />,
                },
              ]
            : []),
          ...(visibleTabs.includes("doctor")
            ? [
                {
                  id: "doctor" as const,
                  label: t("clinical.tabDoctor"),
                  icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />,
                },
              ]
            : []),
          ...(visibleTabs.includes("schedule")
            ? [
                {
                  id: "schedule" as const,
                  label: t("clinical.tabSchedule"),
                  icon: <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />,
                },
              ]
            : []),
          ...(visibleTabs.includes("labs")
            ? [
                {
                  id: "labs" as const,
                  label: t("clinical.tabLabs"),
                  icon: <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />,
                },
              ]
            : []),
          ...(visibleTabs.includes("papers") && currentUser
            ? [
                {
                  id: "papers" as const,
                  label: ec.tabPapers,
                  icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
                },
              ]
            : []),
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className={`min-w-0 space-y-6 ${
            activeTab === "papers" ? "lg:col-span-8" : "lg:col-span-12"
          }`}
        >
          {activeTab === "calendar" ? (
            <DoctorCalendarAgenda
              currentUser={currentUser}
              appointments={appointments}
              schedules={schedules}
              selectedPatientId={patientUuid}
              patientProfile={patientProfile}
              patientProfileLoading={patientProfileLoading}
              busy={busy}
              isLockedPendingVerification={isPendingStaff}
              onSelectPatientForConsultation={handleSelectPatientFromCalendar}
              onInspectPatient={(pid) => setPatientUuid(pid)}
              onTransitionAppointment={handleTransitionAppointment}
              onUpdateSchedule={handleUpdateSchedule}
              onJumpToShifts={() => setActiveTab("schedule")}
            />
          ) : activeTab === "schedule" ? (
            <VisualScheduleBuilder
              currentUser={currentUser}
              schedules={schedules}
              clinicOptions={clinicFacilityPickerOptions}
              doctorOptions={doctorPickerOptions}
              currencyCode={activePack?.currencyCode ?? selectedCountry}
              canManageSchedule={canManageSchedule}
              isPendingStaff={isPendingStaff}
              busy={busy}
              showPracticeProfileFields={
                currentUser?.role === "DOCTOR" || currentUser?.role === "NURSE"
              }
              specialtyInput={specialtyInput}
              licenseInput={mdLicenseInput}
              feeMinorInput={feeMinorInput}
              schedFacilityId={schedFacilityId}
              schedDoctorId={schedDoctorId}
              schedDay={schedDay}
              schedStart={schedStart}
              schedEnd={schedEnd}
              schedDuration={schedDuration}
              schedMode={schedMode}
              publishWeekdays={publishWeekdays}
              onSpecialtyChange={(next) => {
                setSpecialtyInput(next);
                if (isNursingSpecialty(next)) {
                  setSchedMode("HOME_VISIT");
                } else if (schedMode === "HOME_VISIT") {
                  setSchedMode("IN_PERSON");
                }
              }}
              onLicenseChange={setMdLicenseInput}
              onFeeChange={setFeeMinorInput}
              onFacilityChange={setSchedFacilityId}
              onDoctorChange={setSchedDoctorId}
              onDayChange={setSchedDay}
              onStartChange={setSchedStart}
              onEndChange={setSchedEnd}
              onDurationChange={setSchedDuration}
              onModeChange={setSchedMode}
              onPublishWeekdaysChange={setPublishWeekdays}
              onSubmitPublish={(e) => void handlePublishSchedule(e)}
              onToggleSchedule={(sched) => void handleToggleSchedule(sched)}
              onDeleteSchedule={(sched) => void handleDeleteSchedule(sched)}
              onUpdateSchedule={handleUpdateSchedule}
              onDuplicateSchedule={handleDuplicateSchedule}
              heading={c.schedule.heading}
              signInHint={c.schedule.signInHint}
              publishBtnLabel={c.schedule.publishBtn}
              publishWeekdaysLabel={ec.publishWeekdaysLabel}
              activeStatusLabel={ec.activeStatus}
              pausedStatusLabel={ec.pausedStatus}
              pauseBtnLabel={ec.pauseBtn}
              resumeBtnLabel={ec.resumeBtn}
              deleteBtnLabel={ec.deleteBtn}
              clinicLabel={c.schedule.clinicLabel}
              clinicPlaceholder={c.schedule.clinicPlaceholder}
              clinicEmpty={c.schedule.clinicEmpty}
              practitionerLabel={c.schedule.practitionerLabel}
              practitionerPlaceholder={c.schedule.practitionerPlaceholder}
              practitionerEmpty={c.schedule.practitionerEmpty}
              specialtyLabel={c.schedule.specialtyLabel}
              licenseLabel={c.schedule.licenseLabel}
              feeLabel={c.schedule.feeLabel(activePack?.currencyCode ?? selectedCountry)}
            />
          ) : null}

          {activeTab === "doctor" ? (
            <ClinicalConsultationDesk
              currentUser={currentUser}
              selectedCountry={selectedCountry}
              patientOptions={patientPickerOptions}
              patientUuid={patientUuid}
              onPatientChange={setPatientUuid}
              patientProfile={patientProfile}
              patientProfileLoading={patientProfileLoading}
              visitNotes={visitNotes}
              prescriptions={prescriptions}
              busy={busy}
              isPendingStaff={isPendingStaff}
              hasSession={Boolean(sessionToken)}
              onSaveVisitNote={handleSaveSoapNote}
              onIssuePrescription={handleIssueRx}
              onJumpToLabs={() => setActiveTab("labs")}
            />
          ) : null}

          {activeTab === "labs" ? (
            <ClinicalLabsImagingDesk
              currentUser={currentUser}
              selectedCountry={selectedCountry}
              patientOptions={patientPickerOptions}
              patientUuid={patientUuid}
              onPatientChange={setPatientUuid}
              labFacilityOptions={labFacilityPickerOptions}
              labFacilityId={labFacilityId}
              onLabFacilityChange={setLabFacilityId}
              labOrders={labOrders}
              mediaObjects={mediaObjects}
              latestPresigned={latestPresigned}
              uploadProgress={uploadProgress}
              busy={busy}
              isPendingStaff={isPendingStaff}
              hasSession={Boolean(sessionToken)}
              onCreateLabOrder={handleCreateLabOrder}
              onCompleteLabOrder={handleCompleteLab}
              onUploadClinicalFile={handleUploadClinicalFile}
            />
          ) : null}

          {activeTab === "papers" && currentUser && sessionToken ? (
            <ClinicalPapersPanel
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              user={currentUser}
              currencyCode={activePack?.currencyCode ?? selectedCountry}
              isPendingStaff={isPendingStaff}
              facilityName={
                facilities.find((f) => f.id === currentUser.facilityId)?.name ??
                directoryClinics.find((f) => f.id === currentUser.facilityId)?.name ??
                null
              }
              facilityKind={
                facilities.find((f) => f.id === currentUser.facilityId)?.kind ??
                directoryClinics.find((f) => f.id === currentUser.facilityId)?.kind ??
                "CLINIC"
              }
              userDocs={userDocs}
              facilityDocs={facilityDocs}
              specialtyInput={specialtyInput}
              mdLicenseInput={mdLicenseInput}
              feeMinorInput={feeMinorInput}
              busy={busy}
              onSpecialtyChange={setSpecialtyInput}
              onLicenseChange={setMdLicenseInput}
              onFeeChange={setFeeMinorInput}
              onSavePracticeProfile={handleSavePracticeProfile}
              onBusyChange={setBusy}
              onDocumentsUpdated={() => refreshPapersData(sessionToken, currentUser)}
              onFeedback={(tone, text) => setBanner({ tone, text })}
            />
          ) : null}
        </div>

        {activeTab === "papers" ? (
        <aside className="min-w-0 space-y-5 lg:col-span-4">
          {currentUser && !isPendingStaff && patientProfile ? (
            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
              <h2 className="pb-3 font-editorial text-base font-bold text-[#0F243E]">
                {c.aside.safetyTitle}
              </h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] px-3.5 py-2.5">
                  <span className="text-[#556E89]">{c.aside.bloodTypeLabel}</span>
                  <span className="rounded-full bg-[#E6F7F4] px-2.5 py-0.5 font-mono-tabular font-bold text-[#0B6B5C]">
                    {patientProfile.bloodType && patientProfile.bloodType !== "UNKNOWN"
                      ? patientProfile.bloodType
                      : c.aside.pendingVerification}
                  </span>
                </div>
                {patientProfile.allergies.length > 0 ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-rose-950">
                    <p className="font-semibold">{c.aside.recordedAllergies}</p>
                    <p className="mt-0.5 text-rose-900">
                      {patientProfile.allergies
                        .map(
                          (alg) =>
                            `${alg.allergen} (${
                              c.enums.severity[alg.severity] ?? alg.severity
                            })`,
                        )
                        .join(", ")}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-[#B2E5DC] bg-[#E6F7F4]/70 px-3.5 py-2.5 font-medium text-[#0B6B5C]">
                    {c.aside.noDrugAllergies}
                  </p>
                )}
                {patientProfile.chronicConditions.length > 0 ? (
                  <p className="px-1 text-[#2F4661]">
                    <span className="font-semibold text-[#0F243E]">
                      {c.aside.conditionsPrefix}
                    </span>{" "}
                    {patientProfile.chronicConditions.join(", ")}
                  </p>
                ) : null}
                {patientProfile.currentMedications.length > 0 ? (
                  <p className="px-1 text-[#2F4661]">
                    <span className="font-semibold text-[#0F243E]">
                      {c.aside.activeRxPrefix}
                    </span>{" "}
                    {patientProfile.currentMedications.join(", ")}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
            <h2 className="pb-3 font-editorial text-sm font-bold text-[#0F243E]">
              {c.aside.clinicalMetricsTitle}
            </h2>
            <dl className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] p-3.5">
                <dt className="text-[11px] text-[#556E89]">{c.aside.scheduledVisits}</dt>
                <dd className="mt-1 font-mono-tabular text-xl font-bold text-[#0F243E]">
                  {
                    appointments.filter(
                      (a) => a.status === "CONFIRMED" || a.status === "CHECKED_IN",
                    ).length
                  }
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] p-3.5">
                <dt className="text-[11px] text-[#556E89]">{c.aside.activeLabs}</dt>
                <dd className="mt-1 font-mono-tabular text-xl font-bold text-[#0066CC]">
                  {labOrders.length}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] p-3.5">
                <dt className="text-[11px] text-[#556E89]">{c.aside.ePrescriptions}</dt>
                <dd className="mt-1 font-mono-tabular text-xl font-bold text-[#0F243E]">
                  {prescriptions.length}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] p-3.5">
                <dt className="text-[11px] text-[#556E89]">{c.aside.uploadedScans}</dt>
                <dd className="mt-1 font-mono-tabular text-xl font-bold text-[#0F243E]">
                  {mediaObjects.length}
                </dd>
              </div>
            </dl>
            {canManageSchedule ? (
              <UiButton
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("schedule")}
                className="mt-3.5 w-full bg-white hover:bg-[#F3F8FD]"
              >
                {c.aside.manageShiftsBtn}
              </UiButton>
            ) : null}
          </section>
        </aside>
        ) : null}
      </div>
      </WorkspaceRoleGuard>
    </div>
  );
}
