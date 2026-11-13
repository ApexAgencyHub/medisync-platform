"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CreateScheduleSchema,
  LoginSchema,
  VisitModeSchema,
  type AppointmentStatus,
  type AppointmentSummary,
  type AuthenticatedUser,
  type AvailableSlot,
  type CountryPack,
  type DoctorScheduleSummary,
  type FacilitySummary,
  type VisitMode,
} from "@medisync/contracts";
import { listFacilities, loginUser } from "@/features/auth-portal";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  CalendarClock,
  CheckCircle2,
  KeyRound,
  LogOut,
  Search,
  ShieldAlert,
  Stethoscope,
  Video,
} from "lucide-react";
import {
  createAppointment,
  createSchedule,
  fetchAppointments,
  fetchAvailableSlots,
  fetchSchedules,
  transitionAppointmentStatus,
  upsertDoctorProfile,
} from "../api-client";

interface BookingWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  CONFIRMED: "border-teal-200 bg-teal-50 text-teal-900",
  CHECKED_IN: "border-amber-200 bg-amber-50 text-amber-900",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  NO_SHOW: "border-red-200 bg-red-50 text-red-900",
};

function getNextMondayIsoDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset),
  );
  return target.toISOString().slice(0, 10);
}

function getUtcDayOfWeek(dateStr: string): number {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? 1 : parsed.getUTCDay();
}

