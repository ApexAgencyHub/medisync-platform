"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CreateScheduleSchema,
  type AppointmentSummary,
  type AuthenticatedUser,
  type CountryPack,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type DoctorScheduleSummary,
  type FacilityMediaDocument,
  type FacilitySummary,
  type PatientMedicalProfile,
  type UpdateScheduleInput,
  type UserMediaDocument,
  type VisitMode,
  type VisitNoteSummary,
} from "@medisync/contracts";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  HeartPulse,
  Info,
  Phone,
  ShieldCheck,
} from "lucide-react";
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
  ClinicalPapersPanel,
  createVisitNote,
  DoctorCalendarAgenda,
  fetchPatientMedicalProfile,
  fetchVisitNotes,
  VisualScheduleBuilder,
} from "@/features/clinical-workspace";
import {
  listFacilityMedia,
  listMyUserMedia,
} from "@/features/media-certifications";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryFacilities,
  fetchDirectoryPatients,
} from "@/shared/api/directory-client";
import {
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import { syncPendingSessionStatus } from "@/shared/auth/role-capabilities";
import { WorkspaceRoleGuard } from "@/shared/auth/WorkspaceRoleGuard";
import { ACTIVE_COUNTRY_CODE, resolveActivePack } from "@/shared/config/deployment";
import { formatCountryDisplayName } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import {
  formatPractitionerDisplayName,
  UiBadge,
  UiButton,
  UiTabBar,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import {
  ClinicalStepper,
  MoroccanComplianceBadge,
} from "@/shared/ui/TactileControls";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import { NURSE_COPY } from "../nurse-i18n";

type NurseTab = "rounds" | "care" | "schedule" | "papers";

interface NurseWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

export function NurseWorkspace({ packs, apiBaseUrl }: NurseWorkspaceProps) {
  const { locale, isRtl } = useLocale();
  const c = NURSE_COPY[locale] ?? NURSE_COPY.en;
  const setBanner = useToastSetter();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);

  const defaultCountry = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCountry);
  const [activeTab, setActiveTab] = useState<NurseTab>("rounds");

  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [schedules, setSchedules] = useState<DoctorScheduleSummary[]>([]);
  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [patients, setPatients] = useState<DirectoryPatientSummary[]>([]);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [directoryClinics, setDirectoryClinics] = useState<DirectoryFacilitySummary[]>([]);
  const [userDocs, setUserDocs] = useState<UserMediaDocument[]>([]);
  const [facilityDocs, setFacilityDocs] = useState<FacilityMediaDocument[]>([]);

  // Vitals + Care Form State
  const [patientUuid, setPatientUuid] = useState("");
  const [patientProfile, setPatientProfile] = useState<PatientMedicalProfile | null>(null);
  const [patientProfileLoading, setPatientProfileLoading] = useState(false);
  const [tempC, setTempC] = useState("36.8");
  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("78");
  const [heartRate, setHeartRate] = useState("74");
  const [spo2, setSpo2] = useState("98");
  const [painScore, setPainScore] = useState<number>(0);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  // Home-Visit / Ward Schedule State
  const [specialtyInput, setSpecialtyInput] = useState("Home Nursing & Wound Care");
  const [licenseInput, setLicenseInput] = useState("MA-RN-20418");
  const [feeMinorInput, setFeeMinorInput] = useState("20000");
  const [schedFacilityId, setSchedFacilityId] = useState("");
  const [schedDay, setSchedDay] = useState(1);
  const [schedStart, setSchedStart] = useState("08:00");
  const [schedEnd, setSchedEnd] = useState("14:00");
  const [schedDuration, setSchedDuration] = useState("30");
  const [schedMode, setSchedMode] = useState<VisitMode>("HOME_VISIT");
  const [publishWeekdays, setPublishWeekdays] = useState(false);

  const isPendingStaff = isPendingStaffVerification(currentUser);
  const activePack = packs.find((p) => p.code === selectedCountry) ?? packs[0];

  const refreshPapers = useCallback(
    async (token: string, user: AuthenticatedUser) => {
      const [myMediaRes, facMediaRes, facListRes] = await Promise.all([
        listMyUserMedia(apiBaseUrl, token),
        user.facilityId
          ? listFacilityMedia(apiBaseUrl, token, user.facilityId)
          : Promise.resolve({ ok: true as const, data: { documents: [] } }),
        listFacilities(apiBaseUrl, token, user.countryCode),
      ]);
      if (myMediaRes.ok) setUserDocs(myMediaRes.data.documents);
      if (facMediaRes.ok) setFacilityDocs(facMediaRes.data.documents);
      if (facListRes.ok) setFacilities(facListRes.data.facilities);
    },
    [apiBaseUrl],
  );

  const refreshNurseData = useCallback(
    async (token: string, countryCode: string, user: AuthenticatedUser | null) => {
      if (!token || !user || isPendingStaffVerification(user) || user.role !== "NURSE") {
        return;
      }
      const [apptsRes, schedRes, notesRes, patRes, facRes, docsRes] = await Promise.all([
        fetchAppointments(apiBaseUrl, token, countryCode),
        fetchSchedules(apiBaseUrl, { countryCode, includeInactive: true }),
        fetchVisitNotes(apiBaseUrl, token, countryCode),
        fetchDirectoryPatients(apiBaseUrl, token, { countryCode }),
        fetchDirectoryFacilities(apiBaseUrl, { countryCode }),
        fetchDirectoryDoctors(apiBaseUrl, { countryCode }),
      ]);
      if (apptsRes.ok) setAppointments(apptsRes.data.appointments);
      if (schedRes.ok) setSchedules(schedRes.data.schedules);
      if (notesRes.ok) setVisitNotes(notesRes.data.visitNotes);
      if (patRes.ok) {
        setPatients(patRes.patients);
      }
      if (docsRes.ok) {
        const ownProfile = docsRes.doctors.find((d) => d.id === user.id);
        if (ownProfile) {
          if (ownProfile.specialty) setSpecialtyInput(ownProfile.specialty);
          if (typeof ownProfile.consultationFeeMinor === "number") {
            setFeeMinorInput(String(ownProfile.consultationFeeMinor));
          }
        }
      }
      const preferredPatientId =
        (apptsRes.ok
          ? apptsRes.data.appointments.find(
              (a) =>
                a.status !== "CANCELLED" &&
                a.status !== "NO_SHOW" &&
                a.patientName !== "Guest Care Pass",
            )?.patientUserId
          : undefined) ??
        (patRes.ok ? patRes.patients[0]?.id : undefined) ??
        (apptsRes.ok
          ? apptsRes.data.appointments.find(
              (a) => a.patientName !== "Guest Care Pass",
            )?.patientUserId
          : undefined);
      if (preferredPatientId) {
        setPatientUuid((prev) => prev || preferredPatientId);
      }
      if (facRes.ok) {
        setDirectoryClinics(facRes.facilities);
        if (facRes.facilities[0]) {
          setSchedFacilityId((prev) => prev || facRes.facilities[0]!.id);
        }
      }
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
      if (stored.user.facilityId) {
        setSchedFacilityId(stored.user.facilityId);
      }
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
    if (!apiOnline || !sessionToken || !currentUser || currentUser.role !== "NURSE") {
      return;
    }
    if (isPendingStaff) {
      void refreshPapers(sessionToken, currentUser);
      return;
    }
    void refreshNurseData(sessionToken, selectedCountry, currentUser);
  }, [apiOnline, currentUser, isPendingStaff, refreshNurseData, refreshPapers, selectedCountry, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !patientUuid || isPendingStaff || currentUser?.role !== "NURSE") {
      setPatientProfile(null);
      return;
    }
    let active = true;
    setPatientProfileLoading(true);
    fetchPatientMedicalProfile(apiBaseUrl, sessionToken, patientUuid).then((res) => {
      if (!active) return;
      setPatientProfile(res.ok ? res.data.profile : null);
      setPatientProfileLoading(false);
    });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, currentUser?.role, isPendingStaff, patientUuid, sessionToken]);

  const patientPickerOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; sublabel: string }>();
    const activeAppts = appointments.filter(
      (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW",
    );
    const orderedAppts = [
      ...activeAppts,
      ...appointments.filter(
        (a) => a.status === "CANCELLED" || a.status === "NO_SHOW",
      ),
    ];
    for (const appt of orderedAppts) {
      if (
        appt.patientName === "Guest Care Pass" &&
        appt.patientUserId !== patientUuid
      ) {
        continue;
      }
      if (!byId.has(appt.patientUserId)) {
        byId.set(appt.patientUserId, {
          id: appt.patientUserId,
          label: appt.patientName,
          sublabel: `${appt.status.replace("_", " ")} · ${appt.countryCode}`,
        });
      }
    }
    for (const p of patients) {
      if (!byId.has(p.id)) {
        byId.set(p.id, {
          id: p.id,
          label: p.fullName,
          sublabel: p.phone ?? p.email ?? p.countryCode,
        });
      }
    }
    return Array.from(byId.values());
  }, [appointments, patientUuid, patients]);

  const clinicOptions = useMemo(
    () =>
      directoryClinics
        .filter((f) => f.kind === "CLINIC" || f.kind === "HOSPITAL")
        .map((f) => ({
          id: f.id,
          label: f.name,
          sublabel: f.address,
        })),
    [directoryClinics],
  );

  const nurseSchedules = useMemo(
    () =>
      currentUser
        ? schedules.filter((s) => s.doctorUserId === currentUser.id)
        : schedules,
    [currentUser, schedules],
  );

  const myFacility = useMemo(() => {
    if (!currentUser?.facilityId) return null;
    return facilities.find((f) => f.id === currentUser.facilityId) ?? null;
  }, [currentUser?.facilityId, facilities]);

  async function handleSaveCareNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionToken || !patientUuid || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const parsedTemp = Number.parseFloat(tempC.replace(",", "."));
      const parsedSys = Number.parseFloat(systolic.replace(",", "."));
      const parsedDia = Number.parseFloat(diastolic.replace(",", "."));
      const parsedHr = Number.parseFloat(heartRate.replace(",", "."));
      const parsedSpo2 = Number.parseInt(spo2.replace(",", "."), 10);

      const vitals = {
        ...(Number.isFinite(parsedTemp) ? { temperatureC: Number(parsedTemp.toFixed(1)) } : {}),
        ...(Number.isFinite(parsedSys) ? { systolicMmHg: Math.round(parsedSys) } : {}),
        ...(Number.isFinite(parsedDia) ? { diastolicMmHg: Math.round(parsedDia) } : {}),
        ...(Number.isFinite(parsedHr) ? { heartRateBpm: Math.round(parsedHr) } : {}),
      };

      const bedsideTags = [
        Number.isFinite(parsedSpo2) ? `SpO2 ${parsedSpo2}%` : "",
        `Pain ${painScore}/10`,
      ]
        .filter(Boolean)
        .join(" · ");
      const enrichedObjective = objective.includes("SpO2") || objective.includes("Pain ")
        ? objective
        : `${bedsideTags} — ${objective}`;

      const res = await createVisitNote(apiBaseUrl, sessionToken, {
        patientUserId: patientUuid.trim(),
        icd10Codes: ["Z48.0"],
        subjective,
        objective: enrichedObjective,
        assessment,
        plan,
        ...(Object.keys(vitals).length > 0 ? { vitals } : {}),
      });
      if (!res.ok) {
        setBanner({ tone: "error", text: res.error });
        return;
      }
      setVisitNotes((prev) => [res.data.visitNote, ...prev]);
      setSubjective("");
      setObjective("");
      setAssessment("");
      setPlan("");
      setPainScore(0);
      setBanner({ tone: "success", text: c.noteSaved(res.data.visitNote.patientName) });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handlePublishShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionToken || !currentUser || actionLockRef.current) return;
    const days = publishWeekdays ? [1, 2, 3, 4, 5] : [schedDay];
    const parsed = CreateScheduleSchema.safeParse({
      facilityId: schedFacilityId,
      doctorUserId: currentUser.id,
      dayOfWeek: days[0],
      startTimeUtc: schedStart,
      endTimeUtc: schedEnd,
      slotDurationMinutes: Number(schedDuration) || 30,
      visitMode: schedMode,
    });
    if (!parsed.success) {
      setBanner({
        tone: "error",
        text:
          locale === "fr"
            ? "Créneau ou durée de garde invalide."
            : locale === "ar"
              ? "نافذة المناوبة أو المدة غير صالحة."
              : "Invalid shift window or duration.",
      });
      return;
    }

    actionLockRef.current = true;
    setBusy(true);
    try {
      await upsertDoctorProfile(apiBaseUrl, sessionToken, {
        specialty: specialtyInput.trim() || "Home Nursing & Wound Care",
        licenseNumber: licenseInput.trim(),
        consultationFeeMinor: Number(feeMinorInput) || 0,
      });

      const createdResults = await Promise.all(
        days.map((day) =>
          createSchedule(apiBaseUrl, sessionToken, {
            ...parsed.data,
            dayOfWeek: day,
          }),
        ),
      );
      const createdShifts: DoctorScheduleSummary[] = [];
      for (const res of createdResults) {
        if (!res.ok) {
          if (createdShifts.length > 0) {
            setSchedules((prev) => [...prev, ...createdShifts]);
          }
          setBanner({ tone: "error", text: res.error });
          return;
        }
        createdShifts.push(res.data.schedule);
      }
      setSchedules((prev) => [...prev, ...createdShifts]);
      setBanner({ tone: "success", text: c.shiftPublished(createdShifts.length) });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleToggleShift(item: DoctorScheduleSummary) {
    if (!sessionToken || actionLockRef.current) return;
    actionLockRef.current = true;
    const snapshot = schedules;
    setSchedules((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, isActive: !s.isActive } : s)),
    );
    try {
      const res = await updateSchedule(apiBaseUrl, sessionToken, item.id, {
        isActive: !item.isActive,
      });
      if (!res.ok) {
        setSchedules(snapshot);
        setBanner({ tone: "error", text: res.error });
        return;
      }
      setSchedules((prev) =>
        prev.map((s) => (s.id === item.id ? res.data.schedule : s)),
      );
      setBanner({ tone: "success", text: c.shiftToggled(res.data.schedule.isActive) });
    } finally {
      actionLockRef.current = false;
    }
  }

  async function handleUpdateShift(
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
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setSchedules((prev) =>
      prev.map((item) => (item.id === scheduleId ? res.data.schedule : item)),
    );
    setBanner({
      tone: "success",
      text: `${res.data.schedule.startTimeUtc}–${res.data.schedule.endTimeUtc}`,
    });
  }

  async function handleDuplicateShift(
    item: DoctorScheduleSummary,
    targetDayOfWeek: number,
  ) {
    if (!sessionToken) return;
    const res = await createSchedule(apiBaseUrl, sessionToken, {
      facilityId: item.facilityId,
      dayOfWeek: targetDayOfWeek,
      startTimeUtc: item.startTimeUtc,
      endTimeUtc: item.endTimeUtc,
      slotDurationMinutes: item.slotDurationMinutes,
      visitMode: item.visitMode,
    });
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setSchedules((prev) => [...prev, res.data.schedule]);
    setBanner({ tone: "success", text: c.shiftPublished(1) });
  }

  async function handleRemoveShift(scheduleId: string) {
    if (!sessionToken || actionLockRef.current) return;
    actionLockRef.current = true;
    const snapshot = schedules;
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    try {
      const res = await deleteSchedule(apiBaseUrl, sessionToken, scheduleId);
      if (!res.ok) {
        setSchedules(snapshot);
        setBanner({ tone: "error", text: res.error });
        return;
      }
      setBanner({ tone: "success", text: c.shiftDeleted });
    } finally {
      actionLockRef.current = false;
    }
  }

  async function handleSavePracticeProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionToken) return;
    setBusy(true);
    const res = await upsertDoctorProfile(apiBaseUrl, sessionToken, {
      specialty: specialtyInput.trim(),
      licenseNumber: licenseInput.trim(),
      consultationFeeMinor: Number(feeMinorInput) || 0,
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setBanner({
      tone: "success",
      text:
        locale === "fr"
          ? "Registre infirmier mis à jour."
          : locale === "ar"
            ? "تم حفظ سجل التمريض بنجاح."
            : "Nursing registry saved.",
    });
  }

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
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
              onClick={() => void refreshNurseData(sessionToken, selectedCountry, currentUser)}
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
        allowedRoles={["NURSE"]}
        workspaceTitle={c.guardTitle}
        requiredRoleDescription={c.guardRoles}
        allowPendingMatchingRole
      >
        <UiTabBar
          ariaLabel="Nurse station workspace tabs"
          activeTab={activeTab}
          onSelect={setActiveTab}
          tabs={[
            {
              id: "rounds",
              label: c.tabRounds,
              icon: <Calendar className="h-3.5 w-3.5" aria-hidden="true" />,
            },
            {
              id: "care",
              label: c.tabCare,
              icon: <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />,
            },
            {
              id: "schedule",
              label: c.tabSchedule,
              icon: <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />,
            },
            {
              id: "papers",
              label: c.tabPapers,
              icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
            },
          ]}
        />

        {activeTab === "rounds" ? (
          <DoctorCalendarAgenda
            currentUser={currentUser}
            appointments={appointments}
            schedules={nurseSchedules}
            selectedPatientId={patientUuid}
            patientProfile={patientProfile}
            patientProfileLoading={patientProfileLoading}
            busy={busy}
            isLockedPendingVerification={isPendingStaff}
            onSelectPatientForConsultation={(pid) => {
              setPatientUuid(pid);
              setActiveTab("care");
            }}
            onInspectPatient={(pid) => setPatientUuid(pid)}
            onTransitionAppointment={async (apptId, status) => {
              if (!sessionToken) return;
              setBusy(true);
              const res = await transitionAppointmentStatus(apiBaseUrl, sessionToken, apptId, {
                status,
              });
              setBusy(false);
              if (!res.ok) {
                setBanner({ tone: "error", text: res.error });
                return;
              }
              await refreshNurseData(sessionToken, selectedCountry, currentUser);
            }}
            onUpdateSchedule={handleUpdateShift}
            onJumpToShifts={() => setActiveTab("schedule")}
          />
        ) : null}

        {activeTab === "care" ? (
          <div className="space-y-4">
            {/* Persistent Bedside Patient Safety & Allergy Banner */}
            <section className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EBF4FF]/80 via-white to-white p-4 shadow-[0_6px_22px_-12px_rgba(0,102,204,0.14)] sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  <EntityPicker
                    id="nurse-patient-picker"
                    label={c.patientLabel}
                    placeholder={c.patientPlaceholder}
                    emptyLabel={c.patientEmpty}
                    options={patientPickerOptions}
                    value={patientUuid}
                    onChange={setPatientUuid}
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  {patientProfile?.bloodType ? (
                    <UiBadge tone="teal">
                      {locale === "fr"
                        ? "Groupe"
                        : locale === "ar"
                          ? "فصيلة الدم"
                          : "Blood"}
                      : {patientProfile.bloodType}
                    </UiBadge>
                  ) : null}
                  {patientProfile?.emergencyContactPhone ? (
                    <a
                      href={`tel:${patientProfile.emergencyContactPhone}`}
                      dir="ltr"
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                      <span>ICE: {patientProfile.emergencyContactPhone}</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {patientProfileLoading ? (
                <p className="mt-3 text-xs text-[#6B829D]">
                  {locale === "fr"
                    ? "Chargement du profil sécurité patient…"
                    : locale === "ar"
                      ? "جاري تحميل ملف السلامة…"
                      : "Loading patient safety profile…"}
                </p>
              ) : patientProfile ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#D7E4F2]/70 pt-3 text-xs">
                  {patientProfile.allergies.length > 0 ? (
                    <div className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 font-bold text-rose-950">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                      <span>
                        {locale === "fr"
                          ? "Allergies :"
                          : locale === "ar"
                            ? "الحساسية:"
                            : "Allergies:"}{" "}
                        {patientProfile.allergies
                          .map((a) => `${a.allergen} (${a.severity})`)
                          .join(", ")}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-xl border border-[#B2E5DC] bg-[#E6F7F4] px-3 py-1.5 font-semibold text-[#0B6B5C]">
                      {locale === "fr"
                        ? "Aucune allergie connue"
                        : locale === "ar"
                          ? "لا حساسية دوائية معروفة"
                          : "NKDA"}
                    </span>
                  )}
                  {patientProfile.chronicConditions.length > 0 ? (
                    <span className="rounded-xl border border-[#D7E4F2] bg-white px-3 py-1.5 text-[#2F4661]">
                      <strong className="text-[#0F243E]">
                        {locale === "fr"
                          ? "Antécédents :"
                          : locale === "ar"
                            ? "الأمراض المزمنة:"
                            : "Conditions:"}
                      </strong>{" "}
                      {patientProfile.chronicConditions.join(", ")}
                    </span>
                  ) : null}
                  {patientProfile.currentMedications.length > 0 ? (
                    <span className="rounded-xl border border-[#D7E4F2] bg-white px-3 py-1.5 text-[#2F4661]">
                      <strong className="text-[#0F243E]">
                        {locale === "fr"
                          ? "Traitements :"
                          : locale === "ar"
                            ? "الأدوية:"
                            : "Active Meds:"}
                      </strong>{" "}
                      {patientProfile.currentMedications.join(", ")}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F1FA] pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-editorial text-base font-bold text-[#0F243E]">{c.careTitle}</h2>
                  <MoroccanComplianceBadge domain="nurse" locale={locale} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        id: "wound",
                        labels: { en: "Wound Dressing", fr: "Pansement", ar: "تضميد الجروح" },
                        s: {
                          en: "Home visit for post-operative dressing change; pain minimal.",
                          fr: "Visite à domicile pour réfection de pansement post-opératoire ; douleur minime.",
                          ar: "زيارة منزلية لتغيير الضماد بعد العملية؛ الألم طفيف.",
                        },
                        o: {
                          en: "Incision clean, dry, intact, no erythema or drainage.",
                          fr: "Plaie propre, sèche, sans érythème ni écoulement.",
                          ar: "الجرح نظيف وجاف دون احمرار أو إفرازات.",
                        },
                        a: {
                          en: "Normal surgical wound healing.",
                          fr: "Cicatrisation post-opératoire satisfaisante.",
                          ar: "التئام جراحي طبيعي.",
                        },
                        p: {
                          en: "Sterile dressing applied; schedule next check in 48h.",
                          fr: "Pansement stérile posé ; prochain contrôle dans 48h.",
                          ar: "تطبيق ضماد معقم وموعد المراقبة القادم بعد 48 ساعة.",
                        },
                      },
                      {
                        id: "vitals",
                        labels: { en: "Home Vitals Check", fr: "Constantes Domicile", ar: "فحص المؤشرات بالمنزل" },
                        s: {
                          en: "Scheduled home nursing check-up; patient resting comfortably.",
                          fr: "Bilan infirmier programmé à domicile ; patient calme et confortable.",
                          ar: "فحص تمريضي منزلي مبرمج؛ حالة المريض مستقرة.",
                        },
                        o: {
                          en: "Vitals stable within target parameters; good hydration.",
                          fr: "Constantes stables dans les normes ; bonne hydratation.",
                          ar: "المؤشرات الحيوية مستقرة ضمن المعدل الطبيعي.",
                        },
                        a: {
                          en: "Hemodynamically stable home care patient.",
                          fr: "Patient stable sur le plan hémodynamique.",
                          ar: "حالة مستقرة في الرعاية المنزلية.",
                        },
                        p: {
                          en: "Medication adherence reinforced; physician notified.",
                          fr: "Observance vérifiée ; médecin traitant informé.",
                          ar: "التأكد من الالتزام بالدواء وإشعار الطبيب المعالج.",
                        },
                      },
                      {
                        id: "injection",
                        labels: { en: "Injection / IV Care", fr: "Injection / Perfusion", ar: "حقن / تروية وريدية" },
                        s: {
                          en: "Scheduled prescribed injection / infusion visit.",
                          fr: "Soin programmé d'injection / perfusion sur ordonnance.",
                          ar: "زيارة لإجراء حقنة أو تروية وريدية وفق الوصفة الطبية.",
                        },
                        o: {
                          en: "Site inspected, aseptic administration completed without reaction.",
                          fr: "Point d'injection vérifié, administration aseptique sans réaction.",
                          ar: "فحص موضع الحقن وإتمام الإجراء بتعقيم كامل دون مضاعفات.",
                        },
                        a: {
                          en: "Treatment tolerated well.",
                          fr: "Bonne tolérance du traitement.",
                          ar: "تم تقبل العلاج بشكل جيد.",
                        },
                        p: {
                          en: "Observed 15 min post-dose; log updated in EHR.",
                          fr: "Surveillance 15 min post-acte ; dossier infirmier mis à jour.",
                          ar: "مراقبة لمدة 15 دقيقة بعد الجرعة وتحديث الملف الطبي.",
                        },
                      },
                      {
                        id: "glucose",
                        labels: { en: "Blood Glucose", fr: "Glycémie Capillaire", ar: "قياس السكر" },
                        s: {
                          en: "Capillary blood glucose monitoring check.",
                          fr: "Contrôle de la glycémie capillaire à domicile.",
                          ar: "مراقبة مستوى السكر في الدم بالمنزل.",
                        },
                        o: {
                          en: "Fasting capillary glucose checked; skin perfusion intact.",
                          fr: "Glycémie capillaire vérifiée ; perfusion cutanée normale.",
                          ar: "تم قياس السكر الصائم؛ التروية الجلدية طبيعية.",
                        },
                        a: {
                          en: "Glycemic check logged for attending physician.",
                          fr: "Suivi glycémique transmis au médecin traitant.",
                          ar: "تم توثيق قياس السكر للطبيب المعالج.",
                        },
                        p: {
                          en: "Continue prescribed regimen; review log at next visit.",
                          fr: "Poursuite du protocole prescrit ; contrôle à la prochaine visite.",
                          ar: "مواصلة البروتوكول الموصوف والمراجعة في الزيارة القادمة.",
                        },
                      },
                      {
                        id: "suture",
                        labels: { en: "Suture Removal", fr: "Ablation Fils", ar: "إزالة الغرز" },
                        s: {
                          en: "Scheduled suture / staple removal check.",
                          fr: "Séance programmée d'ablation des fils / agrafes.",
                          ar: "زيارة مبرمجة لإزالة الغرز الجراحية.",
                        },
                        o: {
                          en: "Edges well-approximated; sutures removed cleanly without bleeding.",
                          fr: "Berges bien affrontées ; ablation propre sans saignement.",
                          ar: "حواف الجرح ملتحمة وتمت إزالة الغرز بنظافة دون نزيف.",
                        },
                        a: {
                          en: "Healed surgical incision.",
                          fr: "Incision chirurgicale cicatrisée.",
                          ar: "الجرح الجراحي ملتئم تماماً.",
                        },
                        p: {
                          en: "Keep dry 24h; monitor for redness or swelling.",
                          fr: "Garder au sec 24h ; surveiller rougeur ou gonflement.",
                          ar: "الحفاظ على جفاف المنطقة 24 ساعة ومراقبة أي احمرار.",
                        },
                      },
                      {
                        id: "nebulizer",
                        labels: { en: "O2 / Nebulizer", fr: "O2 / Nébulisation", ar: "أكسجين / استنشاق" },
                        s: {
                          en: "Respiratory nebulization / oxygen check.",
                          fr: "Séance de nébulisation et contrôle SpO2.",
                          ar: "جلسة استنشاق ومراقبة نسبة الأكسجين.",
                        },
                        o: {
                          en: "Nebulization completed; breathing effort improved post-treatment.",
                          fr: "Nébulisation réalisée ; amélioration de la mécanique respiratoire.",
                          ar: "اكتملت الجلسة مع تحسن واضح في التنفس.",
                        },
                        a: {
                          en: "Improved airway clearance.",
                          fr: "Dégagement bronchique amélioré.",
                          ar: "تحسن في سالكية المجاري التنفسية.",
                        },
                        p: {
                          en: "Reassess SpO2 in 4h; escalate to MD if SpO2 < 94%.",
                          fr: "Contrôler SpO2 à 4h ; alerter le médecin si SpO2 < 94 %.",
                          ar: "إعادة فحص الأكسجين بعد 4 ساعات وإبلاغ الطبيب إذا قل عن 94%.",
                        },
                      },
                    ] as const
                  ).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setSubjective(tpl.s[locale]);
                        setObjective(tpl.o[locale]);
                        setAssessment(tpl.a[locale]);
                        setPlan(tpl.p[locale]);
                      }}
                      className="min-h-[30px] rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#0052A3] transition hover:bg-[#0066CC] hover:text-white active:scale-95"
                    >
                      {tpl.labels[locale]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-4 flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EBF4FF]/65 px-3.5 py-2 text-xs font-medium text-[#0052A3]">
                <Info className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
                <span>{c.rxRestrictionBanner}</span>
              </div>

              {/* Live Tactile Clinical Vitals Steppers + Visual 0-10 Pain Scale */}
              {(() => {
                const tVal = Number.parseFloat(tempC);
                const sVal = Number.parseFloat(systolic);
                const dVal = Number.parseFloat(diastolic);
                const hrVal = Number.parseFloat(heartRate);
                const o2Val = Number.parseInt(spo2, 10);
                const tempAlert = Number.isFinite(tVal) && (tVal >= 38 || tVal < 35.5);
                const bpAlert = Number.isFinite(sVal) && (sVal >= 140 || (Number.isFinite(dVal) && dVal >= 90));
                const hrAlert = Number.isFinite(hrVal) && (hrVal > 100 || hrVal < 55);
                const o2Alert = Number.isFinite(o2Val) && o2Val < 94;
                const painLabel =
                  locale === "fr"
                    ? "Douleur (EVA)"
                    : locale === "ar"
                      ? "مقياس الألم"
                      : "Pain Score";
                return (
                  <div className="mb-4 space-y-3">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                      <ClinicalStepper
                        label={c.tempLabel}
                        value={tempC}
                        onChange={setTempC}
                        step={0.1}
                        min={30}
                        max={45}
                        decimals={1}
                        unit="°C"
                        tone={tempAlert ? "alert" : "default"}
                        presets={[
                          { label: "36.6", value: "36.6" },
                          { label: "37.2", value: "37.2" },
                          { label: "38.5", value: "38.5" },
                        ]}
                      />
                      <ClinicalStepper
                        label={c.systolicLabel}
                        value={systolic}
                        onChange={setSystolic}
                        step={5}
                        min={40}
                        max={300}
                        unit="mmHg"
                        tone={bpAlert ? "alert" : "default"}
                        presets={[
                          { label: "115", value: "115" },
                          { label: "120", value: "120" },
                          { label: "145", value: "145" },
                        ]}
                      />
                      <ClinicalStepper
                        label={c.diastolicLabel}
                        value={diastolic}
                        onChange={setDiastolic}
                        step={5}
                        min={20}
                        max={200}
                        unit="mmHg"
                        tone={bpAlert ? "alert" : "default"}
                        presets={[
                          { label: "75", value: "75" },
                          { label: "80", value: "80" },
                          { label: "95", value: "95" },
                        ]}
                      />
                      <ClinicalStepper
                        label={c.hrLabel}
                        value={heartRate}
                        onChange={setHeartRate}
                        step={2}
                        min={20}
                        max={260}
                        unit="bpm"
                        tone={hrAlert ? "alert" : "default"}
                        presets={[
                          { label: "68", value: "68" },
                          { label: "76", value: "76" },
                          { label: "98", value: "98" },
                        ]}
                      />
                      <ClinicalStepper
                        label="SpO2"
                        value={spo2}
                        onChange={setSpo2}
                        step={1}
                        min={50}
                        max={100}
                        unit="%"
                        tone={o2Alert ? "alert" : "default"}
                        presets={[
                          { label: "99%", value: "99" },
                          { label: "96%", value: "96" },
                          { label: "92%", value: "92" },
                        ]}
                      />
                    </div>

                    {/* Tactile Visual 0-10 Pain Scale Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D7E4F2] bg-[#F8FBFE] px-3.5 py-2.5">
                      <span className="text-xs font-bold text-[#0F243E]">
                        {painLabel}:{" "}
                        <span className="font-mono-tabular text-[#0066CC]">{painScore}/10</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => {
                          const selected = painScore === lvl;
                          const color =
                            lvl >= 7
                              ? selected
                                ? "bg-[#DC2626] text-white border-[#B91C1C]"
                                : "bg-white text-[#DC2626] border-rose-200 hover:bg-rose-50"
                              : lvl >= 4
                                ? selected
                                  ? "bg-amber-600 text-white border-amber-700"
                                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
                                : selected
                                  ? "bg-[#0F9D88] text-white border-[#0B6B5C]"
                                  : "bg-white text-[#0B6B5C] border-[#B2E5DC] hover:bg-[#E6F7F4]";
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setPainScore(lvl)}
                              className={`h-8 w-8 rounded-lg border font-mono-tabular text-xs font-bold transition-colors active:scale-95 ${color}`}
                            >
                              {lvl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={(e) => void handleSaveCareNote(e)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {c.subjectiveLabel}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      placeholder={c.subjectivePlaceholder}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {c.objectiveLabel}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder={c.objectivePlaceholder}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {c.assessmentLabel}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      placeholder={c.assessmentPlaceholder}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {c.planLabel}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      placeholder={c.planPlaceholder}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <UiButton type="submit" disabled={busy || !sessionToken || isPendingStaff}>
                  {c.saveCareBtn}
                </UiButton>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">
                {c.historyHeading(visitNotes.length)}
              </h3>
              {visitNotes.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">{c.historyEmpty}</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {visitNotes.slice(0, 30).map((note) => {
                    const isSelfNurse = Boolean(
                      currentUser && note.doctorUserId === currentUser.id,
                    );
                    const spo2Match = note.objective?.match(/SpO2\s+(\d{2,3}%)/i);
                    const painMatch =
                      note.objective?.match(/Pain\s+(\d{1,2}\/10)/i) ??
                      note.subjective?.match(/Pain\s+(\d{1,2}\/10)/i);
                    const authorDisplay = isSelfNurse
                      ? note.doctorName.replace(/^Dr\.\s*/i, "")
                      : formatPractitionerDisplayName(note.doctorName);
                    return (
                      <li
                        key={note.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold text-slate-900">
                            <EntityAvatar
                              name={note.doctorName}
                              role={isSelfNurse ? "NURSE" : "DOCTOR"}
                              size="xs"
                            />
                            <span>
                              {note.patientName} · {authorDisplay}
                            </span>
                            {isSelfNurse ? (
                              <UiBadge tone="teal">
                                {locale === "fr"
                                  ? "Infirmier"
                                  : locale === "ar"
                                    ? "ممرض"
                                    : "Nurse"}
                              </UiBadge>
                            ) : null}
                          </span>
                          <div
                            dir="ltr"
                            className="flex flex-wrap items-center gap-1.5 font-mono-tabular text-[11px]"
                          >
                            {note.vitals?.temperatureC ? (
                              <span className="rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2 py-0.5 font-semibold text-[#0B6B5C]">
                                {note.vitals.temperatureC}°C
                              </span>
                            ) : null}
                            {note.vitals?.systolicMmHg && note.vitals?.diastolicMmHg ? (
                              <span className="rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2 py-0.5 font-semibold text-[#0052A3]">
                                {note.vitals.systolicMmHg}/{note.vitals.diastolicMmHg} mmHg
                              </span>
                            ) : null}
                            {note.vitals?.heartRateBpm ? (
                              <span className="rounded-full border border-[#D7E4F2] bg-white px-2 py-0.5 font-semibold text-[#2F4661]">
                                {note.vitals.heartRateBpm} bpm
                              </span>
                            ) : null}
                            {spo2Match ? (
                              <span className="rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2 py-0.5 font-semibold text-[#0052A3]">
                                SpO2 {spo2Match[1]}
                              </span>
                            ) : null}
                            {painMatch ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                                {locale === "fr"
                                  ? "Douleur"
                                  : locale === "ar"
                                    ? "الألم"
                                    : "Pain"}{" "}
                                {painMatch[1]}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1.5 text-slate-700">
                          <bdi dir="auto">{note.assessment}</bdi> —{" "}
                          <bdi dir="auto">{note.plan}</bdi>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "schedule" ? (
          <VisualScheduleBuilder
            currentUser={currentUser}
            schedules={nurseSchedules}
            clinicOptions={clinicOptions}
            currencyCode={activePack?.currencyCode ?? selectedCountry}
            canManageSchedule={Boolean(currentUser && !isPendingStaff)}
            isPendingStaff={isPendingStaff}
            busy={busy}
            showPracticeProfileFields={false}
            specialtyInput={specialtyInput}
            licenseInput={licenseInput}
            feeMinorInput={feeMinorInput}
            schedFacilityId={schedFacilityId}
            schedDay={schedDay}
            schedStart={schedStart}
            schedEnd={schedEnd}
            schedDuration={schedDuration}
            schedMode={schedMode}
            publishWeekdays={publishWeekdays}
            allowedModes={["HOME_VISIT", "IN_PERSON"]}
            onFacilityChange={setSchedFacilityId}
            onDayChange={setSchedDay}
            onStartChange={setSchedStart}
            onEndChange={setSchedEnd}
            onDurationChange={setSchedDuration}
            onModeChange={setSchedMode}
            onPublishWeekdaysChange={setPublishWeekdays}
            onSubmitPublish={(e) => void handlePublishShift(e)}
            onToggleSchedule={(s) => void handleToggleShift(s)}
            onDeleteSchedule={(s) => void handleRemoveShift(s.id)}
            onUpdateSchedule={handleUpdateShift}
            onDuplicateSchedule={handleDuplicateShift}
            heading={c.shiftHeading}
            signInHint={
              locale === "fr"
                ? "Connectez-vous en tant qu'infirmier vérifié pour publier vos gardes."
                : locale === "ar"
                  ? "سجل الدخول كممرض معتمد لنشر مواعيد المناوبة."
                  : "Sign in as a verified nurse to publish shifts."
            }
            publishBtnLabel={c.publishShiftBtn}
            publishWeekdaysLabel={c.publishWeekdaysLabel}
            activeStatusLabel={c.activeStatus}
            pausedStatusLabel={c.pausedStatus}
            pauseBtnLabel={c.pauseBtn}
            resumeBtnLabel={c.resumeBtn}
            deleteBtnLabel={c.deleteBtn}
            clinicLabel={c.facilityLabel}
            clinicPlaceholder={c.facilityPlaceholder}
            clinicEmpty={c.facilityEmpty}
          />
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
            onSavePracticeProfile={handleSavePracticeProfile}
            onBusyChange={setBusy}
            onDocumentsUpdated={() => refreshPapers(sessionToken, currentUser)}
            onFeedback={(tone, text) => setBanner({ tone, text })}
          />
        ) : null}
      </WorkspaceRoleGuard>
    </div>
  );
}
