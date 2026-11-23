"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  AuthResponse,
  PatientMedicalProfile,
  PrescriptionSummary,
  VisitNoteSummary,
} from "@medisync/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileHeart,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  Pill,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Video,
  VideoOff,
} from "lucide-react";
import { readStoredSession } from "@/shared/auth/session-storage";
import {
  detectAllergyConflicts,
  formatRxDurationChip,
  ICD10_QUICK_CHIPS,
  RX_DURATION_PILLS,
  RX_FREQUENCY_PILLS,
  SOAP_TEMPLATES,
} from "@/shared/config/clinical-cds";
import { MOROCCAN_FORMULARY_PRESETS } from "@/shared/config/morocco-standards";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import {
  formatPractitionerDisplayName,
  UiBadge,
  UiButton,
  UiLinkButton,
  UiSwitch,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import { transitionAppointmentStatus } from "@/features/booking";
import {
  createPrescription,
  createVisitNote,
  fetchMyPatientProfile,
  fetchPatientMedicalProfile,
  fetchPrescriptions,
  fetchVisitNotes,
} from "@/features/clinical-workspace";
import { TELEHEALTH_COPY } from "../telehealth-i18n";
import { useTelehealthRtc } from "./useTelehealthRtc";

interface TelehealthConsultationRoomProps {
  appointmentId: string;
  apiBaseUrl: string;
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TelehealthConsultationRoom({
  appointmentId,
  apiBaseUrl,
}: TelehealthConsultationRoomProps) {
  const { locale, isRtl } = useLocale();
  const copy = TELEHEALTH_COPY[locale] ?? TELEHEALTH_COPY.en;

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);

  const [patientProfile, setPatientProfile] = useState<PatientMedicalProfile | null>(null);
  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [clinicalBusy, setClinicalBusy] = useState(false);
  const [clinicalBanner, setClinicalBanner] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Doctor live SOAP diagnosis form (never pre-fill a default diagnosis code)
  const [icd10Input, setIcd10Input] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  // Doctor live E-Rx form + real-time EN/FR/AR allergy CDS override state
  const [rxMedName, setRxMedName] = useState("");
  const [rxDosage, setRxDosage] = useState("");
  const [rxFrequency, setRxFrequency] = useState("");
  const [rxDurationDays, setRxDurationDays] = useState("7");
  const [overrideAckKey, setOverrideAckKey] = useState("");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setSession(readStoredSession());
    setSessionHydrated(true);
  }, []);

  const rtc = useTelehealthRtc({
    appointmentId,
    apiBaseUrl,
    session,
    sessionHydrated,
  });

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    el.srcObject = rtc.localStream;
  }, [rtc.localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = rtc.remoteStream;
  }, [rtc.remoteStream]);

  const readyAppointment =
    rtc.phase.status === "ready" || rtc.phase.status === "left"
      ? rtc.phase.appointment
      : null;
  const selfRole =
    rtc.phase.status === "ready" || rtc.phase.status === "left"
      ? rtc.phase.selfRole
      : null;

  const refreshClinicalRecords = useCallback(async () => {
    if (!session || !readyAppointment || !selfRole) return;
    const [notesRes, rxRes, profRes] = await Promise.all([
      fetchVisitNotes(apiBaseUrl, session.token, readyAppointment.countryCode),
      fetchPrescriptions(apiBaseUrl, session.token, readyAppointment.countryCode),
      selfRole === "DOCTOR"
        ? fetchPatientMedicalProfile(
            apiBaseUrl,
            session.token,
            readyAppointment.patientUserId,
          )
        : fetchMyPatientProfile(apiBaseUrl, session.token),
    ]);
    if (notesRes.ok) {
      setVisitNotes(
        notesRes.data.visitNotes.filter(
          (note) => note.patientUserId === readyAppointment.patientUserId,
        ),
      );
    }
    if (rxRes.ok) {
      setPrescriptions(
        rxRes.data.prescriptions.filter(
          (rx) => rx.patientUserId === readyAppointment.patientUserId,
        ),
      );
    }
    if (profRes.ok) {
      setPatientProfile(profRes.data.profile);
    }
  }, [session, readyAppointment, selfRole, apiBaseUrl]);

  useEffect(() => {
    if (!readyAppointment || !selfRole) return;
    void refreshClinicalRecords();
  }, [readyAppointment, selfRole, refreshClinicalRecords]);

  useEffect(() => {
    if (rtc.clinicalPulseCount === 0) return;
    void refreshClinicalRecords().then(() => {
      if (selfRole === "PATIENT") {
        setClinicalBanner({ tone: "info", text: copy.liveUpdateToast });
      }
    });
  }, [rtc.clinicalPulseCount, refreshClinicalRecords, selfRole, copy.liveUpdateToast]);

  const sessionNotes = useMemo(() => {
    if (!readyAppointment) return [];
    const linked = visitNotes.filter((n) => n.appointmentId === readyAppointment.id);
    return linked.length > 0 ? linked : visitNotes.slice(0, 3);
  }, [visitNotes, readyAppointment]);

  const sessionRx = useMemo(() => {
    if (!readyAppointment) return [];
    return prescriptions.slice(0, 4);
  }, [prescriptions, readyAppointment]);

  const activeIcdList = useMemo(
    () =>
      icd10Input
        .split(",")
        .map((c) => c.trim().toUpperCase())
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

  const allergyConflicts = useMemo(
    () =>
      detectAllergyConflicts(
        rxMedName.trim() ? [{ name: rxMedName.trim() }] : [],
        patientProfile,
        locale,
      ),
    [rxMedName, patientProfile, locale],
  );

  const conflictSignature = useMemo(
    () =>
      allergyConflicts.length === 0
        ? ""
        : `${readyAppointment?.patientUserId ?? ""}|${allergyConflicts
            .map((cf) => `${cf.medName}:${cf.allergen}`)
            .join(",")}`,
    [allergyConflicts, readyAppointment?.patientUserId],
  );

  const allergyOverrideConfirmed =
    conflictSignature !== "" && overrideAckKey === conflictSignature;

  async function handleSaveDiagnosis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !readyAppointment || selfRole !== "DOCTOR") return;
    setClinicalBusy(true);
    setClinicalBanner(null);
    const res = await createVisitNote(apiBaseUrl, session.token, {
      patientUserId: readyAppointment.patientUserId,
      appointmentId: readyAppointment.id,
      facilityId: readyAppointment.facilityId,
      icd10Codes: activeIcdList.filter((c) => c.length >= 2),
      subjective,
      objective,
      assessment,
      plan,
    });
    setClinicalBusy(false);

    if (!res.ok) {
      setClinicalBanner({
        tone: "error",
        text: `${copy.historyErrorPrefix} ${res.error}`,
      });
      return;
    }

    setIcd10Input("");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    await refreshClinicalRecords();
    await rtc.notifyClinicalUpdate("visit-note");
    setClinicalBanner({ tone: "success", text: copy.diagnosisSavedBanner });
  }

  async function handleIssueRx(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !readyAppointment || selfRole !== "DOCTOR") return;
    if (allergyConflicts.length > 0 && !allergyOverrideConfirmed) return;
    setClinicalBusy(true);
    setClinicalBanner(null);
    const res = await createPrescription(apiBaseUrl, session.token, {
      patientUserId: readyAppointment.patientUserId,
      appointmentId: readyAppointment.id,
      facilityId: readyAppointment.facilityId,
      medications: [
        {
          name: rxMedName.trim(),
          dosage: rxDosage.trim(),
          frequency: rxFrequency.trim(),
          durationDays: Math.max(1, Number.parseInt(rxDurationDays, 10) || 7),
        },
      ],
    });
    setClinicalBusy(false);

    if (!res.ok) {
      setClinicalBanner({
        tone: "error",
        text: `${copy.historyErrorPrefix} ${res.error}`,
      });
      return;
    }

    setRxMedName("");
    setRxDosage("");
    setRxFrequency("");
    setRxDurationDays("7");
    setOverrideAckKey("");
    await refreshClinicalRecords();
    await rtc.notifyClinicalUpdate("prescription");
    const warnings = res.data.allergyWarnings ?? [];
    if (warnings.length > 0) {
      const alertPrefix =
        locale === "fr"
          ? "Alerte allergie :"
          : locale === "ar"
            ? "تنبيه حساسية:"
            : "Allergy Alert:";
      setClinicalBanner({
        tone: "error",
        text: `${copy.rxIssuedBanner} — ${alertPrefix} ${warnings.map((w) => w.message).join(" · ")}`,
      });
    } else {
      setClinicalBanner({ tone: "success", text: copy.rxIssuedBanner });
    }
  }

  async function handleCompleteConsultation() {
    if (!session || !readyAppointment || selfRole !== "DOCTOR") return;
    setClinicalBusy(true);
    const res = await transitionAppointmentStatus(
      apiBaseUrl,
      session.token,
      readyAppointment.id,
      { status: "COMPLETED" },
    );
    setClinicalBusy(false);
    if (!res.ok) {
      setClinicalBanner({
        tone: "error",
        text: `${copy.historyErrorPrefix} ${res.error}`,
      });
      return;
    }
    await rtc.leaveCall();
  }

  if (rtc.phase.status === "loading") {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
          <Video className="h-6 w-6 animate-pulse" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-800">
          {copy.loadingRoom}
        </p>
      </div>
    );
  }

  if (rtc.phase.status === "error") {
    const { httpStatus, code } = rtc.phase;
    const title =
      httpStatus === 401
        ? copy.signInRequiredTitle
        : httpStatus === 403
          ? copy.accessDeniedTitle
          : code === "APPOINTMENT_NOT_TELEHEALTH"
            ? copy.nonTelehealthTitle
            : code === "APPOINTMENT_INACTIVE"
              ? copy.inactiveTitle
              : copy.notFoundTitle;
    const body =
      httpStatus === 401
        ? copy.signInRequiredBody
        : httpStatus === 403
          ? copy.accessDeniedBody
          : code === "APPOINTMENT_NOT_TELEHEALTH"
            ? copy.nonTelehealthBody
            : code === "APPOINTMENT_INACTIVE"
              ? copy.inactiveBody
              : copy.notFoundBody;

    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
              {title}
            </h1>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              {body}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {httpStatus === 401 ? (
            <UiLinkButton href="/portal" size="md" pill>
              {copy.signInCta}
            </UiLinkButton>
          ) : null}
          <UiLinkButton
            href={
              session?.user.role === "DOCTOR" || session?.user.role === "NURSE"
                ? "/clinical"
                : "/booking"
            }
            variant="secondary"
            size="md"
            pill
          >
            <ArrowLeft
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
            <span>{copy.backToCareBtn}</span>
          </UiLinkButton>
        </div>
      </div>
    );
  }

  const appt = rtc.phase.appointment;
  const backHref = selfRole === "DOCTOR" ? "/clinical" : "/booking";
  const peerDisplayName =
    selfRole === "DOCTOR"
      ? appt.patientName
      : formatPractitionerDisplayName(appt.doctorName);
  const localizedSpecialty = formatSpecialtyLabel(appt.specialty, locale);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
      {/* Top Clinical Telehealth Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <EntityAvatar
            name={peerDisplayName}
            role={selfRole === "DOCTOR" ? "PATIENT" : "DOCTOR"}
            specialty={appt.specialty}
            avatarUrl={selfRole === "DOCTOR" ? null : appt.doctorAvatarUrl ?? null}
            size="md"
          />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#0066CC]">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{copy.headerEyebrow}</span>
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-700 ring-1 ring-slate-900/[0.06]">
                {copy.encryptedBadge}
              </span>
              {rtc.turnRelayConfigured ? (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-700/15">
                  {copy.turnRelayBadge}
                </span>
              ) : null}
              <MoroccanComplianceBadge domain="telehealth" locale={locale} />
            </p>
            <h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">
              <bdi dir="auto">{peerDisplayName}</bdi>
            </h1>
            <p className="truncate text-xs text-slate-600">
              {localizedSpecialty} · <bdi dir="auto">{appt.facilityName}</bdi>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UiBadge
            tone={
              rtc.rtcStatus === "connected"
                ? "emerald"
                : rtc.rtcStatus === "connecting" ||
                    rtc.rtcStatus === "reconnecting"
                  ? "amber"
                  : "slate"
            }
          >
            {rtc.rtcStatus === "connected"
              ? copy.connectedLiveHd
              : rtc.rtcStatus === "reconnecting"
                ? copy.reconnectingRtc
                : rtc.rtcStatus === "connecting"
                  ? copy.connectingRtc
                  : selfRole === "DOCTOR"
                    ? copy.waitingForPatient
                    : copy.waitingForDoctor}
          </UiBadge>
          <span
            dir="ltr"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 font-mono-tabular text-xs font-bold text-slate-900"
          >
            {formatCallDuration(rtc.callSeconds)}
          </span>
          <UiLinkButton href={backHref} variant="secondary" size="sm" pill>
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            <span>{copy.backToCareBtn}</span>
          </UiLinkButton>
        </div>
      </header>

      {rtc.phase.status === "left" ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#D7E4F2] bg-white p-6 text-center shadow-xs sm:p-8">
          <h2 className="font-editorial text-lg font-bold text-[#0F243E]">{copy.callEndedTitle}</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#556E89] sm:text-sm">
            {copy.callEndedBody}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <UiButton onClick={rtc.rejoinCall} className="rounded-full">
              <Video className="h-4 w-4" aria-hidden="true" />
              <span>{copy.rejoinCallBtn}</span>
            </UiButton>
            <UiLinkButton href={backHref} variant="secondary" pill>
              {copy.backToCareBtn}
            </UiLinkButton>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Stage: Dual Live Video Streams + Dock */}
          <section className="space-y-3 lg:col-span-7">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
              {rtc.remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
                  <EntityAvatar
                    name={peerDisplayName}
                    role={selfRole === "DOCTOR" ? "PATIENT" : "DOCTOR"}
                    specialty={appt.specialty}
                    avatarUrl={
                      selfRole === "DOCTOR" ? null : appt.doctorAvatarUrl ?? null
                    }
                    size="xl"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      <bdi dir="auto">{peerDisplayName}</bdi>
                    </p>
                    <p className="text-xs text-slate-300">
                      {rtc.peerPresence
                        ? copy.connectingRtc
                        : selfRole === "DOCTOR"
                          ? copy.waitingForPatient
                          : copy.waitingForDoctor}
                    </p>
                  </div>
                </div>
              )}

              {/* Peer Mute/Camera Badges */}
              {rtc.peerPresence ? (
                <div className="absolute top-3 start-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <bdi dir="auto">{peerDisplayName}</bdi>
                  </span>
                  {!rtc.peerPresence.audioEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-700/90 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <MicOff className="h-3 w-3" aria-hidden="true" />
                      <span>{copy.peerMutedMic}</span>
                    </span>
                  ) : null}
                  {!rtc.peerPresence.videoEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <VideoOff className="h-3 w-3" aria-hidden="true" />
                      <span>{copy.peerCameraOff}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Self Picture-in-Picture Stream */}
              <div className="absolute end-3 bottom-3 h-20 w-28 overflow-hidden rounded-2xl border-2 border-white/80 bg-slate-900 shadow-xl sm:h-32 sm:w-44">
                {rtc.localStream && rtc.camEnabled ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full scale-x-[-1] object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-300">
                    <VideoOff className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    <span>{copy.youLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {rtc.mediaWarning ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold">{copy.clinicalSyncModeTitle}</p>
                  <p className="mt-0.5 text-amber-900">{copy.clinicalSyncModeBody}</p>
                </div>
              </div>
            ) : null}

            {/* Live Video Controls Dock */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <UiButton
                  type="button"
                  size="sm"
                  variant={rtc.micEnabled ? "secondary" : "danger"}
                  onClick={() => void rtc.toggleMic()}
                  aria-label={rtc.micEnabled ? copy.micOnAria : copy.micOffAria}
                  className="rounded-full"
                >
                  {rtc.micEnabled ? (
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{rtc.micEnabled ? copy.micOnAria : copy.micOffAria}</span>
                </UiButton>

                <UiButton
                  type="button"
                  size="sm"
                  variant={rtc.camEnabled ? "secondary" : "danger"}
                  onClick={() => void rtc.toggleCam()}
                  aria-label={rtc.camEnabled ? copy.camOnAria : copy.camOffAria}
                  className="rounded-full"
                >
                  {rtc.camEnabled ? (
                    <Video className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <VideoOff className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{rtc.camEnabled ? copy.camOnAria : copy.camOffAria}</span>
                </UiButton>

                <UiButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={rtc.reconnectCall}
                  className="rounded-full"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.reconnectBtn}</span>
                </UiButton>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selfRole === "DOCTOR" && appt.status !== "COMPLETED" ? (
                  <UiButton
                    type="button"
                    size="sm"
                    disabled={clinicalBusy}
                    onClick={() => void handleCompleteConsultation()}
                    className="rounded-xl bg-[#0066CC] hover:bg-[#0052A3]"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {clinicalBusy ? copy.completingVisitBtn : copy.completeVisitBtn}
                    </span>
                  </UiButton>
                ) : null}

                <UiButton
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => void rtc.leaveCall()}
                  className="rounded-full"
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.endCallBtn}</span>
                </UiButton>
              </div>
            </div>

            {appt.reason ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-2xs">
                <strong className="text-slate-900">{copy.reasonPrefix}</strong>{" "}
                <bdi dir="auto">{appt.reason}</bdi>
              </div>
            ) : null}
          </section>

          {/* Right Desk: Real-Time Doctor Diagnosis & E-Rx OR Patient Live Care Feed */}
          <aside className="space-y-4 lg:col-span-5">
            {clinicalBanner ? (
              <div
                role="status"
                className={`rounded-xl p-3.5 text-xs font-semibold ${
                  clinicalBanner.tone === "success"
                    ? "bg-emerald-50 text-emerald-950"
                    : clinicalBanner.tone === "error"
                      ? "bg-rose-50 text-rose-950"
                      : "bg-[#E8F1FA] text-slate-900"
                }`}
              >
                {clinicalBanner.text}
              </div>
            ) : null}

            {/* Patient Safety Alert (Blood Group + Allergies) */}
            {patientProfile ? (
              <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <FileHeart className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                    <span>{copy.safetyAlertTitle}</span>
                  </h2>
                  <UiBadge tone="teal">
                    {copy.bloodTypePrefix}{" "}
                    <span dir="ltr" className="ms-1 font-mono-tabular">
                      {patientProfile.bloodType && patientProfile.bloodType !== "UNKNOWN"
                        ? patientProfile.bloodType
                        : copy.unknownBloodLabel}
                    </span>
                  </UiBadge>
                </div>
                {patientProfile.allergies.length > 0 ? (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-950">
                    {patientProfile.allergies.map((alg) => alg.allergen).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">{copy.noAllergiesLabel}</p>
                )}
              </section>
            ) : null}

            {selfRole === "DOCTOR" ? (
              <>
                <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
                  <div className="border-b border-slate-200/70 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Stethoscope className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                        <span>{copy.doctorDeskTitle}</span>
                      </h2>
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
                          className="text-[11px] font-semibold text-[#6B829D] hover:text-[#0F243E]"
                        >
                          {locale === "fr"
                            ? "Effacer le brouillon"
                            : locale === "ar"
                              ? "مسح المسودة"
                              : "Clear draft"}
                        </button>
                      ) : null}
                    </div>
                    {/* 1-Tap Localized SOAP Clinical Templates */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                          }}
                          className="min-h-[28px] rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#0052A3] transition hover:bg-[#0066CC] hover:text-white active:scale-95"
                        >
                          {tpl.labels[locale]}
                        </button>
                      ))}
                    </div>
                    {/* Multi-Toggle ICD-10 Quick Chips */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ICD10_QUICK_CHIPS.slice(0, 6).map((chip) => {
                        const active = activeIcdList.includes(chip.code);
                        return (
                          <button
                            key={chip.code}
                            type="button"
                            onClick={() => toggleIcdCode(chip.code)}
                            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition active:scale-95 ${
                              active
                                ? "border-[#0066CC] bg-[#0066CC] text-white"
                                : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
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

                  <form
                    onSubmit={(e) => void handleSaveDiagnosis(e)}
                    className="mt-3 space-y-2.5 text-xs"
                  >
                    <div>
                      <label
                        htmlFor="telehealth-icd10"
                        className="block font-semibold text-slate-700"
                      >
                        {copy.icd10Label}
                      </label>
                      <input
                        id="telehealth-icd10"
                        type="text"
                        dir="ltr"
                        value={icd10Input}
                        onChange={(e) => setIcd10Input(e.target.value)}
                        placeholder="I10, J06.9, E11.9"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-tabular text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-soap-s" className="block font-semibold text-slate-700">
                        {copy.subjectiveLabel}
                      </label>
                      <textarea
                        id="telehealth-soap-s"
                        rows={2}
                        required
                        value={subjective}
                        onChange={(e) => setSubjective(e.target.value)}
                        placeholder={copy.subjectivePlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-soap-o" className="block font-semibold text-slate-700">
                        {copy.objectiveLabel}
                      </label>
                      <textarea
                        id="telehealth-soap-o"
                        rows={2}
                        required
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder={copy.objectivePlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-soap-a" className="block font-semibold text-slate-700">
                        {copy.assessmentLabel}
                      </label>
                      <textarea
                        id="telehealth-soap-a"
                        rows={2}
                        required
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                        placeholder={copy.assessmentPlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-soap-p" className="block font-semibold text-slate-700">
                        {copy.planLabel}
                      </label>
                      <textarea
                        id="telehealth-soap-p"
                        rows={2}
                        required
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        placeholder={copy.planPlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <UiButton
                      type="submit"
                      disabled={clinicalBusy}
                      className="w-full rounded-xl"
                    >
                      {copy.saveDiagnosisBtn}
                    </UiButton>
                  </form>
                </section>

                <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Pill className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                    <span>{copy.rxHeading}</span>
                  </h2>

                  {/* Real-Time EN/FR/AR Clinical Decision Support (CDS): Drug-Allergy Contraindication */}
                  {allergyConflicts.length > 0 ? (
                    <div
                      role="alert"
                      className="mt-3 rounded-2xl border-2 border-[#DC2626] bg-rose-50 p-3 text-xs text-rose-950"
                    >
                      <div className="flex items-start gap-2">
                        <ShieldAlert
                          className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#DC2626]"
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
                          <div className="pt-0.5">
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

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {MOROCCAN_FORMULARY_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setRxMedName(preset.medication);
                          setRxDosage(preset.dosage);
                          setRxFrequency(preset.frequency);
                          setRxDurationDays(String(preset.durationDays));
                        }}
                        className="rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0B6B5C] transition hover:bg-[#0F9D88] hover:text-white"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => void handleIssueRx(e)}
                    className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2"
                  >
                    <div className="sm:col-span-2">
                      <label htmlFor="telehealth-rx-med" className="block font-semibold text-slate-700">
                        {copy.medLabel}
                      </label>
                      <input
                        id="telehealth-rx-med"
                        type="text"
                        required
                        value={rxMedName}
                        onChange={(e) => setRxMedName(e.target.value)}
                        placeholder={copy.medPlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-rx-dosage" className="block font-semibold text-slate-700">
                        {copy.dosageLabel}
                      </label>
                      <input
                        id="telehealth-rx-dosage"
                        type="text"
                        required
                        value={rxDosage}
                        onChange={(e) => setRxDosage(e.target.value)}
                        placeholder={copy.dosagePlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="telehealth-rx-freq" className="block font-semibold text-slate-700">
                        {copy.freqLabel}
                      </label>
                      <input
                        id="telehealth-rx-freq"
                        type="text"
                        required
                        value={rxFrequency}
                        onChange={(e) => setRxFrequency(e.target.value)}
                        placeholder={copy.freqPlaceholder}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
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
                    <div className="sm:col-span-2">
                      <span className="block font-semibold text-slate-700">
                        {copy.daysLabel}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {RX_DURATION_PILLS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setRxDurationDays(String(d))}
                            className={`h-8 min-w-[38px] rounded-lg border px-2 font-mono-tabular text-xs font-bold transition ${
                              rxDurationDays === String(d)
                                ? "border-[#0066CC] bg-[#0066CC] text-white"
                                : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                            }`}
                          >
                            {formatRxDurationChip(d, locale)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <UiButton
                        type="submit"
                        disabled={
                          clinicalBusy ||
                          (allergyConflicts.length > 0 && !allergyOverrideConfirmed)
                        }
                        className="w-full rounded-xl bg-[#0066CC] hover:bg-[#0052A3]"
                      >
                        {copy.issueRxBtn}
                      </UiButton>
                    </div>
                  </form>
                </section>
              </>
            ) : (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    {copy.patientCompanionTitle}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {copy.patientCompanionSub}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    {copy.latestDiagnosisTitle}
                  </h3>
                  {sessionNotes.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {copy.noDiagnosisYet}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {sessionNotes.map((note) => (
                        <li
                          key={note.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                        >
                          <p className="font-bold text-slate-900">
                            <bdi dir="auto">{note.assessment}</bdi>
                          </p>
                          <p className="text-slate-700">
                            <bdi dir="auto">{note.plan}</bdi>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    {copy.latestRxTitle}
                  </h3>
                  {sessionRx.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {copy.noRxYet}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {sessionRx.map((rx) => (
                        <QrPrescriptionCard key={rx.id} prescription={rx} />
                      ))}
                      <UiLinkButton
                        href="/pharmacy"
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full rounded-xl"
                      >
                        {copy.openPharmacyCta}
                      </UiLinkButton>
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
