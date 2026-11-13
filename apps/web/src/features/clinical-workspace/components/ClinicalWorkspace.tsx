"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  ClinicalMediaMimeTypeSchema,
  LabUrgencySchema,
  LoginSchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  type AuthenticatedUser,
  type ClinicalMediaMimeType,
  type ClinicalMediaObjectSummary,
  type CountryPack,
  type LabOrderSummary,
  type LabUrgency,
  type PresignedUploadResponse,
  type PrescriptionSummary,
  type VisitNoteSummary,
} from "@medisync/contracts";
import { loginUser } from "@/features/auth-portal";
import {
  FileUploadDropzone,
  MediaPreviewModal,
  formatByteSize,
  inferUploadMimeType,
  uploadClinicalMediaEndToEnd,
  type PreviewableMediaItem,
} from "@/features/media-certifications";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  FileUp,
  FlaskConical,
  ImageIcon,
  KeyRound,
  LogOut,
  Pill,
  QrCode,
  ShieldAlert,
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

type ClinicalTab = "doctor" | "pharmacy" | "labs";

interface ClinicalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

export function ClinicalWorkspace({
  packs,
  apiBaseUrl,
}: ClinicalWorkspaceProps) {
  const defaultCode = packs[0]?.code ?? "INTL";
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [activeTab, setActiveTab] = useState<ClinicalTab>("doctor");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [mediaObjects, setMediaObjects] = useState<
    ClinicalMediaObjectSummary[]
  >([]);

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
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(
    null,
  );

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
    }
  }, []);

  async function refreshClinicalData(token: string, countryCode: string) {
    const [notesRes, rxRes, labsRes, mediaRes] = await Promise.all([
      fetchVisitNotes(apiBaseUrl, token, countryCode),
      fetchPrescriptions(apiBaseUrl, token, countryCode),
      fetchLabOrders(apiBaseUrl, token, countryCode),
      fetchClinicalMedia(apiBaseUrl, token, countryCode),
    ]);

    if (notesRes.ok) setVisitNotes(notesRes.data.visitNotes);
    if (rxRes.ok) setPrescriptions(rxRes.data.prescriptions);
    if (labsRes.ok) setLabOrders(labsRes.data.labOrders);
    if (mediaRes.ok) setMediaObjects(mediaRes.data.mediaObjects);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setBanner({ tone: "error", text: "Provide valid credentials." });
      return;
    }

    setBusy(true);
    const res = await loginUser(apiBaseUrl, parsed.data);
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Sign in failed: ${res.error}` });
      return;
    }

    writeStoredSession(res.data);
    setSessionToken(res.data.token);
    setCurrentUser(res.data.user);
    setSelectedCountry(res.data.user.countryCode);
    setLoginPassword("");

    await refreshClinicalData(res.data.token, res.data.user.countryCode);
    setBanner({
      tone: "success",
      text: `Authenticated ${res.data.user.fullName} (${res.data.user.role}).`,
    });
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
      text: `Recorded immutable SOAP note for ${res.data.visitNote.patientName}.`,
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
      text: `Cryptographic QR signature verified for ${res.data.prescription.patientName}.`,
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
      text: `Prescription ${res.data.prescription.id.slice(0, 8)} marked DISPENSED atomically.`,
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
        text: "Specify a Patient UUID (or sign in as a patient) before uploading medical media.",
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
      text: `Uploaded & cryptographically verified ${res.confirmed.mediaObject.fileName} in MinIO S3 storage.`,
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              Slice 4 · EHR Notes, QR Pharmacy & Diagnostic Labs
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clinical Care, QR E-Prescriptions & Direct S3 Labs
            </h1>
            <p className="text-sm text-slate-600">
              Role-isolated SOAP records, HMAC-signed pharmacy QR verification, and
              zero-proxy AWS4 presigned upload URLs in{" "}
              {activePack?.name ?? selectedCountry}.
            </p>
          </div>

          <div
            role="group"
            aria-label="Jurisdiction selector"
            className="flex flex-wrap gap-1.5"
          >
            {packs.map((pack) => {
              const selected = pack.code === selectedCountry;
              return (
                <button
                  key={pack.code}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(pack.code);
                    setBanner(null);
                  }}
                  className={
                    selected
                      ? "min-h-[38px] rounded-lg bg-teal-800 px-3 py-1.5 font-mono-tabular text-xs font-semibold text-white"
                      : "min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono-tabular text-xs font-semibold text-slate-700 hover:border-teal-700"
                  }
                >
                  {pack.code}
                </button>
              );
            })}
          </div>
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
            <span>SOAP Notes & E-Rx</span>
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
            <span>Pharmacy QR Dispense</span>
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
            <span>Diagnostic Labs & S3 Media</span>
          </button>
        </div>

        {banner ? (
          <div
            role="status"
            className={
              banner.tone === "error"
                ? "mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                : "mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
            }
          >
            {banner.tone === "error" ? (
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{banner.text}</span>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {activeTab === "doctor" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                  Physician SOAP Consultation & QR Prescription
                </h2>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="clin-patient-uuid"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Patient Account UUID
                    </label>
                    <input
                      id="clin-patient-uuid"
                      type="text"
                      placeholder="UUID of patient"
                      value={patientUuid}
                      onChange={(e) => setPatientUuid(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="clin-icd10"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      ICD-10 Codes (comma separated)
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
                      Save Signed SOAP Visit Note
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
                      <span>Issue HMAC-Signed QR Prescription</span>
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900">
                  Scoped SOAP Notes ({visitNotes.length})
                </h3>
                {visitNotes.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Sign in as a Doctor or Patient in {selectedCountry} to inspect
                    role-scoped visit notes.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {visitNotes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {note.patientName} · Dr. {note.doctorName}
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
            </div>
          ) : null}

          {activeTab === "pharmacy" ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                Pharmacy QR Verification & Atomic Dispensing
              </h2>

              <form onSubmit={(e) => void handleVerifyQr(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="rx-qr-token"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Signed QR E-Prescription Token
                  </label>
                  <textarea
                    id="rx-qr-token"
                    rows={3}
                    required
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="v1.eyJyeElkIjoi..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy || !sessionToken}
                    className="min-h-[38px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                  >
                    Verify Cryptographic QR
                  </button>
                  <span className="text-xs text-slate-600">
                    Tampered signatures return <code className="font-mono-tabular">400 INVALID_QR_SIGNATURE</code>;
                    duplicate dispenses return <code className="font-mono-tabular">409</code>.
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
                        Dispense Atomically
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Recent Prescriptions ({prescriptions.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {prescriptions.map((rx) => (
                    <li
                      key={rx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span>
                        <strong>{rx.patientName}</strong> ·{" "}
                        {rx.medications.map((m) => m.name).join(", ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular font-semibold">
                          {rx.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQrInput(rx.qrToken)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          Load QR
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {activeTab === "labs" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                  Diagnostic Lab Orders & AWS4-HMAC-SHA256 Direct S3 Upload
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
                        Allowed Clinical MIME
                      </label>
                      <select
                        id="s3-mime-type"
                        value={uploadMime}
                        onChange={(e) =>
                          setUploadMime(
                            ClinicalMediaMimeTypeSchema.parse(e.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono-tabular text-xs"
                      >
                        {ALLOWED_MEDIA_MIME_TYPES.map((mime) => (
                          <option key={mime} value={mime}>
                            {mime}
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
                      <span>Upload Binary to MinIO S3 Vault</span>
                    </button>
                  </div>
                </form>

                {latestPresigned ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                    <p className="font-semibold text-emerald-950">
                      Verified S3 Object Key: {latestPresigned.mediaObject.objectKey}
                    </p>
                  </div>
                ) : null}

                <form
                  onSubmit={(e) => void handleCreateLabOrder(e)}
                  className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Lab Facility UUID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Diagnostic Lab UUID"
                      value={labFacilityId}
                      onChange={(e) => setLabFacilityId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular text-xs"
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
                                <img
                                  src={media.downloadUrl}
                                  alt={media.fileName}
                                  className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-800">
                                  {isImg ? (
                                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <FileText className="h-4 w-4" aria-hidden="true" />
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
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewMedia({
                                    fileName: media.fileName,
                                    mimeType: media.mimeType,
                                    sizeBytes:
                                      media.confirmedSizeBytes ?? media.sizeBytes,
                                    downloadUrl: media.downloadUrl,
                                    subtitle: `Clinical Media · ${media.uploadStatus}`,
                                  })
                                }
                                className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900 active:scale-95"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Preview</span>
                              </button>
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
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound
                  className="h-4 w-4 text-teal-800"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold text-slate-900">
                  Clinical Auth Session
                </h2>
              </div>
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    clearStoredSession();
                    setSessionToken(null);
                    setCurrentUser(null);
                    setVisitNotes([]);
                    setPrescriptions([]);
                    setLabOrders([]);
                    setMediaObjects([]);
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-red-300 hover:text-red-800"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              ) : null}
            </div>

            {currentUser ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs">
                  <p className="font-bold text-teal-950">
                    {currentUser.fullName}
                  </p>
                  <p className="font-mono-tabular text-teal-800">
                    {currentUser.role} · {currentUser.countryCode}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !sessionToken}
                  onClick={() =>
                    sessionToken
                      ? void refreshClinicalData(sessionToken, selectedCountry)
                      : undefined
                  }
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-teal-700"
                >
                  Sync Clinical Records
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleLogin(e)}
                className="mt-3 space-y-3"
              >
                <div>
                  <label
                    htmlFor="clin-login-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Account Email
                  </label>
                  <input
                    id="clin-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="doctor@medisync.global"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="clin-login-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="clin-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[38px] w-full rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                >
                  Sign In to Clinical Records
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>

      <MediaPreviewModal
        item={previewMedia}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
}
