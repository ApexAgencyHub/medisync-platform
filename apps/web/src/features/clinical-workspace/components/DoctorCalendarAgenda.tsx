"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import Link from "next/link";
import type {
  AppointmentStatus,
  AppointmentSummary,
  AuthenticatedUser,
  DoctorScheduleSummary,
  PatientMedicalProfile,
  UpdateScheduleInput,
  VisitMode,
} from "@medisync/contracts";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { CLINICAL_COPY } from "../clinical-i18n";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import {
  UiBadge,
  UiButton,
  type UiBadgeTone,
} from "@/shared/ui/primitives";
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileHeart,
  GripVertical,
  Home,
  LayoutGrid,
  List,
  Phone,
  Search,
  SlidersHorizontal,
  Stethoscope,
  UserCheck,
  Video,
  X,
  XCircle,
} from "lucide-react";
import {
  addUtcDays,
  formatDayHeading,
  formatMinutesToHhMm,
  formatMonthHeading,
  formatWeekRangeHeading,
  getMonthGridCells,
  getWeekStartMondayIso,
  packTimeIntervals,
  parseHhMmToMinutes,
  snapMinutes,
  toIsoDateOnly,
} from "./calendar-layout";

interface DoctorCalendarAgendaProps {
  currentUser: AuthenticatedUser | null;
  appointments: readonly AppointmentSummary[];
  schedules: readonly DoctorScheduleSummary[];
  selectedPatientId: string;
  patientProfile: PatientMedicalProfile | null;
  patientProfileLoading: boolean;
  busy: boolean;
  isLockedPendingVerification: boolean;
  onSelectPatientForConsultation: (
    patientUserId: string,
    patientName: string,
  ) => void;
  onInspectPatient?: (patientUserId: string) => void;
  onTransitionAppointment: (
    appointmentId: string,
    status: "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
  ) => Promise<void>;
  onUpdateSchedule?: (
    scheduleId: string,
    patch: UpdateScheduleInput,
  ) => Promise<void>;
  onJumpToShifts: () => void;
}

type CalendarViewMode = "WEEK" | "DAY" | "MONTH" | "AGENDA";

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 68; // 30min = 34px exact -> zero vertical overlap between back-to-back 30min visits
const TOTAL_GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
const GRID_HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i,
);

const APPT_BADGE_TONE: Record<AppointmentStatus, UiBadgeTone> = {
  CONFIRMED: "teal",
  CHECKED_IN: "emerald",
  COMPLETED: "slate",
  CANCELLED: "red",
  NO_SHOW: "amber",
};

const GCAL_COPY = {
  en: {
    todayBtn: "Today",
    viewWeek: "Week",
    viewDay: "Day",
    viewMonth: "Month",
    viewAgenda: "Agenda",
    searchPlaceholder: "Search patient or clinic…",
    myCalendars: "My Calendars",
    calClinic: "Clinic Visits",
    calVideo: "Video Telehealth",
    calHome: "Home Visits",
    calShifts: "Shift Availability",
    filtersBtn: "Calendars",
    nextUpPrefix: "Next:",
    waitingChip: (n: number) => `${n} Waiting`,
    inRoomChip: (n: number) => `${n} In Room`,
    videoChip: (n: number) => `${n} Video`,
    noShiftChip: "Add Today's Shift",
    allergyChip: (n: number) => `${n} Allergy Alert`,
    allClearChip: "All caught up",
    manageShiftsShort: "Manage Shifts",
    noActiveVisitTitle: "No visits match current filters",
    moreLabel: (n: number) => `+${n} more`,
    dayModalTitle: (date: string, count: number) => `${date} · ${count} visits`,
    loadMoreBtn: (rem: number) => `Load more (${rem} remaining)`,
    shiftBandHint: "Drag shift to move",
    closeLabel: "Close",
    statusAll: "Reset Filters",
  },
  fr: {
    todayBtn: "Aujourd'hui",
    viewWeek: "Semaine",
    viewDay: "Jour",
    viewMonth: "Mois",
    viewAgenda: "Agenda",
    searchPlaceholder: "Rechercher patient ou clinique…",
    myCalendars: "Mes Agendas",
    calClinic: "Cabinet",
    calVideo: "Téléconsultation",
    calHome: "Domicile",
    calShifts: "Heures d'ouverture",
    filtersBtn: "Agendas",
    nextUpPrefix: "Suivant :",
    waitingChip: (n: number) => `${n} En attente`,
    inRoomChip: (n: number) => `${n} En salle`,
    videoChip: (n: number) => `${n} Vidéo`,
    noShiftChip: "Ouvrir créneau",
    allergyChip: (n: number) => `${n} Allergie`,
    allClearChip: "Tout est à jour",
    manageShiftsShort: "Gérer Horaires",
    noActiveVisitTitle: "Aucune visite pour ces filtres",
    moreLabel: (n: number) => `+${n} autres`,
    dayModalTitle: (date: string, count: number) => `${date} · ${count} visites`,
    loadMoreBtn: (rem: number) => `Afficher plus (${rem} restants)`,
    shiftBandHint: "Glisser pour déplacer",
    closeLabel: "Fermer",
    statusAll: "Réinitialiser",
  },
  ar: {
    todayBtn: "اليوم",
    viewWeek: "أسبوع",
    viewDay: "يوم",
    viewMonth: "شهر",
    viewAgenda: "جدول الأعمال",
    searchPlaceholder: "ابحث عن مريض أو عيادة…",
    myCalendars: "تقاويمي",
    calClinic: "في العيادة",
    calVideo: "استشارة فيديو",
    calHome: "زيارة منزلية",
    calShifts: "ساعات العمل",
    filtersBtn: "التقاويم",
    nextUpPrefix: "التالي:",
    waitingChip: (n: number) => `${n} بالانتظار`,
    inRoomChip: (n: number) => `${n} بالعيادة`,
    videoChip: (n: number) => `${n} فيديو`,
    noShiftChip: "أضف ساعات اليوم",
    allergyChip: (n: number) => `تنبيه حساسية (${n})`,
    allClearChip: "الجدول محدث",
    manageShiftsShort: "إدارة الساعات",
    noActiveVisitTitle: "لا توجد زيارات مطابقة",
    moreLabel: (n: number) => `+${n} إضافي`,
    dayModalTitle: (date: string, count: number) => `${date} · ${count} زيارات`,
    loadMoreBtn: (rem: number) => `عرض المزيد (${rem})`,
    shiftBandHint: "اسحب لنقل الفترة",
    closeLabel: "إغلاق",
    statusAll: "إعادة ضبط",
  },
} as const;

interface CalendarDayColumnData {
  iso: string;
  dow: number;
  label: string;
  dayNumber: string;
  appointments: readonly AppointmentSummary[];
  shifts: readonly DoctorScheduleSummary[];
}

