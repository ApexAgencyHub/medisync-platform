"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  ClinicalMediaMimeTypeSchema,
  CreateScheduleSchema,
  LabUrgencySchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  VisitModeSchema,
  type AuthenticatedUser,
  type ClinicalMediaMimeType,
  type ClinicalMediaObjectSummary,
  type CountryPack,
  type DirectoryDoctorSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type DoctorScheduleSummary,
  type FacilitySummary,
  type LabOrderSummary,
  type LabUrgency,
  type PresignedUploadResponse,
  type PrescriptionSummary,
  type VisitMode,
  type VisitNoteSummary,
} from "@medisync/contracts";
import { listFacilities } from "@/features/auth-portal";
import {
  createSchedule,
  fetchSchedules,
  upsertDoctorProfile,
} from "@/features/booking";
import {
  FileUploadDropzone,
  formatByteSize,
  inferUploadMimeType,
  uploadClinicalMediaEndToEnd,
} from "@/features/media-certifications";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryFacilities,
  fetchDirectoryPatients,
} from "@/shared/api/directory-client";
import { formatClinicalFileType } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import {
  ActiveRegionPill,
  SessionAccountBar,
  StatusBanner,
  UiButton,
  UiInput,
  UiSelect,
} from "@/shared/ui/primitives";
import {
  clearStoredSession,
  readStoredSession,
} from "@/shared/auth/session-storage";
import {
  CalendarClock,
  ClipboardList,
  Eye,
  FileText,
  FileUp,
  FlaskConical,
  ImageIcon,
  Pill,
  QrCode,
} from "lucide-react";
import {
  createLabOrder,
  createPrescription,
  createVisitNote,
  dispensePrescription,
  fetchClinicalMedia,
  fetchLabOrders,
  fetchPrescriptions,
  fetchVisitNotes,
  updateLabOrderStatus,
  verifyPrescriptionQr,
} from "../api-client";

type ClinicalTab = "doctor" | "schedule" | "pharmacy" | "labs";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

interface ClinicalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