export function BookingWorkspace({
  packs,
  apiBaseUrl,
}: BookingWorkspaceProps) {
  const defaultCode = packs[0]?.code ?? "INTL";
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [selectedDate, setSelectedDate] = useState<string>(
    getNextMondayIsoDate,
  );
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [visitModeFilter, setVisitModeFilter] = useState<VisitMode | "ALL">(
    "ALL",
  );
  const [includeBooked, setIncludeBooked] = useState(true);
  const [bookingReason, setBookingReason] = useState("");

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [schedules, setSchedules] = useState<DoctorScheduleSummary[]>([]);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Doctor Profile & Shift Publishing Form
  const [specialtyInput, setSpecialtyInput] = useState("Cardiology");
  const [mdLicenseInput, setMdLicenseInput] = useState("INTL-MD-44021");
  const [feeMinorInput, setFeeMinorInput] = useState("35000");
  const [schedFacilityId, setSchedFacilityId] = useState("");
  const [schedDoctorId, setSchedDoctorId] = useState("");
  const [schedDay, setSchedDay] = useState<number>(() =>
    getUtcDayOfWeek(getNextMondayIsoDate()),
  );
  const [schedStart, setSchedStart] = useState("09:00");
  const [schedEnd, setSchedEnd] = useState("12:00");
  const [schedDuration, setSchedDuration] = useState("30");
  const [schedMode, setSchedMode] = useState<VisitMode>("IN_PERSON");

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
      if (stored.user.role === "DOCTOR") {
        setSchedDoctorId(stored.user.id);
      }
    }
  }, []);

  async function handleSearchSlots() {
    setBusy(true);
    setBanner(null);

    const [slotsRes, schedRes] = await Promise.all([
      fetchAvailableSlots(apiBaseUrl, {
        date: selectedDate,
        countryCode: selectedCountry,
        specialty: specialtyFilter.trim() || undefined,
        visitMode: visitModeFilter === "ALL" ? undefined : visitModeFilter,
        includeBooked,
      }),
      fetchSchedules(apiBaseUrl, { countryCode: selectedCountry }),
    ]);

    setBusy(false);

    if (!slotsRes.ok) {
      setBanner({
        tone: "error",
        text: `Slot search failed: ${slotsRes.error}`,
      });
      return;
    }

    setSlots(slotsRes.data.slots);
    if (schedRes.ok) {
      setSchedules(schedRes.data.schedules);
    }

    setBanner({
      tone: "info",
      text: `Loaded ${slotsRes.data.slots.length} slot(s) for ${selectedDate} (${selectedCountry}).`,
    });
  }

  async function refreshAuthenticatedData(token: string, countryCode: string) {
    const [apptsRes, facRes] = await Promise.all([
      fetchAppointments(apiBaseUrl, token, countryCode),
      listFacilities(apiBaseUrl, token, countryCode),
    ]);

    if (apptsRes.ok) {
      setAppointments(apptsRes.data.appointments);
    }
    if (facRes.ok) {
      setFacilities(facRes.data.facilities);
      if (!schedFacilityId && facRes.data.facilities[0]) {
        setSchedFacilityId(facRes.data.facilities[0].id);
      }
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setBanner({
        tone: "error",
        text: "Enter a valid email and password.",
      });
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
    if (res.data.user.role === "DOCTOR") {
      setSchedDoctorId(res.data.user.id);
    }
    setLoginPassword("");

    await refreshAuthenticatedData(res.data.token, res.data.user.countryCode);
    setBanner({
      tone: "success",
      text: `Signed in as ${res.data.user.fullName} (${res.data.user.role}).`,
    });
  }

  async function handleBookSlot(slot: AvailableSlot) {
    if (!sessionToken) {
      setBanner({
        tone: "error",
        text: "Sign in as a Patient, Caregiver, or Clinic Staff member to reserve a slot.",
      });
      return;
    }

    setBusy(true);
    const trimmedReason = bookingReason.trim();
    const res = await createAppointment(apiBaseUrl, sessionToken, {
      scheduleId: slot.scheduleId,
      slotStartIso: slot.slotStartIso,
      visitMode: slot.visitMode,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text:
          res.status === 409
            ? "Slot was just booked concurrently by another patient across a partner clinic."
            : `Booking failed: ${res.error}`,
      });
      await handleSearchSlots();
      return;
    }

    setBanner({
      tone: "success",
      text: `Confirmed ${res.data.appointment.visitMode} booking with ${res.data.appointment.doctorName} at ${res.data.appointment.facilityName}.`,
    });
    await Promise.all([
      handleSearchSlots(),
      refreshAuthenticatedData(sessionToken, selectedCountry),
    ]);
  }

  async function handleTransitionStatus(
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await transitionAppointmentStatus(
      apiBaseUrl,
      sessionToken,
      appointmentId,
      { status },
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Status update failed: ${res.error}` });
      return;
    }

    setBanner({
      tone: "success",
      text: `Appointment updated to ${res.data.appointment.status}.`,
    });
    await Promise.all([
      handleSearchSlots(),
      refreshAuthenticatedData(sessionToken, selectedCountry),
    ]);
  }

  async function handlePublishSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) {
      setBanner({ tone: "error", text: "Sign in to publish schedules." });
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
        text: parsedSchedule.error.issues[0]?.message ?? "Invalid shift window.",
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
      text: `Published ${res.data.schedule.visitMode} shift for ${res.data.schedule.doctorName} at ${res.data.schedule.facilityName}.`,
    });
    await handleSearchSlots();
  }

  const canManageSchedule =
    currentUser !== null &&
    ["DOCTOR", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
      currentUser.role,
    );

  return (
    <div
      dir={activePack?.direction ?? "ltr"}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              Slice 3 · Multi-Clinic Scheduling & Transactional Locking
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Doctor Shift Roster & Appointment Engine
            </h1>
            <p className="text-sm text-slate-600">
              PostgreSQL <code className="font-mono-tabular text-xs">FOR UPDATE</code>{" "}
              doctor locks + partial unique indexes prevent cross-clinic double-booking in{" "}
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
                    setSlots([]);
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

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-3">
            <label
              htmlFor="booking-date"
              className="block text-xs font-semibold text-slate-700"
            >
              Consultation Date (UTC)
            </label>
            <input
              id="booking-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSchedDay(getUtcDayOfWeek(e.target.value));
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900"
            />
          </div>

          <div className="min-w-0 lg:col-span-3">
            <label
              htmlFor="specialty-filter"
              className="block text-xs font-semibold text-slate-700"
            >
              Specialty Filter
            </label>
            <input
              id="specialty-filter"
              type="text"
              placeholder="e.g. Cardiology"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div className="min-w-0 lg:col-span-2">
            <label
              htmlFor="visit-mode-filter"
              className="block text-xs font-semibold text-slate-700"
            >
              Visit Mode
            </label>
            <select
              id="visit-mode-filter"
              value={visitModeFilter}
              onChange={(e) =>
                setVisitModeFilter(
                  e.target.value === "ALL"
                    ? "ALL"
                    : VisitModeSchema.parse(e.target.value),
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              <option value="ALL">All Modes</option>
              <option value="IN_PERSON">In-Person</option>
              <option value="TELEHEALTH">Telehealth</option>
            </select>
          </div>

          <div className="flex items-end lg:col-span-2">
            <label className="inline-flex min-h-[38px] items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeBooked}
                onChange={(e) => setIncludeBooked(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-800"
              />
              <span>Show booked</span>
            </label>
          </div>

          <div className="flex items-end lg:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSearchSlots()}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-900 disabled:opacity-60"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Find Slots</span>
            </button>
          </div>
        </div>

        {banner ? (
          <div
            role="status"
            className={
              banner.tone === "error"
                ? "mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                : banner.tone === "success"
                  ? "mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
                  : "mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-900"
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
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Available Multi-Clinic Slots
                </h2>
                <p className="text-xs text-slate-600">
                  Weekday:{" "}
                  <span className="font-semibold">
                    {WEEKDAY_LABELS[getUtcDayOfWeek(selectedDate)]}
                  </span>{" "}
                  · Currency:{" "}
                  <span className="font-mono-tabular font-semibold">
                    {activePack?.currencyCode ?? "USD"}
                  </span>
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono-tabular text-xs font-semibold text-slate-700">
                {slots.filter((s) => s.isAvailable).length} open / {slots.length} total
              </span>
            </div>

            <div className="mt-3">
              <label
                htmlFor="visit-reason"
                className="block text-xs font-semibold text-slate-700"
              >
                Consultation Note (optional)
              </label>
              <input
                id="visit-reason"
                type="text"
                placeholder="Symptoms or follow-up purpose"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {slots.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <CalendarClock
                  className="mx-auto h-6 w-6 text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-medium text-slate-700">
                  Click &ldquo;Find Slots&rdquo; after publishing a doctor schedule for{" "}
                  {WEEKDAY_LABELS[getUtcDayOfWeek(selectedDate)]} to inspect real-time
                  clinic availability.
                </p>
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {slots.map((slot) => (
                  <li
                    key={`${slot.scheduleId}-${slot.slotStartIso}`}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-sm font-bold text-slate-900">
                          {slot.slotStartIso.slice(11, 16)}–
                          {slot.slotEndIso.slice(11, 16)} UTC
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {slot.visitMode === "TELEHEALTH" ? (
                            <Video className="h-3 w-3 text-teal-700" />
                          ) : (
                            <Stethoscope className="h-3 w-3 text-teal-700" />
                          )}
                          {slot.visitMode}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">
                        {slot.doctorName} · {slot.specialty}
                      </p>
                      <p className="text-xs text-slate-600">{slot.facilityName}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
                      <span className="font-mono-tabular text-xs font-semibold text-slate-700">
                        {(slot.consultationFeeMinor / 100).toFixed(2)}{" "}
                        {activePack?.currencyCode ?? slot.countryCode}
                      </span>
                      {slot.isAvailable ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleBookSlot(slot)}
                          className="min-h-[34px] rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                        >
                          Reserve
                        </button>
                      ) : (
                        <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Locked / Booked
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {schedules.length > 0 ? (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Active Facility Rosters ({schedules.length})
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {schedules.slice(0, 6).map((sched) => (
                    <li
                      key={sched.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-900">
                        {sched.doctorName} @ {sched.facilityName}
                      </span>
                      <span className="font-mono-tabular text-slate-600">
                        {WEEKDAY_LABELS[sched.dayOfWeek]} {sched.startTimeUtc}–
                        {sched.endTimeUtc} ({sched.slotDurationMinutes}m)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound
                  className="h-4 w-4 text-teal-800"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold text-slate-900">
                  Clinical & Patient Session
                </h2>
              </div>
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    clearStoredSession();
                    setSessionToken(null);
                    setCurrentUser(null);
                    setAppointments([]);
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

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Scoped Bookings Queue
                  </h3>
                  <button
                    type="button"
                    disabled={busy || !sessionToken}
                    onClick={() =>
                      sessionToken
                        ? void refreshAuthenticatedData(
                            sessionToken,
                            selectedCountry,
                          )
                        : undefined
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-teal-700"
                  >
                    Refresh
                  </button>
                </div>

                {appointments.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    No active appointments found for your account in {selectedCountry}.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {appointments.map((appt) => (
                      <li
                        key={appt.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-tabular font-bold text-slate-900">
                            {appt.slotStartIso.slice(0, 16).replace("T", " ")} UTC
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono-tabular text-[11px] font-semibold ${STATUS_STYLES[appt.status]}`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <p className="mt-1 font-semibold text-slate-800">
                          {appt.doctorName} · {appt.facilityName}
                        </p>
                        <p className="text-slate-600">
                          Patient: {appt.patientName} ({appt.visitMode})
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {appt.status === "CONFIRMED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleTransitionStatus(appt.id, "CANCELLED")
                              }
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-300 hover:text-red-800"
                            >
                              Cancel Slot
                            </button>
                          ) : null}
                          {canManageSchedule && appt.status === "CONFIRMED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleTransitionStatus(appt.id, "CHECKED_IN")
                              }
                              className="rounded-md bg-teal-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-900"
                            >
                              Check In
                            </button>
                          ) : null}
                          {canManageSchedule && appt.status === "CHECKED_IN" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleTransitionStatus(appt.id, "COMPLETED")
                              }
                              className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                            >
                              Complete Visit
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <form onSubmit={(e) => void handleLogin(e)} className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="booking-login-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Account Email
                  </label>
                  <input
                    id="booking-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="patient@medisync.global"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="booking-login-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="booking-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[38px] w-full rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                >
                  Sign In to Reserve or Manage Shifts
                </button>
              </form>
            )}
          </section>

          {canManageSchedule ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900">
                Publish Multi-Clinic Shift
              </h2>
              <form
                onSubmit={(e) => void handlePublishSchedule(e)}
                className="mt-3 space-y-3 text-xs"
              >
                {currentUser?.role === "DOCTOR" ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-700">
                        Specialty
                      </label>
                      <input
                        type="text"
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700">
                        Medical License #
                      </label>
                      <input
                        type="text"
                        value={mdLicenseInput}
                        onChange={(e) => setMdLicenseInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700">
                        Fee (Minor Currency Units)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={feeMinorInput}
                        onChange={(e) => setFeeMinorInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Doctor User UUID
                    </label>
                    <input
                      type="text"
                      required
                      value={schedDoctorId}
                      onChange={(e) => setSchedDoctorId(e.target.value)}
                      placeholder="Doctor account UUID"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700">
                    Facility
                  </label>
                  {facilities.length > 0 ? (
                    <select
                      value={schedFacilityId}
                      onChange={(e) => setSchedFacilityId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    >
                      {facilities.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name} ({fac.kind})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Facility UUID"
                      value={schedFacilityId}
                      onChange={(e) => setSchedFacilityId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">
                      UTC Day
                    </label>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    >
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <option key={label} value={idx}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Visit Mode
                    </label>
                    <select
                      value={schedMode}
                      onChange={(e) =>
                        setSchedMode(VisitModeSchema.parse(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    >
                      <option value="IN_PERSON">IN_PERSON</option>
                      <option value="TELEHEALTH">TELEHEALTH</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Start (UTC)
                    </label>
                    <input
                      type="text"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      End (UTC)
                    </label>
                    <input
                      type="text"
                      value={schedEnd}
                      onChange={(e) => setSchedEnd(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700">
                      Slot Duration (min)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={schedDuration}
                      onChange={(e) => setSchedDuration(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[38px] w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Publish Clinic Schedule Window
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