export function DoctorCalendarAgenda({
  currentUser,
  appointments,
  schedules,
  selectedPatientId,
  patientProfile,
  patientProfileLoading,
  busy,
  isLockedPendingVerification,
  onSelectPatientForConsultation,
  onInspectPatient,
  onTransitionAppointment,
  onUpdateSchedule,
  onJumpToShifts,
}: DoctorCalendarAgendaProps) {
  const { locale, isRtl } = useLocale();
  const c = CLINICAL_COPY[locale] ?? CLINICAL_COPY.en;
  const a = c.agenda;
  const gc = GCAL_COPY[locale] ?? GCAL_COPY.en;

  const todayIso = useMemo(() => toIsoDateOnly(new Date()), []);
  const [anchorDate, setAnchorDate] = useState<string>(todayIso);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("WEEK");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [visibleModes, setVisibleModes] = useState<Record<VisitMode, boolean>>({
    IN_PERSON: true,
    TELEHEALTH: true,
    HOME_VISIT: true,
  });
  const [showShiftBands, setShowShiftBands] = useState(true);
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string | null>(
    null,
  );
  const [agendaLimit, setAgendaLimit] = useState(25);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [overflowModal, setOverflowModal] = useState<{
    title: string;
    items: readonly AppointmentSummary[];
  } | null>(null);

  // Drag-and-drop shift band directly on the Week/Day grid
  const [draggingShift, setDraggingShift] = useState<{
    id: string;
    durationMin: number;
    grabOffsetMin: number;
  } | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    dayOfWeek: number;
    startMin: number;
    endMin: number;
  } | null>(null);

  const timeGridScrollRef = useRef<HTMLDivElement | null>(null);
  const colRectCacheRef = useRef<Map<number, DOMRect>>(new Map());

  // Responsive mobile default: phones (<768px) open directly in crisp full-width DAY view
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("DAY");
    }
  }, []);

  useEffect(() => {
    const el = timeGridScrollRef.current;
    if (el) {
      el.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_PX - 12);
    }
  }, [viewMode]);

  const isNurseRole = currentUser?.role === "NURSE";
  const inCareChipLabel = (n: number) =>
    isNurseRole
      ? locale === "fr"
        ? `${n} En soin`
        : locale === "ar"
          ? `${n} قيد العناية`
          : `${n} In Care`
      : gc.inRoomChip(n);
  const openChartActionLabel = isNurseRole
    ? locale === "fr"
      ? "Ouvrir Constantes & Soins"
      : locale === "ar"
        ? "فتح العلامات والعناية"
        : "Open Vitals & Care"
    : a.openChartBtn;

  const canManageQueue = Boolean(
    currentUser &&
      !isLockedPendingVerification &&
      ["DOCTOR", "NURSE", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
        currentUser.role,
      ),
  );

  const roleScopedAppointments = useMemo(() => {
    if (
      currentUser &&
      (currentUser.role === "DOCTOR" || currentUser.role === "NURSE")
    ) {
      const own = appointments.filter((x) => x.doctorUserId === currentUser.id);
      return own.length > 0 ? own : appointments;
    }
    return appointments;
  }, [appointments, currentUser]);

  const roleScopedSchedules = useMemo(() => {
    if (
      currentUser &&
      (currentUser.role === "DOCTOR" || currentUser.role === "NURSE")
    ) {
      const own = schedules.filter((x) => x.doctorUserId === currentUser.id);
      return own.length > 0 ? own : schedules;
    }
    return schedules;
  }, [currentUser, schedules]);

  const activeShiftDowSet = useMemo(() => {
    const set = new Set<number>();
    for (const s of roleScopedSchedules) {
      if (s.isActive) set.add(s.dayOfWeek);
    }
    return set;
  }, [roleScopedSchedules]);

  const filteredAppointments = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return roleScopedAppointments
      .filter((appt) => {
        if (!visibleModes[appt.visitMode]) return false;
        if (statusFilter !== "ALL" && appt.status !== statusFilter) return false;
        if (needle) {
          const hay =
            `${appt.patientName} ${appt.facilityName} ${appt.reason ?? ""} ${appt.doctorName}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((x, y) => x.slotStartIso.localeCompare(y.slotStartIso));
  }, [deferredSearch, roleScopedAppointments, statusFilter, visibleModes]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentSummary[]>();
    for (const appt of filteredAppointments) {
      const key = appt.slotStartIso.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(appt);
      else map.set(key, [appt]);
    }
    return map;
  }, [filteredAppointments]);

  const allDatesWithAppointments = useMemo(() => {
    const set = new Set<string>();
    for (const appt of roleScopedAppointments) {
      set.add(appt.slotStartIso.slice(0, 10));
    }
    return set;
  }, [roleScopedAppointments]);

  const metrics = useMemo(() => {
    let confirmed = 0;
    let checkedIn = 0;
    let telehealth = 0;
    for (const appt of roleScopedAppointments) {
      if (appt.status === "CONFIRMED") confirmed += 1;
      else if (appt.status === "CHECKED_IN") checkedIn += 1;
      if (
        appt.visitMode === "TELEHEALTH" &&
        (appt.status === "CONFIRMED" || appt.status === "CHECKED_IN")
      ) {
        telehealth += 1;
      }
    }
    return { confirmed, checkedIn, telehealth };
  }, [roleScopedAppointments]);

  const todayDow = useMemo(
    () => new Date(`${todayIso}T00:00:00.000Z`).getUTCDay(),
    [todayIso],
  );
  const hasShiftToday = activeShiftDowSet.has(todayDow);

  const nextActiveAppointment = useMemo(() => {
    const active = roleScopedAppointments
      .filter((a) => a.status === "CONFIRMED" || a.status === "CHECKED_IN")
      .sort((x, y) => {
        const xUpcoming = x.slotStartIso.slice(0, 10) >= todayIso ? 0 : 1;
        const yUpcoming = y.slotStartIso.slice(0, 10) >= todayIso ? 0 : 1;
        if (xUpcoming !== yUpcoming) return xUpcoming - yUpcoming;
        if (x.status !== y.status) {
          return x.status === "CHECKED_IN" ? -1 : 1;
        }
        return x.slotStartIso.localeCompare(y.slotStartIso);
      });
    return active[0] ?? null;
  }, [roleScopedAppointments, todayIso]);

  const focusedAppointment = useMemo(() => {
    if (focusedAppointmentId) {
      const found = filteredAppointments.find((x) => x.id === focusedAppointmentId);
      if (found) return found;
    }
    const prioritized = [...filteredAppointments].sort((x, y) => {
      const rank = (s: AppointmentStatus) =>
        s === "CHECKED_IN" ? 0 : s === "CONFIRMED" ? 1 : s === "COMPLETED" ? 2 : 3;
      const diff = rank(x.status) - rank(y.status);
      if (diff !== 0) return diff;
      const xGuest = x.patientName === "Guest Care Pass" ? 1 : 0;
      const yGuest = y.patientName === "Guest Care Pass" ? 1 : 0;
      if (xGuest !== yGuest) return xGuest - yGuest;
      return x.slotStartIso.localeCompare(y.slotStartIso);
    });
    return prioritized[0] ?? null;
  }, [filteredAppointments, focusedAppointmentId]);

  useEffect(() => {
    if (
      focusedAppointment &&
      onInspectPatient &&
      focusedAppointment.patientUserId &&
      focusedAppointment.patientUserId !== selectedPatientId
    ) {
      onInspectPatient(focusedAppointment.patientUserId);
    }
  }, [focusedAppointment, onInspectPatient, selectedPatientId]);

  const weekMondayIso = useMemo(
    () => getWeekStartMondayIso(anchorDate),
    [anchorDate],
  );

  const weekColumns = useMemo<CalendarDayColumnData[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addUtcDays(weekMondayIso, i);
      const parsed = new Date(`${iso}T00:00:00.000Z`);
      const dow = parsed.getUTCDay();
      return {
        iso,
        dow,
        label: c.weekdaysShort[dow] ?? "",
        dayNumber: iso.slice(8, 10),
        appointments: appointmentsByDate.get(iso) ?? [],
        shifts: roleScopedSchedules.filter((s) => s.dayOfWeek === dow && s.isActive),
      };
    });
  }, [appointmentsByDate, c.weekdaysShort, roleScopedSchedules, weekMondayIso]);

  const activeDayColumn = useMemo<CalendarDayColumnData>(() => {
    const parsed = new Date(`${anchorDate}T00:00:00.000Z`);
    const dow = Number.isNaN(parsed.getTime()) ? todayDow : parsed.getUTCDay();
    return {
      iso: anchorDate,
      dow,
      label: c.weekdaysShort[dow] ?? "",
      dayNumber: anchorDate.slice(8, 10),
      appointments: appointmentsByDate.get(anchorDate) ?? [],
      shifts: roleScopedSchedules.filter((s) => s.dayOfWeek === dow && s.isActive),
    };
  }, [anchorDate, appointmentsByDate, c.weekdaysShort, roleScopedSchedules, todayDow]);

  // Memoize interval packing separately from selection/checklist/hover state for 60fps interaction
  const packedByDateKey = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof packTimeIntervals<AppointmentSummary>>
    >();
    const targetCols = viewMode === "DAY" ? [activeDayColumn] : weekColumns;
    for (const col of targetCols) {
      map.set(
        col.iso,
        packTimeIntervals(
          col.appointments.map((appt) => ({
            id: appt.id,
            startMin: parseHhMmToMinutes(appt.slotStartIso.slice(11, 16)),
            endMin: parseHhMmToMinutes(appt.slotEndIso.slice(11, 16)),
            item: appt,
          })),
        ),
      );
    }
    return map;
  }, [activeDayColumn, viewMode, weekColumns]);

  const monthCells = useMemo(() => {
    const parsed = new Date(`${anchorDate}T00:00:00.000Z`);
    const year = Number.isNaN(parsed.getTime())
      ? new Date().getUTCFullYear()
      : parsed.getUTCFullYear();
    const month = Number.isNaN(parsed.getTime())
      ? new Date().getUTCMonth()
      : parsed.getUTCMonth();
    return getMonthGridCells(year, month);
  }, [anchorDate]);

  const mondayFirstLabels = useMemo(
    () => [
      c.weekdaysShort[1] ?? "Mon",
      c.weekdaysShort[2] ?? "Tue",
      c.weekdaysShort[3] ?? "Wed",
      c.weekdaysShort[4] ?? "Thu",
      c.weekdaysShort[5] ?? "Fri",
      c.weekdaysShort[6] ?? "Sat",
      c.weekdaysShort[0] ?? "Sun",
    ],
    [c.weekdaysShort],
  );

  function navigatePeriod(direction: -1 | 1) {
    if (viewMode === "DAY") {
      setAnchorDate((d) => addUtcDays(d, direction));
    } else if (viewMode === "WEEK" || viewMode === "AGENDA") {
      setAnchorDate((d) => addUtcDays(d, direction * 7));
    } else {
      const parsed = new Date(`${anchorDate}T00:00:00.000Z`);
      const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      base.setUTCDate(1);
      base.setUTCMonth(base.getUTCMonth() + direction);
      setAnchorDate(toIsoDateOnly(base));
    }
  }

  function handleSelectAppointment(appt: AppointmentSummary) {
    setFocusedAppointmentId(appt.id);
    if (onInspectPatient && appt.patientUserId !== selectedPatientId) {
      onInspectPatient(appt.patientUserId);
    }
  }

  function handleShiftBandDragStart(
    e: ReactDragEvent<HTMLDivElement>,
    sched: DoctorScheduleSummary,
  ) {
    if (!onUpdateSchedule || isLockedPendingVerification || busy) {
      e.preventDefault();
      return;
    }
    colRectCacheRef.current.clear();
    const startM = parseHhMmToMinutes(sched.startTimeUtc);
    const endM = parseHhMmToMinutes(sched.endTimeUtc);
    const durationMin = Math.max(30, endM - startM);
    const rect = e.currentTarget.getBoundingClientRect();
    const grabOffsetMin = Math.max(
      0,
      Math.min(durationMin - 15, ((e.clientY - rect.top) / HOUR_PX) * 60),
    );
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sched.id);
    setDraggingShift({ id: sched.id, durationMin, grabOffsetMin });
  }

  function handleDayColDragOver(e: ReactDragEvent<HTMLDivElement>, dow: number) {
    if (!draggingShift) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    let rect = colRectCacheRef.current.get(dow);
    if (!rect) {
      rect = e.currentTarget.getBoundingClientRect();
      colRectCacheRef.current.set(dow, rect);
    }
    const relMin = ((e.clientY - rect.top) / HOUR_PX) * 60 - draggingShift.grabOffsetMin;
    const snapped = snapMinutes(START_HOUR * 60 + relMin, 30);
    const clampedStart = Math.max(
      START_HOUR * 60,
      Math.min(END_HOUR * 60 - draggingShift.durationMin, snapped),
    );
    const clampedEnd = Math.min(END_HOUR * 60, clampedStart + draggingShift.durationMin);
    setDropPreview((prev) =>
      prev &&
      prev.dayOfWeek === dow &&
      prev.startMin === clampedStart &&
      prev.endMin === clampedEnd
        ? prev
        : { dayOfWeek: dow, startMin: clampedStart, endMin: clampedEnd },
    );
  }

  function handleDayColDrop(e: ReactDragEvent<HTMLDivElement>, dow: number) {
    e.preventDefault();
    const active = draggingShift;
    const preview = dropPreview;
    setDraggingShift(null);
    setDropPreview(null);
    colRectCacheRef.current.clear();
    if (!active || !preview || !onUpdateSchedule) return;
    void onUpdateSchedule(active.id, {
      dayOfWeek: dow,
      startTimeUtc: formatMinutesToHhMm(preview.startMin),
      endTimeUtc: formatMinutesToHhMm(preview.endMin),
    });
  }

  const headingLabel =
    viewMode === "DAY"
      ? formatDayHeading(anchorDate, locale)
      : viewMode === "WEEK"
        ? formatWeekRangeHeading(weekMondayIso, locale)
        : formatMonthHeading(anchorDate, locale);

  const agendaGroups = useMemo(() => {
    const sliced = filteredAppointments.slice(0, agendaLimit);
    const grouped: Array<{ date: string; items: AppointmentSummary[] }> = [];
    for (const appt of sliced) {
      const date = appt.slotStartIso.slice(0, 10);
      const last = grouped[grouped.length - 1];
      if (last && last.date === date) {
        last.items.push(appt);
      } else {
        grouped.push({ date, items: [appt] });
      }
    }
    return grouped;
  }, [agendaLimit, filteredAppointments]);

  function getEventClasses(appt: AppointmentSummary, isSelected: boolean): string {
    const base =
      appt.status === "COMPLETED"
        ? "border-[#CBDDF0] bg-[#F1F5F9] text-[#4A627D] border-s-[#64748B] hover:border-[#94A3B8]"
        : appt.status === "CANCELLED" || appt.status === "NO_SHOW"
          ? "border-rose-200 bg-rose-50/90 text-rose-900 border-s-[#DC2626] opacity-80 hover:opacity-100"
          : appt.visitMode === "TELEHEALTH"
            ? "border-indigo-200 bg-indigo-50 text-indigo-950 border-s-indigo-600 hover:border-indigo-400"
            : appt.visitMode === "HOME_VISIT"
              ? "border-[#B2E5DC] bg-[#E6F7F4] text-[#0B6B5C] border-s-[#0F9D88] hover:border-[#0F9D88]"
              : "border-[#BFDBFE] bg-[#EBF4FF] text-[#0F243E] border-s-[#0066CC] hover:border-[#0066CC]";
    return `${base} ${
      isSelected
        ? "z-20 ring-2 ring-[#0066CC] shadow-sm"
        : "hover:shadow-xs"
    }`;
  }

  function renderMiniCalendarContent() {
    return (
      <>
        <div className="mb-2 flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-[#0F243E]">
            {formatMonthHeading(anchorDate, locale)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${anchorDate}T00:00:00.000Z`);
                d.setUTCDate(1);
                d.setUTCMonth(d.getUTCMonth() - 1);
                setAnchorDate(toIsoDateOnly(d));
              }}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4A627D] transition-colors hover:bg-[#F3F8FD] active:scale-95 xl:h-7 xl:w-7"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${anchorDate}T00:00:00.000Z`);
                d.setUTCDate(1);
                d.setUTCMonth(d.getUTCMonth() + 1);
                setAnchorDate(toIsoDateOnly(d));
              }}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4A627D] transition-colors hover:bg-[#F3F8FD] active:scale-95 xl:h-7 xl:w-7"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-[#6B829D]">
          {mondayFirstLabels.map((wd) => (
            <div key={wd} className="py-1">
              {wd.slice(0, 2)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {monthCells.map((cell) => {
            const isSelected = cell.iso === anchorDate;
            const isToday = cell.iso === todayIso;
            const hasAppt = allDatesWithAppointments.has(cell.iso);
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => {
                  setAnchorDate(cell.iso);
                  setMobileFiltersOpen(false);
                }}
                className={`relative flex h-9 flex-col items-center justify-center rounded-lg font-mono-tabular text-[11px] font-semibold transition-transform active:scale-95 xl:h-7 ${
                  isSelected
                    ? "bg-[#0066CC] text-white"
                    : isToday
                      ? "bg-[#EBF4FF] font-bold text-[#0066CC]"
                      : cell.inCurrentMonth
                        ? "text-[#0F243E] hover:bg-[#F3F8FD]"
                        : "text-[#9BB0C4] hover:bg-[#F3F8FD]"
                }`}
              >
                <span>{cell.dayNumber}</span>
                {hasAppt ? (
                  <span
                    className={`h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-[#0066CC]"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderMyCalendarsCheckboxes() {
    return (
      <div className="space-y-1.5 text-xs font-semibold text-[#0F243E]">
        {(
          [
            {
              mode: "IN_PERSON" as const,
              label: gc.calClinic,
              dot: "bg-[#0066CC]",
            },
            {
              mode: "TELEHEALTH" as const,
              label: gc.calVideo,
              dot: "bg-indigo-600",
            },
            {
              mode: "HOME_VISIT" as const,
              label: gc.calHome,
              dot: "bg-[#0F9D88]",
            },
          ] as const
        ).map((row) => {
          const active = visibleModes[row.mode];
          return (
            <button
              key={row.mode}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() =>
                setVisibleModes((prev) => ({
                  ...prev,
                  [row.mode]: !prev[row.mode],
                }))
              }
              className={`flex min-h-[34px] w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1 text-start text-xs font-semibold transition-all active:scale-[0.98] xl:min-h-[30px] ${
                active
                  ? "border-[#BFDBFE] bg-[#EBF4FF] text-[#0F243E]"
                  : "border-transparent bg-transparent text-[#6B829D] hover:bg-[#F3F8FD]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dot} ${
                    active ? "opacity-100" : "opacity-35"
                  }`}
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span
                aria-hidden="true"
                className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  active ? "bg-[#0066CC]" : "bg-[#CBDDF0]"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${
                    active ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="switch"
          aria-checked={showShiftBands}
          onClick={() => setShowShiftBands((prev) => !prev)}
          className={`flex min-h-[34px] w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1 text-start text-xs font-semibold transition-all active:scale-[0.98] xl:min-h-[30px] ${
            showShiftBands
              ? "border-[#BFDBFE] bg-[#EBF4FF] text-[#0F243E]"
              : "border-transparent bg-transparent text-[#6B829D] hover:bg-[#F3F8FD]"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-dashed border-[#0066CC] bg-[#EBF4FF]" />
            <span className="truncate">{gc.calShifts}</span>
          </span>
          <span
            aria-hidden="true"
            className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              showShiftBands ? "bg-[#0066CC]" : "bg-[#CBDDF0]"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${
                showShiftBands ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
              }`}
            />
          </span>
        </button>
      </div>
    );
  }

  function renderEhrSnapshotCard(compact = false) {
    return (
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_4px_16px_-10px_rgba(15,36,62,0.08)] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#E8F1FA] pb-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#0F243E]">
            <FileHeart className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
            <span>{a.ehrSnapshotTitle}</span>
          </h3>
          {patientProfile?.bloodType ? (
            <UiBadge tone="teal" className="shrink-0 whitespace-nowrap">
              {a.bloodBadge(patientProfile.bloodType)}
            </UiBadge>
          ) : null}
        </div>

        {patientProfileLoading ? (
          <p className="mt-2 text-xs text-[#6B829D]">{a.ehrLoading}</p>
        ) : !patientProfile ? (
          <p className="mt-2 rounded-xl bg-[#F3F8FD] p-2.5 text-[11px] text-[#4A627D]">
            {a.ehrEmpty}
          </p>
        ) : (
          <div className={`mt-2 ${compact ? "flex flex-wrap items-center gap-2 text-xs" : "space-y-2 text-[11.5px]"}`}>
            <p className="font-bold text-[#0F243E]">
              <bdi dir="auto">{patientProfile.fullName}</bdi>
            </p>
            {patientProfile.allergies.length > 0 ? (
              <div className="space-y-0.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2">
                <p className="flex items-center gap-1 font-bold text-[#DC2626]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {a.recordedAllergiesTitle(patientProfile.allergies.length)}
                  </span>
                </p>
                <p className="font-semibold text-rose-950">
                  {patientProfile.allergies
                    .map((alg) => `${alg.allergen} (${alg.severity})`)
                    .join(", ")}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-[#B2E5DC] bg-[#E6F7F4]/70 px-2.5 py-1.5 font-medium text-[#0B6B5C]">
                {a.noKnownAllergies}
              </p>
            )}
            {!compact && patientProfile.chronicConditions.length > 0 ? (
              <p className="text-[#4A627D]">
                <span className="font-semibold text-[#0F243E]">
                  {a.conditionsLabel}
                </span>{" "}
                {patientProfile.chronicConditions.join(", ")}
              </p>
            ) : null}
            {!compact && patientProfile.currentMedications.length > 0 ? (
              <p className="text-[#4A627D]">
                <span className="font-semibold text-[#0F243E]">
                  {a.activeMedsLabel}
                </span>{" "}
                {patientProfile.currentMedications.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  function renderTimeGridColumns(
    columns: readonly CalendarDayColumnData[],
    maxVisibleOverlapCols: number,
  ) {
    const isSingleDay = columns.length === 1;
    return (
      <div className="overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className={isSingleDay ? "min-w-0" : "min-w-[660px]"}>
            {/* Sticky Day Headers */}
            <div
              className={`grid border-b border-[#D7E4F2] bg-[#F8FBFE] ${
                isSingleDay
                  ? "grid-cols-[54px_minmax(0,1fr)]"
                  : "grid-cols-[54px_repeat(7,minmax(0,1fr))]"
              }`}
            >
              <div className="sticky start-0 z-20 flex items-center justify-center border-e border-[#E8F1FA] bg-[#F8FBFE] py-2.5 text-[10px] font-bold uppercase text-[#6B829D]">
                UTC
              </div>
              {columns.map((col) => {
                const isToday = col.iso === todayIso;
                return (
                  <button
                    key={col.iso}
                    type="button"
                    onClick={() => {
                      setAnchorDate(col.iso);
                      if (!isSingleDay) setViewMode("DAY");
                    }}
                    className="flex min-h-[42px] items-center justify-between gap-1 border-e border-[#E8F1FA] px-2 py-2 text-start transition-colors hover:bg-[#EBF4FF]/50 active:scale-[0.98] last:border-e-0"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold uppercase text-[#556E89]">
                        {col.label}
                      </span>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono-tabular text-xs font-bold ${
                          isToday
                            ? "bg-[#0066CC] text-white"
                            : "text-[#0F243E]"
                        }`}
                      >
                        {col.dayNumber}
                      </span>
                    </div>
                    {col.appointments.length > 0 ? (
                      <span className="rounded-full bg-[#EBF4FF] px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#0052A3]">
                        {col.appointments.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Viewport-Aware Hourly Time-Grid */}
            <div
              ref={timeGridScrollRef}
              className="relative h-[clamp(390px,calc(100dvh-310px),680px)] overflow-y-auto overscroll-y-contain"
            >
              <div
                className={`grid ${
                  isSingleDay
                    ? "grid-cols-[54px_minmax(0,1fr)]"
                    : "grid-cols-[54px_repeat(7,minmax(0,1fr))]"
                }`}
                style={{ height: `${TOTAL_GRID_HEIGHT}px` }}
              >
                {/* Sticky Time Gutter so horizontal scrolling never loses hour labels */}
                <div className="sticky start-0 z-20 relative border-e border-[#E8F1FA] bg-[#FBFDFF]">
                  {GRID_HOURS.map((hour) => (
                    <div
                      key={hour}
                      style={{
                        top: `${(hour - START_HOUR) * HOUR_PX}px`,
                        height: `${HOUR_PX}px`,
                      }}
                      className="absolute inset-x-0 border-t border-[#E8F1FA] pe-1.5 pt-1 text-end font-mono-tabular text-[10px] font-semibold text-[#6B829D] first:border-t-0"
                    >
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {columns.map((col) => {
                  const packedEvents = packedByDateKey.get(col.iso) ?? [];

                  // Partition overlapping events vs dedicated rightmost overflow column
                  const visibleEvents: typeof packedEvents = [];
                  const overflowBuckets = new Map<
                    number,
                    { hidden: AppointmentSummary[]; colCount: number }
                  >();
                  for (const ev of packedEvents) {
                    const hasOverflow = ev.colCount > maxVisibleOverlapCols;
                    const cutoff = hasOverflow
                      ? Math.max(1, maxVisibleOverlapCols - 1)
                      : maxVisibleOverlapCols;
                    if (ev.colIndex < cutoff) {
                      visibleEvents.push(ev);
                    } else {
                      const bucketStart = Math.floor(ev.startMin / 30) * 30;
                      const existingBucket = overflowBuckets.get(bucketStart);
                      if (existingBucket) {
                        existingBucket.hidden.push(ev.item);
                      } else {
                        overflowBuckets.set(bucketStart, {
                          hidden: [ev.item],
                          colCount: maxVisibleOverlapCols,
                        });
                      }
                    }
                  }

                  const isDropDay = dropPreview?.dayOfWeek === col.dow;

                  return (
                    <div
                      key={col.iso}
                      onDragOver={(e) => handleDayColDragOver(e, col.dow)}
                      onDrop={(e) => handleDayColDrop(e, col.dow)}
                      className={`relative border-e border-[#E8F1FA] transition-colors last:border-e-0 ${
                        isDropDay ? "bg-[#EBF4FF]/35" : "bg-white"
                      }`}
                    >
                      {/* Hour Lines */}
                      {GRID_HOURS.map((hour) => (
                        <div
                          key={hour}
                          style={{
                            top: `${(hour - START_HOUR) * HOUR_PX}px`,
                            height: `${HOUR_PX}px`,
                          }}
                          className="pointer-events-none absolute inset-x-0 border-t border-[#EDF3FA] first:border-t-0"
                        >
                          <div
                            style={{ marginTop: `${HOUR_PX / 2 - 1}px` }}
                            className="border-t border-dashed border-[#F4F8FD]"
                          />
                        </div>
                      ))}

                      {/* Background Draggable Shift Availability Bands */}
                      {showShiftBands
                        ? col.shifts.map((shift) => {
                            const sMin = parseHhMmToMinutes(shift.startTimeUtc);
                            const eMin = parseHhMmToMinutes(shift.endTimeUtc);
                            const topPx =
                              ((Math.max(START_HOUR * 60, sMin) - START_HOUR * 60) /
                                60) *
                              HOUR_PX;
                            const heightPx = Math.max(
                              28,
                              ((Math.min(END_HOUR * 60, eMin) -
                                Math.max(START_HOUR * 60, sMin)) /
                                60) *
                                HOUR_PX,
                            );
                            return (
                              <div
                                key={shift.id}
                                draggable={Boolean(
                                  onUpdateSchedule &&
                                    !isLockedPendingVerification &&
                                    !busy,
                                )}
                                onDragStart={(e) =>
                                  handleShiftBandDragStart(e, shift)
                                }
                                onDragEnd={() => {
                                  setDraggingShift(null);
                                  setDropPreview(null);
                                  colRectCacheRef.current.clear();
                                }}
                                title={`${shift.startTimeUtc}–${shift.endTimeUtc} · ${shift.facilityName} (${gc.shiftBandHint})`}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                }}
                                className={`absolute inset-x-0.5 z-0 overflow-hidden rounded-lg border border-dashed border-[#BFDBFE]/80 bg-[#F3F8FD]/75 px-1 py-0.5 ${
                                  onUpdateSchedule && !isLockedPendingVerification
                                    ? "cursor-grab active:cursor-grabbing"
                                    : ""
                                }`}
                              >
                                <span className="flex items-center gap-0.5 truncate text-[9.5px] font-semibold text-[#556E89]">
                                  {onUpdateSchedule ? (
                                    <GripVertical
                                      className="hidden h-2.5 w-2.5 shrink-0 opacity-60 sm:inline"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <span dir="ltr" className="truncate">
                                    {shift.startTimeUtc}–{shift.endTimeUtc}
                                  </span>
                                </span>
                              </div>
                            );
                          })
                        : null}

                      {/* Drop Preview while Dragging Shift */}
                      {isDropDay && dropPreview ? (
                        <div
                          style={{
                            top: `${((dropPreview.startMin - START_HOUR * 60) / 60) * HOUR_PX}px`,
                            height: `${Math.max(
                              32,
                              ((dropPreview.endMin - dropPreview.startMin) / 60) *
                                HOUR_PX,
                            )}px`,
                          }}
                          className="pointer-events-none absolute inset-x-1 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-[#0066CC] bg-[#EBF4FF]/90 px-1 text-center font-mono-tabular text-[10px] font-bold text-[#0052A3]"
                        >
                          {formatMinutesToHhMm(dropPreview.startMin)}–
                          {formatMinutesToHhMm(dropPreview.endMin)}
                        </div>
                      ) : null}

                      {/* Packed Appointment Event Blocks */}
                      {visibleEvents.map((ev) => {
                        const appt = ev.item;
                        const isSelected = focusedAppointment?.id === appt.id;
                        const topPx = Math.max(
                          0,
                          ((ev.startMin - START_HOUR * 60) / 60) * HOUR_PX,
                        );
                        const exactSpanPx =
                          ((ev.endMin - ev.startMin) / 60) * HOUR_PX;
                        const heightPx = Math.max(26, exactSpanPx - 2);
                        const effectiveCols = Math.min(
                          ev.colCount,
                          maxVisibleOverlapCols,
                        );
                        const widthPct = 100 / effectiveCols;
                        const leftPct = ev.colIndex * widthPct;

                        return (
                          <button
                            key={appt.id}
                            type="button"
                            onClick={() => handleSelectAppointment(appt)}
                            style={{
                              top: `${topPx + 1}px`,
                              height: `${heightPx}px`,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                            }}
                            className={`absolute z-10 flex flex-col justify-center overflow-hidden rounded-lg border border-s-[3px] px-1.5 py-0.5 text-start text-[10.5px] leading-tight transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] ${getEventClasses(
                              appt,
                              isSelected,
                            )}`}
                          >
                            <span className="truncate font-bold">
                              <span
                                dir="ltr"
                                className="me-1 font-mono-tabular text-[9.5px] opacity-80"
                              >
                                {appt.slotStartIso.slice(11, 16)}
                              </span>
                              <bdi dir="auto">{appt.patientName}</bdi>
                            </span>
                            {heightPx >= 44 ? (
                              <span className="truncate text-[9.5px] opacity-80">
                                {formatVisitMode(appt.visitMode, locale)} ·{" "}
                                <bdi dir="auto">{appt.facilityName}</bdi>
                              </span>
                            ) : null}
                          </button>
                        );
                      })}

                      {/* Overflow "+N more" Dedicated Column Cards (strictly sized inside the 30-min slot!) */}
                      {Array.from(overflowBuckets.entries()).map(
                        ([bucketStartMin, bucket]) => {
                          const topPx = Math.max(
                            0,
                            ((bucketStartMin - START_HOUR * 60) / 60) * HOUR_PX,
                          );
                          const allAtBucket = col.appointments.filter((ap) => {
                            const m = parseHhMmToMinutes(
                              ap.slotStartIso.slice(11, 16),
                            );
                            return m >= bucketStartMin && m < bucketStartMin + 60;
                          });
                          const widthPct = 100 / bucket.colCount;
                          const leftPct = (bucket.colCount - 1) * widthPct;
                          return (
                            <button
                              key={bucketStartMin}
                              type="button"
                              onClick={() =>
                                setOverflowModal({
                                  title: gc.dayModalTitle(
                                    `${col.iso} · ${formatMinutesToHhMm(bucketStartMin)}`,
                                    allAtBucket.length,
                                  ),
                                  items: allAtBucket,
                                })
                              }
                              style={{
                                top: `${topPx + 1}px`,
                                height: `${HOUR_PX / 2 - 2}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                              }}
                              className="absolute z-20 flex items-center justify-center whitespace-nowrap rounded-lg bg-[#0F243E] px-1.5 text-[10px] font-bold text-white shadow-xs transition-transform duration-100 hover:bg-[#0066CC] active:scale-95"
                            >
                              {isSingleDay
                                ? gc.moreLabel(bucket.hidden.length)
                                : `+${bucket.hidden.length}`}
                            </button>
                          );
                        },
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3.5">
      {/* 1. Clean Compact Briefing & Smart Reminders Bar */}
      <section className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#D7E4F2] bg-white px-3.5 py-2.5 shadow-[0_4px_18px_-10px_rgba(15,36,62,0.08)] sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC]">
            <BellRing className="h-4 w-4" aria-hidden="true" />
          </span>
          {nextActiveAppointment ? (
            <button
              type="button"
              onClick={() => {
                setAnchorDate(nextActiveAppointment.slotStartIso.slice(0, 10));
                handleSelectAppointment(nextActiveAppointment);
              }}
              className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl px-1.5 py-0.5 text-start text-xs transition-colors hover:bg-[#F3F8FD]"
            >
              <span className="font-bold text-[#0052A3]">{gc.nextUpPrefix}</span>
              <span className="truncate font-bold text-[#0F243E]">
                <bdi dir="auto">{nextActiveAppointment.patientName}</bdi>
              </span>
              <span
                dir="ltr"
                className="whitespace-nowrap rounded-full bg-[#F3F8FD] px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#4A627D]"
              >
                {nextActiveAppointment.slotStartIso.slice(0, 10)} ·{" "}
                {nextActiveAppointment.slotStartIso.slice(11, 16)}
              </span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#4A627D]">
              {gc.allClearChip}
            </span>
          )}
        </div>

        {/* Clickable Smart Reminder Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {patientProfile && patientProfile.allergies.length > 0 ? (
            <span className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-[#DC2626]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {gc.allergyChip(patientProfile.allergies.length)}:{" "}
                {patientProfile.allergies.map((alg) => alg.allergen).join(", ")}
              </span>
            </span>
          ) : null}

          {metrics.confirmed > 0 ? (
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "CONFIRMED" ? "ALL" : "CONFIRMED",
                )
              }
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-[background-color,color,transform] duration-150 active:scale-95 ${
                statusFilter === "CONFIRMED"
                  ? "bg-[#0066CC] text-white"
                  : "border border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3] hover:bg-[#DCEBFE]"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{gc.waitingChip(metrics.confirmed)}</span>
            </button>
          ) : null}

          {metrics.checkedIn > 0 ? (
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "CHECKED_IN" ? "ALL" : "CHECKED_IN",
                )
              }
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-[background-color,color,transform] duration-150 active:scale-95 ${
                statusFilter === "CHECKED_IN"
                  ? "bg-[#0F9D88] text-white"
                  : "border border-[#B2E5DC] bg-[#E6F7F4] text-[#0B6B5C]"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{inCareChipLabel(metrics.checkedIn)}</span>
            </button>
          ) : null}

          {metrics.telehealth > 0 ? (
            <span className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-800">
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{gc.videoChip(metrics.telehealth)}</span>
            </span>
          ) : null}

          {!hasShiftToday ? (
            <button
              type="button"
              onClick={onJumpToShifts}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100 active:scale-95"
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{gc.noShiftChip}</span>
            </button>
          ) : null}
        </div>
      </section>

      {/* 2. Responsive Google Calendar Toolbar */}
      <section className="flex flex-col gap-2.5 rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_4px_18px_-10px_rgba(15,36,62,0.08)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
          <div className="flex items-center gap-1.5">
            <UiButton
              size="sm"
              variant="outline"
              onClick={() => setAnchorDate(todayIso)}
            >
              {gc.todayBtn}
            </UiButton>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label={a.prev7Aria}
                onClick={() => navigatePeriod(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#2F4661] transition-[border-color,color,transform] duration-150 hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={a.next7Aria}
                onClick={() => navigatePeriod(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#2F4661] transition-[border-color,color,transform] duration-150 hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          </div>

          <h2 className="font-editorial text-sm font-bold text-[#0F243E] sm:text-base">
            {headingLabel}
          </h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search Bar (full width on mobile so placeholder never clips) */}
          <div className="relative flex w-full items-center sm:w-52">
            <Search
              className="pointer-events-none absolute start-3 h-3.5 w-3.5 text-[#6B829D]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={gc.searchPlaceholder}
              className="h-9 w-full rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] pe-3 ps-8.5 text-xs text-[#0F243E] placeholder:text-[#87A0BC] transition-colors focus:border-[#0066CC] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Day / Week / Month / Agenda Switcher (comfortable 36px touch targets) */}
            <div className="inline-flex flex-1 justify-between rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1 sm:flex-none">
              {(
                [
                  { id: "DAY", label: gc.viewDay, icon: Clock },
                  { id: "WEEK", label: gc.viewWeek, icon: CalendarDays },
                  { id: "MONTH", label: gc.viewMonth, icon: LayoutGrid },
                  { id: "AGENDA", label: gc.viewAgenda, icon: List },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = viewMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setViewMode(opt.id)}
                    aria-pressed={active}
                    className={`inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold transition-transform duration-100 active:scale-[0.97] sm:flex-none ${
                      active
                        ? "bg-[#0066CC] text-white shadow-2xs"
                        : "text-[#4A627D] hover:text-[#0F243E]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile/Tablet Mini-Calendar & Filters Drawer Button (hides giant sidebar stack below xl) */}
            <UiButton
              size="sm"
              variant="outline"
              onClick={() => setMobileFiltersOpen(true)}
              className="xl:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
              <span>{gc.filtersBtn}</span>
            </UiButton>

            <UiButton size="sm" variant="primary" onClick={onJumpToShifts}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{gc.manageShiftsShort}</span>
            </UiButton>
          </div>
        </div>
      </section>

      {/* Mobile/Tablet Compact 7-Day Horizontal Date Strip (<xl only — instant 1-tap day jump above the fold!) */}
      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-[#D7E4F2] bg-white p-1.5 shadow-2xs xl:hidden">
        {weekColumns.map((col) => {
          const isAnchor = col.iso === anchorDate;
          const isToday = col.iso === todayIso;
          const hasAppts = col.appointments.length > 0;
          return (
            <button
              key={col.iso}
              type="button"
              onClick={() => setAnchorDate(col.iso)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-[background-color,color,transform] duration-150 active:scale-95 ${
                isAnchor
                  ? "bg-[#0066CC] text-white shadow-xs"
                  : isToday
                    ? "bg-[#EBF4FF] text-[#0052A3]"
                    : "text-[#2F4661] hover:bg-[#F3F8FD]"
              }`}
            >
              <span className="text-[10px] font-bold uppercase opacity-80">
                {col.label.slice(0, 3)}
              </span>
              <span className="font-mono-tabular text-xs font-bold">
                {col.dayNumber}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hasAppts
                    ? isAnchor
                      ? "bg-white"
                      : "bg-[#0066CC]"
                    : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* 3. Main Google Calendar Split: Desktop Left Rail (xl+) + Main Calendar Canvas FIRST on Mobile/Tablet */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        {/* Desktop Persistent Left Rail (hidden below xl so mobile/tablet jump straight to calendar!) */}
        <aside className="hidden w-[240px] shrink-0 space-y-3.5 xl:block">
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_4px_16px_-10px_rgba(15,36,62,0.08)]">
            {renderMiniCalendarContent()}
          </section>

          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_4px_16px_-10px_rgba(15,36,62,0.08)]">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#556E89]">
              {gc.myCalendars}
            </h3>
            {renderMyCalendarsCheckboxes()}
          </section>

          {renderEhrSnapshotCard(false)}
        </aside>

        {/* Main Calendar Canvas + Focused Visit Action Card */}
        <div className="min-w-0 flex-1 space-y-3.5">
          {/* Focused Patient Visit Action Card */}
          {focusedAppointment ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EBF4FF]/80 via-white to-white p-3.5 shadow-[0_6px_20px_-12px_rgba(0,102,204,0.16)] sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar
                  name={focusedAppointment.patientName}
                  role="PATIENT"
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#0F243E]">
                      <bdi dir="auto">{focusedAppointment.patientName}</bdi>
                    </h3>
                    <UiBadge tone={APPT_BADGE_TONE[focusedAppointment.status]}>
                      {c.enums.appointmentStatus[focusedAppointment.status] ??
                        focusedAppointment.status}
                    </UiBadge>
                    <span
                      dir="ltr"
                      className="whitespace-nowrap rounded-full bg-[#F3F8FD] px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-[#0052A3]"
                    >
                      {focusedAppointment.slotStartIso.slice(0, 10)} ·{" "}
                      {focusedAppointment.slotStartIso.slice(11, 16)}–
                      {focusedAppointment.slotEndIso.slice(11, 16)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#4A627D]">
                    {formatVisitMode(focusedAppointment.visitMode, locale)} ·{" "}
                    <bdi dir="auto">{focusedAppointment.facilityName}</bdi>
                    {focusedAppointment.reason ? (
                      <>
                        {" "}
                        ·{" "}
                        <strong className="font-semibold text-[#0F243E]">
                          <bdi dir="auto">{focusedAppointment.reason}</bdi>
                        </strong>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {focusedAppointment.visitMode === "TELEHEALTH" &&
                (focusedAppointment.status === "CONFIRMED" ||
                  focusedAppointment.status === "CHECKED_IN") &&
                !isLockedPendingVerification ? (
                  <Link
                    href={`/consultation/${encodeURIComponent(focusedAppointment.id)}`}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white shadow-xs transition-[background-color,transform] duration-150 hover:bg-[#0052A3] active:scale-[0.97]"
                  >
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{a.joinVideoBtn}</span>
                  </Link>
                ) : null}

                <UiButton
                  size="sm"
                  variant="outline"
                  disabled={busy || isLockedPendingVerification}
                  onClick={() =>
                    onSelectPatientForConsultation(
                      focusedAppointment.patientUserId,
                      focusedAppointment.patientName,
                    )
                  }
                  className="bg-white"
                >
                  <Stethoscope
                    className="h-3.5 w-3.5 text-[#0066CC]"
                    aria-hidden="true"
                  />
                  <span>{openChartActionLabel}</span>
                </UiButton>

                {canManageQueue && focusedAppointment.status === "CONFIRMED" ? (
                  <>
                    <UiButton
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() =>
                        void onTransitionAppointment(
                          focusedAppointment.id,
                          "CHECKED_IN",
                        )
                      }
                    >
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{a.checkInBtn}</span>
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void onTransitionAppointment(
                          focusedAppointment.id,
                          "NO_SHOW",
                        )
                      }
                    >
                      {a.noShowBtn}
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        void onTransitionAppointment(
                          focusedAppointment.id,
                          "CANCELLED",
                        )
                      }
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{a.cancelBtn}</span>
                    </UiButton>
                  </>
                ) : null}

                {canManageQueue && focusedAppointment.status === "CHECKED_IN" ? (
                  <UiButton
                    size="sm"
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void onTransitionAppointment(
                        focusedAppointment.id,
                        "COMPLETED",
                      )
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{a.completeVisitBtn}</span>
                  </UiButton>
                ) : null}

                {focusedAppointment.patientPhone ? (
                  <a
                    href={`tel:${focusedAppointment.patientPhone}`}
                    dir="ltr"
                    aria-label={focusedAppointment.patientPhone}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDF0] bg-white text-[#0066CC] transition-colors hover:border-[#0066CC] active:scale-95"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#CBDDF0] bg-white px-4 py-3 text-xs text-[#4A627D]">
              <p className="font-bold text-[#0F243E]">{gc.noActiveVisitTitle}</p>
              {statusFilter !== "ALL" || searchQuery ? (
                <UiButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearchQuery("");
                  }}
                >
                  {gc.statusAll}
                </UiButton>
              ) : null}
            </section>
          )}

          {/* Calendar Views: WEEK | DAY | MONTH | AGENDA */}
          {viewMode === "WEEK"
            ? renderTimeGridColumns(weekColumns, 2)
            : viewMode === "DAY"
              ? renderTimeGridColumns([activeDayColumn], 4)
              : viewMode === "MONTH" ? (
                <section className="overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
                  <div className="grid grid-cols-7 border-b border-[#D7E4F2] bg-[#F8FBFE] text-center text-[11px] font-bold text-[#556E89]">
                    {mondayFirstLabels.map((wd) => (
                      <div key={wd} className="py-2.5">
                        {wd}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 divide-x divide-y divide-[#E8F1FA]">
                    {monthCells.map((cell) => {
                      const dayAppts = appointmentsByDate.get(cell.iso) ?? [];
                      const hasShift = activeShiftDowSet.has(cell.dayOfWeek);
                      const isToday = cell.iso === todayIso;
                      const isAnchor = cell.iso === anchorDate;

                      return (
                        <div
                          key={cell.iso}
                          className={`flex min-h-[72px] min-w-0 flex-col justify-between overflow-hidden p-1 transition-colors sm:min-h-[104px] sm:p-1.5 ${
                            isAnchor
                              ? "bg-[#EBF4FF]/45"
                              : cell.inCurrentMonth
                                ? "bg-white"
                                : "bg-[#F8FBFE]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAnchorDate(cell.iso);
                                if (dayAppts.length > 0) {
                                  setOverflowModal({
                                    title: gc.dayModalTitle(
                                      cell.iso,
                                      dayAppts.length,
                                    ),
                                    items: dayAppts,
                                  });
                                } else {
                                  setViewMode("DAY");
                                }
                              }}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono-tabular text-xs font-bold transition-colors active:scale-95 ${
                                isToday
                                  ? "bg-[#0066CC] text-white"
                                  : cell.inCurrentMonth
                                    ? "text-[#0F243E] hover:bg-[#EBF4FF]"
                                    : "text-[#9BB0C4]"
                              }`}
                            >
                              {cell.dayNumber}
                            </button>
                            {hasShift ? (
                              <span
                                title={gc.calShifts}
                                className="h-1.5 w-1.5 rounded-full bg-[#0F9D88] sm:h-2 sm:w-2"
                              />
                            ) : null}
                          </div>

                          {/* Mobile (<sm): clean colored dots instead of unreadable truncated text */}
                          {dayAppts.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setOverflowModal({
                                  title: gc.dayModalTitle(
                                    cell.iso,
                                    dayAppts.length,
                                  ),
                                  items: dayAppts,
                                })
                              }
                              className="mt-1 flex flex-wrap items-center gap-1 rounded-md p-0.5 sm:hidden"
                              aria-label={`${dayAppts.length} visits on ${cell.iso}`}
                            >
                              {dayAppts.slice(0, 3).map((ap) => (
                                <span
                                  key={ap.id}
                                  className={`h-2 w-2 rounded-full ${
                                    ap.visitMode === "TELEHEALTH"
                                      ? "bg-indigo-600"
                                      : ap.visitMode === "HOME_VISIT"
                                        ? "bg-[#0F9D88]"
                                        : "bg-[#0066CC]"
                                  }`}
                                />
                              ))}
                              {dayAppts.length > 3 ? (
                                <span className="font-mono-tabular text-[9px] font-bold text-[#0066CC]">
                                  +{dayAppts.length - 3}
                                </span>
                              ) : null}
                            </button>
                          ) : null}

                          {/* Tablet/Desktop (>=sm): crisp appointment chips + overflow modal trigger */}
                          <div className="mt-1 hidden space-y-1 sm:block">
                            {dayAppts.slice(0, 2).map((appt) => (
                              <button
                                key={appt.id}
                                type="button"
                                onClick={() => handleSelectAppointment(appt)}
                                className={`block w-full truncate rounded-md border border-s-2 px-1.5 py-0.5 text-start text-[10px] font-semibold transition-colors ${getEventClasses(
                                  appt,
                                  focusedAppointment?.id === appt.id,
                                )}`}
                              >
                                <span dir="ltr" className="font-mono-tabular">
                                  {appt.slotStartIso.slice(11, 16)}
                                </span>{" "}
                                <bdi dir="auto">{appt.patientName}</bdi>
                              </button>
                            ))}
                            {dayAppts.length > 2 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOverflowModal({
                                    title: gc.dayModalTitle(
                                      cell.iso,
                                      dayAppts.length,
                                    ),
                                    items: dayAppts,
                                  })
                                }
                                className="block w-full rounded-md px-1.5 py-0.5 text-start text-[10px] font-bold text-[#0066CC] hover:bg-[#EBF4FF]"
                              >
                                {gc.moreLabel(dayAppts.length - 2)}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                /* High-Volume Paginated Agenda List View */
                <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-4">
                  {agendaGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#CBDDF0] bg-[#F3F8FD] p-8 text-center text-xs text-[#4A627D]">
                      <Calendar className="mx-auto mb-2 h-6 w-6 text-[#87A0BC]" aria-hidden="true" />
                      <p className="font-bold text-[#0F243E]">{a.emptyVisitsTitle}</p>
                    </div>
                  ) : (
                    <div className="max-h-[clamp(380px,calc(100dvh-310px),680px)] space-y-4 overflow-y-auto overscroll-y-contain pe-1">
                      {agendaGroups.map((group) => (
                        <div key={group.date} className="space-y-1.5">
                          <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-[#F3F8FD] px-3 py-1.5 text-xs font-bold text-[#0F243E]">
                            <span>{formatDayHeading(group.date, locale)}</span>
                            <span className="font-mono-tabular text-[11px] text-[#0066CC]">
                              {group.items.length}
                            </span>
                          </div>
                          <ul className="divide-y divide-[#E8F1FA]">
                            {group.items.map((appt) => {
                              const isSelected = focusedAppointment?.id === appt.id;
                              const ModeIcon =
                                appt.visitMode === "TELEHEALTH"
                                  ? Video
                                  : appt.visitMode === "HOME_VISIT"
                                    ? Home
                                    : Stethoscope;
                              return (
                                <li key={appt.id}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAppointment(appt)}
                                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-xs transition-colors active:scale-[0.99] ${
                                      isSelected
                                        ? "bg-[#EBF4FF] ring-1 ring-[#0066CC]"
                                        : "hover:bg-[#F8FBFE]"
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span
                                        dir="ltr"
                                        className="w-24 shrink-0 font-mono-tabular font-bold text-[#0066CC]"
                                      >
                                        {appt.slotStartIso.slice(11, 16)}–
                                        {appt.slotEndIso.slice(11, 16)}
                                      </span>
                                      <EntityAvatar
                                        name={appt.patientName}
                                        role="PATIENT"
                                        size="xs"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate font-bold text-[#0F243E]">
                                          <bdi dir="auto">{appt.patientName}</bdi>
                                        </p>
                                        <p className="truncate text-[11px] text-[#556E89]">
                                          <bdi dir="auto">{appt.facilityName}</bdi>
                                          {appt.reason ? ` · ${appt.reason}` : ""}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F8FD] px-2 py-0.5 text-[10.5px] font-semibold text-[#4A627D]">
                                        <ModeIcon
                                          className="h-3 w-3 text-[#0066CC]"
                                          aria-hidden="true"
                                        />
                                        <span>
                                          {formatVisitMode(appt.visitMode, locale)}
                                        </span>
                                      </span>
                                      <UiBadge tone={APPT_BADGE_TONE[appt.status]}>
                                        {c.enums.appointmentStatus[appt.status] ??
                                          appt.status}
                                      </UiBadge>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}

                      {filteredAppointments.length > agendaLimit ? (
                        <div className="pt-2 text-center">
                          <UiButton
                            size="sm"
                            variant="outline"
                            onClick={() => setAgendaLimit((n) => n + 25)}
                          >
                            {gc.loadMoreBtn(
                              filteredAppointments.length - agendaLimit,
                            )}
                          </UiButton>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

          {/* Compact Patient EHR & Allergy Snapshot below calendar on <xl (keeps allergies visible without burying calendar!) */}
          <div className="xl:hidden">{renderEhrSnapshotCard(true)}</div>
        </div>
      </div>

      {/* 4. Mobile/Tablet Slide-Up Bottom Sheet for Mini-Calendar & "My Calendars" Filters */}
      {mobileFiltersOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={gc.myCalendars}
          className="ms-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0F243E]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 xl:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        >
          <div
            className="ms-modal-in max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#D7E4F2] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#E8F1FA] pb-3">
              <h3 className="font-editorial text-base font-bold text-[#0F243E]">
                {gc.myCalendars}
              </h3>
              <button
                type="button"
                aria-label={gc.closeLabel}
                onClick={() => setMobileFiltersOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] text-[#4A627D] hover:bg-[#F3F8FD] active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              {renderMiniCalendarContent()}
              <div className="border-t border-[#E8F1FA] pt-3">
                {renderMyCalendarsCheckboxes()}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. High-Volume Day / Slot Overflow Bottom Sheet (Mobile) / Modal (Desktop) */}
      {overflowModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={overflowModal.title}
          className="ms-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0F243E]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setOverflowModal(null)}
        >
          <div
            className="ms-modal-in max-h-[86dvh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-[#D7E4F2] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E8F1FA] px-5 py-3.5">
              <h3 className="font-editorial text-base font-bold text-[#0F243E]">
                {overflowModal.title}
              </h3>
              <button
                type="button"
                aria-label={gc.closeLabel}
                onClick={() => setOverflowModal(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] text-[#4A627D] hover:bg-[#F3F8FD] active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="max-h-[65dvh] divide-y divide-[#E8F1FA] overflow-y-auto overscroll-y-contain p-3">
              {overflowModal.items.map((appt) => (
                <li key={appt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAppointment(appt);
                      setOverflowModal(null);
                    }}
                    className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-xs transition-colors hover:bg-[#F3F8FD] active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#0F243E]">
                        <span
                          dir="ltr"
                          className="me-2 font-mono-tabular text-[#0066CC]"
                        >
                          {appt.slotStartIso.slice(11, 16)}
                        </span>
                        <bdi dir="auto">{appt.patientName}</bdi>
                      </p>
                      <p className="truncate text-[11px] text-[#556E89]">
                        {formatVisitMode(appt.visitMode, locale)} ·{" "}
                        <bdi dir="auto">{appt.facilityName}</bdi>
                      </p>
                    </div>
                    <UiBadge tone={APPT_BADGE_TONE[appt.status]}>
                      {c.enums.appointmentStatus[appt.status] ?? appt.status}
                    </UiBadge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