export function ClinicalWorkspace({
  packs,
  apiBaseUrl,
}: ClinicalWorkspaceProps) {
  const { t } = useLocale();
  const { openImage } = useImageLightbox();
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [activeTab, setActiveTab] = useState<ClinicalTab>("doctor");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );

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

  // Clinic & Practitioner Shift Publishing
  const [specialtyInput, setSpecialtyInput] = useState("Cardiology");
  const [mdLicenseInput, setMdLicenseInput] = useState("INTL-MD-44021");
  const [feeMinorInput, setFeeMinorInput] = useState("35000");
  const [schedFacilityId, setSchedFacilityId] = useState("");
  const [schedDoctorId, setSchedDoctorId] = useState("");
  const [schedDay, setSchedDay] = useState(1);
  const [schedStart, setSchedStart] = useState("09:00");
  const [schedEnd, setSchedEnd] = useState("12:00");
  const [schedDuration, setSchedDuration] = useState("30");
  const [schedMode, setSchedMode] = useState<VisitMode>("IN_PERSON");

  // Doctor SOAP + Order Forms
  const [patientUuid, setPatientUuid] = useState("");
  const [icd10Input, setIcd10Input] = useState("J06.9");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  const [rxMedName, setRxMedName] = useState("Amoxicillin");
  const [rxDosage, setRxDosage] = useState("500 mg");
  const [rxFrequency, setRxFrequency] = useState("Twice daily");
  const [rxDurationDays, setRxDurationDays] = useState("7");

  // Pharmacy QR Verification
  const [qrInput, setQrInput] = useState("");
  const [verifiedRx, setVerifiedRx] = useState<PrescriptionSummary | null>(
    null,
  );
  const [dispenseNote, setDispenseNote] = useState("");

  // Lab Order & Real Binary S3/MinIO Upload
  const [labFacilityId, setLabFacilityId] = useState("");
  const [labPanelName, setLabPanelName] = useState("Complete Blood Count (CBC)");
  const [labUrgency, setLabUrgency] = useState<LabUrgency>("ROUTINE");

  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedLabOrderForUpload, setSelectedLabOrderForUpload] =
    useState<string>("");
  const [uploadMime, setUploadMime] =
    useState<ClinicalMediaMimeType>("application/pdf");
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
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const activePack =
    packs.find((pack) => pack.code === selectedCountry) ?? packs[0];

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedCountry(stored.user.countryCode);
      if (stored.user.role === "PATIENT") {
        setPatientUuid(stored.user.id);
      }
      if (stored.user.role === "DOCTOR") {
        setSchedDoctorId(stored.user.id);
      }
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) setApiOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshClinicalData(token: string, countryCode: string) {
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
    ] = await Promise.all([
      fetchVisitNotes(apiBaseUrl, token, countryCode),
      fetchPrescriptions(apiBaseUrl, token, countryCode),
      fetchLabOrders(apiBaseUrl, token, countryCode),
      fetchClinicalMedia(apiBaseUrl, token, countryCode),
      fetchDirectoryPatients(apiBaseUrl, token, { countryCode }),
      fetchDirectoryFacilities(apiBaseUrl, {
        countryCode,
        kind: "DIAGNOSTIC_LAB",
      }),
      fetchDirectoryDoctors(apiBaseUrl, { countryCode }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode }),
      listFacilities(apiBaseUrl, token, countryCode),
      fetchSchedules(apiBaseUrl, { countryCode }),
    ]);

    if (notesRes.ok) setVisitNotes(notesRes.data.visitNotes);
    if (rxRes.ok) setPrescriptions(rxRes.data.prescriptions);
    if (labsRes.ok) setLabOrders(labsRes.data.labOrders);
    if (mediaRes.ok) setMediaObjects(mediaRes.data.mediaObjects);
    if (patDirRes.ok) {
      setDirectoryPatients(patDirRes.patients);
      if (!patientUuid && patDirRes.patients[0]) {
        setPatientUuid(patDirRes.patients[0].id);
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
    }
    if (clinicsRes.ok) {
      setDirectoryClinics(clinicsRes.facilities);
      if (!schedFacilityId && clinicsRes.facilities[0]) {
        setSchedFacilityId(clinicsRes.facilities[0].id);
      }
    }
    if (facListRes.ok) {
      setFacilities(facListRes.data.facilities);
      if (!schedFacilityId && facListRes.data.facilities[0]) {
        setSchedFacilityId(facListRes.data.facilities[0].id);
      }
    }
    if (schedRes.ok) {
      setSchedules(schedRes.data.schedules);
    }
  }

  useEffect(() => {
    if (!apiOnline) return;
    let active = true;

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

    if (sessionToken) {
      void refreshClinicalData(sessionToken, selectedCountry);
    }

    return () => {
      active = false;
    };
  }, [apiOnline, apiBaseUrl, selectedCountry, sessionToken]);

  const patientPickerOptions = useMemo(
    () =>
      directoryPatients.map((p) => ({
        id: p.id,
        label: p.fullName,
        sublabel: `${p.email} · ${p.countryCode}`,
      })),
    [directoryPatients],
  );

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
        sublabel: `${d.specialty}${d.facilityName ? ` · ${d.facilityName}` : ""}`,
      })),
    [directoryDoctors],
  );

  const clinicFacilityPickerOptions = useMemo(() => {
    if (facilities.length > 0) {
      return facilities.map((fac) => ({
        id: fac.id,
        label: fac.name,
        sublabel: `${fac.kind} · ${fac.verificationStatus}`,
      }));
    }
    return directoryClinics.map((fac) => ({
      id: fac.id,
      label: fac.name,
      sublabel: `${fac.kind} · ${fac.openStatus}`,
    }));
  }, [facilities, directoryClinics]);

  const canManageSchedule =
    currentUser !== null &&
    ["DOCTOR", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
      currentUser.role,
    );

  async function handlePublishSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) {
      setBanner({
        tone: "error",
        text: "Sign in on the Care Portal as a Doctor or Coordinator to publish shifts.",
      });
      return;
    }

    const parsedSchedule = CreateScheduleSchema.safeParse({
      facilityId: schedFacilityId,
      doctorUserId:
        currentUser.role === "DOCTOR"
          ? undefined
          : schedDoctorId.trim() || undefined,
      dayOfWeek: schedDay,
      startTimeUtc: schedStart,
      endTimeUtc: schedEnd,
      slotDurationMinutes: Number(schedDuration),
      visitMode: schedMode,
    });

    if (!parsedSchedule.success) {
      setBanner({
        tone: "error",
        text:
          parsedSchedule.error.issues[0]?.message ?? "Invalid shift window.",
      });
      return;
    }

    setBusy(true);
    if (currentUser.role === "DOCTOR") {
      await upsertDoctorProfile(apiBaseUrl, sessionToken, {
        specialty: specialtyInput,
        licenseNumber: mdLicenseInput,
        consultationFeeMinor: Number(feeMinorInput) || 0,
      });
    }

    const res = await createSchedule(
      apiBaseUrl,
      sessionToken,
      parsedSchedule.data,
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Failed to publish shift: ${res.error}`,
      });
      return;
    }

    setBanner({
      tone: "success",
      text: `Published shift for ${res.data.schedule.doctorName} at ${res.data.schedule.facilityName}.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handleSaveSoapNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) return;

    setBusy(true);
    const res = await createVisitNote(apiBaseUrl, sessionToken, {
      patientUserId: patientUuid.trim(),
      icd10Codes: icd10Input
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      subjective,
      objective,
      assessment,
      plan,
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Visit note error: ${res.error}` });
      return;
    }

    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setBanner({
      tone: "success",
      text: `Consultation visit note saved for ${res.data.visitNote.patientName}.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handleIssueRx(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) return;

    setBusy(true);
    const res = await createPrescription(apiBaseUrl, sessionToken, {
      patientUserId: patientUuid.trim(),
      medications: [
        {
          name: rxMedName.trim(),
          dosage: rxDosage.trim(),
          frequency: rxFrequency.trim(),
          durationDays: Number(rxDurationDays) || 7,
        },
      ],
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `E-Rx error: ${res.error}` });
      return;
    }

    setQrInput(res.data.prescription.qrToken);
    setBanner({
      tone: "success",
      text: `Issued signed QR e-prescription (${res.data.prescription.id.slice(0, 8)}).`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handleVerifyQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) return;

    setBusy(true);
    const res = await verifyPrescriptionQr(
      apiBaseUrl,
      sessionToken,
      qrInput.trim(),
    );
    setBusy(false);

    if (!res.ok) {
      setVerifiedRx(null);
      setBanner({ tone: "error", text: `QR rejected: ${res.error}` });
      return;
    }

    setVerifiedRx(res.data.prescription);
    setBanner({
      tone: "success",
      text: `Prescription signature verified for ${res.data.prescription.patientName}.`,
    });
  }

  async function handleDispense(prescriptionId: string) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await dispensePrescription(
      apiBaseUrl,
      sessionToken,
      prescriptionId,
      {
        ...(dispenseNote.trim()
          ? { dispensingNote: dispenseNote.trim() }
          : {}),
      },
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text:
          res.status === 409
            ? "Double-dispensing blocked: prescription has already been fulfilled."
            : `Dispense failed: ${res.error}`,
      });
      return;
    }

    setVerifiedRx(res.data.prescription);
    setBanner({
      tone: "success",
      text: `Medication prescription marked as dispensed.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handleCreateLabOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) return;
    setBusy(true);
    const res = await createLabOrder(apiBaseUrl, sessionToken, {
      patientUserId: patientUuid.trim(),
      facilityId: labFacilityId.trim(),
      panelName: labPanelName.trim(),
      urgency: labUrgency,
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Lab order error: ${res.error}` });
      return;
    }
    setBanner({
      tone: "success",
      text: `Lab order queued for ${res.data.labOrder.panelName}.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  async function handlePresignUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !selectedUploadFile) return;

    const effectivePatientId =
      patientUuid.trim() || currentUser?.id || "";
    if (!effectivePatientId) {
      setBanner({
        tone: "error",
        text: "Select a patient (or sign in as a patient) before uploading a medical file.",
      });
      return;
    }

    setBusy(true);
    setUploadProgress(5);
    const res = await uploadClinicalMediaEndToEnd({
      apiBaseUrl,
      token: sessionToken,
      patientUserId: effectivePatientId,
      ...(selectedLabOrderForUpload
        ? { labOrderId: selectedLabOrderForUpload }
        : {}),
      file: selectedUploadFile,
      mimeType: uploadMime,
      onProgress: (pct) => setUploadProgress(pct),
    });
    setBusy(false);
    setUploadProgress(null);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Binary upload failed: ${res.error}` });
      return;
    }

    setLatestPresigned(res.presigned);
    setSelectedUploadFile(null);
    setBanner({
      tone: "success",
      text: `Uploaded & verified diagnostic file ${res.confirmed.mediaObject.fileName}.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
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
      setBanner({ tone: "error", text: `Lab update failed: ${res.error}` });
      return;
    }
    setBanner({
      tone: "success",
      text: `Lab order ${res.data.labOrder.panelName} completed.`,
    });
    await refreshClinicalData(sessionToken, selectedCountry);
  }

  return (
    <div dir={activePack?.direction ?? "ltr"} className="space-y-6">
      <SessionAccountBar
        session={
          sessionToken && currentUser
            ? { token: sessionToken, user: currentUser }
            : null
        }
        onSignOut={() => {
          clearStoredSession();
          setSessionToken(null);
          setCurrentUser(null);
          setVisitNotes([]);
          setPrescriptions([]);
          setLabOrders([]);
          setMediaObjects([]);
        }}
        prompt="Sign in via Portal to document consultations, publish shifts, dispense QR prescriptions, or upload lab scans."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              {t("clinical.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("clinical.heading")}
            </h1>
            <p className="text-sm text-slate-600">
              {t("clinical.subtitle")} ({activePack?.name ?? selectedCountry})
            </p>
          </div>

          <ActiveRegionPill
            code={selectedCountry}
            name={activePack?.name ?? "Morocco"}
            currencyCode={activePack?.currencyCode}
            emergencyHotline={activePack?.emergencyHotlines.ambulance}
          />
        </div>

        <div
          role="tablist"
          aria-label="Clinical Workspace Modules"
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "doctor"}
            onClick={() => setActiveTab("doctor")}
            className={
              activeTab === "doctor"
                ? "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white"
                : "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700"
            }
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("clinical.tabDoctor")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            onClick={() => setActiveTab("schedule")}
            className={
              activeTab === "schedule"
                ? "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white"
                : "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700"
            }
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("clinical.tabSchedule")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pharmacy"}
            onClick={() => setActiveTab("pharmacy")}
            className={
              activeTab === "pharmacy"
                ? "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white"
                : "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700"
            }
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("clinical.tabPharmacy")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "labs"}
            onClick={() => setActiveTab("labs")}
            className={
              activeTab === "labs"
                ? "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white"
                : "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700"
            }
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("clinical.tabLabs")}</span>
          </button>
        </div>

        {banner ? (
          <StatusBanner
            tone={banner.tone}
            message={banner.text}
            className="mt-4"
          />
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {activeTab === "schedule" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                  Publish Multi-Clinic Shift Window
                </h2>
                {!canManageSchedule ? (
                  <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    Sign in via the Care Portal as a Doctor, Clinic Coordinator,
                    Hospital Director, or Compliance Admin to manage weekly
                    provider shifts.
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => void handlePublishSchedule(e)}
                    className="mt-4 space-y-3 text-xs"
                  >
                    {currentUser?.role === "DOCTOR" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block font-semibold text-slate-700">
                            Specialty
                          </label>
                          <UiInput
                            type="text"
                            value={specialtyInput}
                            onChange={(e) => setSpecialtyInput(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-semibold text-slate-700">
                            Medical License #
                          </label>
                          <UiInput
                            type="text"
                            value={mdLicenseInput}
                            onChange={(e) => setMdLicenseInput(e.target.value)}
                            className="font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-semibold text-slate-700">
                            Consultation Fee ({activePack?.currencyCode ?? selectedCountry} minor)
                          </label>
                          <UiInput
                            type="number"
                            min={0}
                            value={feeMinorInput}
                            onChange={(e) => setFeeMinorInput(e.target.value)}
                            className="font-mono-tabular"
                          />
                        </div>
                      </div>
                    ) : (
                      <EntityPicker
                        id="clin-schedule-doctor-picker"
                        label="Doctor or Nurse"
                        placeholder="Filter practitioner by name or specialty..."
                        emptyLabel="No practitioners listed in this region"
                        options={doctorPickerOptions}
                        value={schedDoctorId}
                        onChange={setSchedDoctorId}
                        required
                      />
                    )}

                    <EntityPicker
                      id="clin-schedule-facility-picker"
                      label="Clinic or Hospital"
                      placeholder="Filter facility by name..."
                      emptyLabel="No verified facilities in this region"
                      options={clinicFacilityPickerOptions}
                      value={schedFacilityId}
                      onChange={setSchedFacilityId}
                      required
                    />

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          Day of Week
                        </label>
                        <UiSelect
                          value={schedDay}
                          onChange={(e) => setSchedDay(Number(e.target.value))}
                        >
                          {WEEKDAY_LABELS.map((label, idx) => (
                            <option key={label} value={idx}>
                              {label}
                            </option>
                          ))}
                        </UiSelect>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          Visit Format
                        </label>
                        <UiSelect
                          value={schedMode}
                          onChange={(e) =>
                            setSchedMode(VisitModeSchema.parse(e.target.value))
                          }
                        >
                          <option value="IN_PERSON">Clinic Visit</option>
                          <option value="TELEHEALTH">Video Visit</option>
                        </UiSelect>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          Start Time
                        </label>
                        <UiInput
                          type="text"
                          value={schedStart}
                          onChange={(e) => setSchedStart(e.target.value)}
                          className="font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">
                          End Time
                        </label>
                        <UiInput
                          type="text"
                          value={schedEnd}
                          onChange={(e) => setSchedEnd(e.target.value)}
                          className="font-mono-tabular"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                      <div className="w-40">
                        <label className="mb-1 block font-semibold text-slate-700">
                          Slot Duration (min)
                        </label>
                        <UiInput
                          type="number"
                          min={10}
                          max={120}
                          value={schedDuration}
                          onChange={(e) => setSchedDuration(e.target.value)}
                          className="font-mono-tabular"
                        />
                      </div>
                      <UiButton type="submit" disabled={busy}>
                        Publish Clinic Schedule Window
                      </UiButton>
                    </div>
                  </form>
                )}

                {schedules.length > 0 ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Active Clinic Rosters ({schedules.length})
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {schedules.slice(0, 8).map((sched) => (
                        <li
                          key={sched.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <span className="flex items-center gap-2 font-semibold text-slate-900">
                            <EntityAvatar
                              name={sched.doctorName}
                              role="DOCTOR"
                              size="xs"
                            />
                            <span>
                              {sched.doctorName} · {sched.facilityName}
                            </span>
                          </span>
                          <span className="font-mono-tabular text-slate-600">
                            {WEEKDAY_LABELS[sched.dayOfWeek]}{" "}
                            {sched.startTimeUtc}–{sched.endTimeUtc} (
                            {sched.slotDurationMinutes}m)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === "doctor" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                  Consultation Visit Notes & QR E-Prescription
                </h2>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <EntityPicker
                    id="clin-patient-uuid"
                    label="Patient"
                    placeholder="Filter patient by name or email..."
                    emptyLabel="Sign in to browse patients in this region"
                    options={patientPickerOptions}
                    value={patientUuid}
                    onChange={setPatientUuid}
                    disabled={currentUser?.role === "PATIENT"}
                  />
                  <div>
                    <label
                      htmlFor="clin-icd10"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Diagnosis Codes (Optional, e.g. J06.9)
                    </label>
                    <input
                      id="clin-icd10"
                      type="text"
                      value={icd10Input}
                      onChange={(e) => setIcd10Input(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs"
                    />
                  </div>
                </div>

                <form
                  onSubmit={(e) => void handleSaveSoapNote(e)}
                  className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Subjective
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      placeholder="Chief complaint & symptom timeline"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Objective
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="Exam findings & vitals"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Assessment
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      placeholder="Primary clinical impression"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Plan
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      placeholder="Therapy, labs & follow-up"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={busy || !sessionToken}
                      className="min-h-[38px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                    >
                      {t("clinical.saveNote")}
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={(e) => void handleIssueRx(e)}
                  className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Medication
                    </label>
                    <input
                      type="text"
                      required
                      value={rxMedName}
                      onChange={(e) => setRxMedName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Dosage
                    </label>
                    <input
                      type="text"
                      required
                      value={rxDosage}
                      onChange={(e) => setRxDosage(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Frequency
                    </label>
                    <input
                      type="text"
                      required
                      value={rxFrequency}
                      onChange={(e) => setRxFrequency(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Days
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={rxDurationDays}
                      onChange={(e) => setRxDurationDays(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="submit"
                      disabled={busy || !sessionToken}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t("clinical.issueRx")}</span>
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900">
                  Consultation History ({visitNotes.length})
                </h3>
                {visitNotes.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Sign in as a Doctor or Patient in {selectedCountry} to view
                    consultation visit notes.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {visitNotes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold text-slate-900">
                            <EntityAvatar
                              name={note.doctorName}
                              role="DOCTOR"
                              size="xs"
                            />
                            <span>{note.patientName} · Dr. {note.doctorName}</span>
                          </span>
                          <span className="font-mono-tabular text-teal-800">
                            {note.icd10Codes.join(", ") || "UNSPECIFIED"}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700">
                          <strong>Assessment:</strong> {note.assessment} —{" "}
                          <strong>Plan:</strong> {note.plan}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {prescriptions.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    Scannable E-Prescriptions &amp; QR Codes ({prescriptions.length})
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    {prescriptions.map((rx) => (
                      <QrPrescriptionCard
                        key={rx.id}
                        prescription={rx}
                        onUseForDispense={(token) => {
                          setQrInput(token);
                          setActiveTab("pharmacy");
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "pharmacy" ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                Pharmacy QR Verification & Safe Dispensing
              </h2>

              <form onSubmit={(e) => void handleVerifyQr(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="rx-qr-token"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Prescription QR Code
                  </label>
                  <textarea
                    id="rx-qr-token"
                    rows={3}
                    required
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Paste prescription code from the patient's digital QR card..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy || !sessionToken}
                    className="min-h-[38px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                  >
                    Verify Prescription
                  </button>
                  <span className="text-xs text-slate-600">
                    Every digital prescription is checked for authenticity and cannot be dispensed twice.
                  </span>
                </div>
              </form>

              {verifiedRx ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-teal-950">
                      Patient: {verifiedRx.patientName} · Rx{" "}
                      {verifiedRx.id.slice(0, 8)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 font-mono-tabular font-bold text-teal-900">
                      {verifiedRx.status}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-slate-700">
                    {verifiedRx.medications.map((med, idx) => (
                      <li key={`${med.name}-${idx}`}>
                        {med.name} — {med.dosage} ({med.frequency}, {med.durationDays}d)
                      </li>
                    ))}
                  </ul>
                  {verifiedRx.status === "ISSUED" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder="Dispensing batch note (optional)"
                        value={dispenseNote}
                        onChange={(e) => setDispenseNote(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDispense(verifiedRx.id)}
                        className="min-h-[36px] rounded-lg bg-emerald-700 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-800"
                      >
                        Confirm Dispensed
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Recent Prescriptions ({prescriptions.length})
                </h3>
                <div className="mt-2 space-y-2.5">
                  {prescriptions.map((rx) => (
                    <QrPrescriptionCard
                      key={rx.id}
                      prescription={rx}
                      onUseForDispense={(token) => setQrInput(token)}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "labs" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                  {t("clinical.labsHeading")}
                </h2>

                <form
                  onSubmit={(e) => void handlePresignUpload(e)}
                  className="mt-4 space-y-3"
                >
                  <FileUploadDropzone
                    id="s3-clinical-file"
                    label="Diagnostic Scan / Lab PDF Binary Upload"
                    hint="Drag & drop X-ray PNG/JPG/WebP, DICOM, or lab report PDF"
                    accept={ALLOWED_MEDIA_MIME_TYPES.join(",")}
                    maxBytes={MAX_CLINICAL_UPLOAD_BYTES}
                    selectedFile={selectedUploadFile}
                    progressPercent={uploadProgress}
                    disabled={busy || !sessionToken}
                    onFileSelected={(file) => {
                      setSelectedUploadFile(file);
                      if (file) {
                        const detected = inferUploadMimeType(
                          file,
                          ALLOWED_MEDIA_MIME_TYPES,
                        );
                        if (detected) {
                          setUploadMime(
                            ClinicalMediaMimeTypeSchema.parse(detected),
                          );
                        }
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="s3-mime-type"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Document Format
                      </label>
                      <select
                        id="s3-mime-type"
                        value={uploadMime}
                        onChange={(e) =>
                          setUploadMime(
                            ClinicalMediaMimeTypeSchema.parse(e.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                      >
                        {ALLOWED_MEDIA_MIME_TYPES.map((mime) => (
                          <option key={mime} value={mime}>
                            {formatClinicalFileType(mime)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="s3-lab-order-link"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Link to Lab Order (Optional)
                      </label>
                      <select
                        id="s3-lab-order-link"
                        value={selectedLabOrderForUpload}
                        onChange={(e) =>
                          setSelectedLabOrderForUpload(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                      >
                        <option value="">Standalone clinical file</option>
                        {labOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.panelName} ({order.patientName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={busy || !sessionToken || !selectedUploadFile}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-900 active:scale-95 disabled:opacity-60"
                    >
                      <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t("clinical.uploadScanBtn")}</span>
                    </button>
                  </div>
                </form>

                {latestPresigned ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                    <p className="font-semibold text-emerald-950">
                      Diagnostic report uploaded and verified: {latestPresigned.mediaObject.fileName}
                    </p>
                  </div>
                ) : null}

                <form
                  onSubmit={(e) => void handleCreateLabOrder(e)}
                  className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3"
                >
                  <div>
                    <EntityPicker
                      id="clin-lab-facility"
                      label="Diagnostic Lab"
                      placeholder="Filter lab by name or city..."
                      emptyLabel="No diagnostic labs available in this region"
                      options={labFacilityPickerOptions}
                      value={labFacilityId}
                      onChange={setLabFacilityId}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Diagnostic Panel
                    </label>
                    <input
                      type="text"
                      required
                      value={labPanelName}
                      onChange={(e) => setLabPanelName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Urgency
                    </label>
                    <select
                      value={labUrgency}
                      onChange={(e) =>
                        setLabUrgency(LabUrgencySchema.parse(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="ROUTINE">ROUTINE</option>
                      <option value="URGENT">URGENT</option>
                      <option value="EMERGENCY">EMERGENCY</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={busy || !sessionToken}
                      className="min-h-[38px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Create Lab Order
                    </button>
                  </div>
                </form>

                {labOrders.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {labOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {order.panelName} · {order.patientName}
                          </p>
                          <p className="text-slate-600">
                            {order.facilityName} · {order.urgency} ({order.status})
                          </p>
                        </div>
                        {order.status !== "COMPLETED" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCompleteLab(order.id)}
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                          >
                            Mark Completed
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {mediaObjects.length > 0 ? (
                  <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4">
                    <p className="font-mono-tabular text-xs font-semibold text-slate-700">
                      Uploaded Clinical Scans & Lab PDFs ({mediaObjects.length})
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {mediaObjects.map((media) => {
                        const isImg = media.mimeType.startsWith("image/");
                        return (
                          <article
                            key={media.id}
                            className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {isImg && media.uploadStatus === "UPLOADED" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openImage({
                                      src: media.downloadUrl,
                                      downloadUrl: media.downloadUrl,
                                      mimeType: media.mimeType,
                                      alt: media.fileName,
                                      title: media.fileName,
                                      subtitle: `Clinical Media · ${media.uploadStatus}`,
                                      specs: [
                                        {
                                          label: "File Size",
                                          value: formatByteSize(
                                            media.confirmedSizeBytes ??
                                              media.sizeBytes,
                                          ),
                                        },
                                        {
                                          label: "Format",
                                          value: formatClinicalFileType(
                                            media.mimeType,
                                          ),
                                        },
                                        {
                                          label: "Status",
                                          value: media.uploadStatus,
                                        },
                                      ],
                                    })
                                  }
                                  aria-label={`Zoom scan ${media.fileName}`}
                                  className="h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-teal-700"
                                >
                                  <img
                                    src={media.downloadUrl}
                                    alt={media.fileName}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-800">
                                  {isImg ? (
                                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                                  ) : (
                                    <FileText className="h-5 w-5" aria-hidden="true" />
                                  )}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  <bdi dir="auto">{media.fileName}</bdi>
                                </p>
                                <p className="font-mono-tabular text-[11px] text-slate-600">
                                  {formatByteSize(media.sizeBytes)} ·{" "}
                                  <span
                                    className={
                                      media.uploadStatus === "UPLOADED"
                                        ? "font-semibold text-emerald-700"
                                        : media.uploadStatus === "FAILED"
                                          ? "font-semibold text-red-700"
                                          : "font-semibold text-amber-700"
                                    }
                                  >
                                    {media.uploadStatus}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {media.uploadStatus === "UPLOADED" ? (
                              <UiButton
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  openImage({
                                    src: media.downloadUrl,
                                    downloadUrl: media.downloadUrl,
                                    mimeType: media.mimeType,
                                    alt: media.fileName,
                                    title: media.fileName,
                                    subtitle: `Clinical Media · ${media.uploadStatus}`,
                                    specs: [
                                      {
                                        label: "File Size",
                                        value: formatByteSize(
                                          media.confirmedSizeBytes ??
                                            media.sizeBytes,
                                        ),
                                      },
                                      {
                                        label: "Format",
                                        value: formatClinicalFileType(
                                          media.mimeType,
                                        ),
                                      },
                                      {
                                        label: "Status",
                                        value: media.uploadStatus,
                                      },
                                    ],
                                  })
                                }
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Preview</span>
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
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
              Clinical Workspace Actions
            </h2>

            {currentUser ? (
              <div className="mt-3 space-y-3 text-xs">
                <p className="text-slate-600">
                  All consultation notes, QR prescriptions, lab orders, and
                  weekly shift rosters sync in real time with the Care Network.
                </p>
                <UiButton
                  variant="secondary"
                  disabled={busy || !sessionToken}
                  onClick={() =>
                    sessionToken
                      ? void refreshClinicalData(sessionToken, selectedCountry)
                      : undefined
                  }
                  className="w-full"
                >
                  Sync Clinical Records
                </UiButton>
                {canManageSchedule && activeTab !== "schedule" ? (
                  <UiButton
                    variant="outline"
                    onClick={() => setActiveTab("schedule")}
                    className="w-full"
                  >
                    Manage Clinic Shifts
                  </UiButton>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-xs text-slate-600">
                <p>
                  Sign in via the Care Portal as a Doctor, Pharmacist, Lab Tech,
                  or Clinic Coordinator to access clinical workflows.
                </p>
                <Link
                  href="/portal"
                  className="inline-flex min-h-[38px] w-full items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                >
                  Open Sign-In Portal
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
