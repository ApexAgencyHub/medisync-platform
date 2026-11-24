"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  AuthenticatedUser,
  DoctorScheduleSummary,
  UpdateScheduleInput,
  VisitMode,
} from "@medisync/contracts";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  GripVertical,
  Home,
  LayoutGrid,
  List,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Stethoscope,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { EntityPicker, type EntityOption } from "@/shared/ui/EntityPicker";
import { UiButton, UiInput } from "@/shared/ui/primitives";
import { ClinicalStepper } from "@/shared/ui/TactileControls";
import {
  estimateSlotCount,
  formatMinutesToHhMm,
  packTimeIntervals,
  parseHhMmToMinutes,
  snapMinutes,
} from "./calendar-layout";

interface VisualScheduleBuilderProps {
  currentUser: AuthenticatedUser | null;
  schedules: readonly DoctorScheduleSummary[];
  clinicOptions: readonly EntityOption[];
  doctorOptions?: readonly EntityOption[];
  currencyCode: string;
  canManageSchedule: boolean;
  isPendingStaff: boolean;
  busy: boolean;
  showPracticeProfileFields?: boolean;
  specialtyInput: string;
  licenseInput: string;
  feeMinorInput: string;
  schedFacilityId: string;
  schedDoctorId?: string;
  schedDay: number;
  schedStart: string;
  schedEnd: string;
  schedDuration: string;
  schedMode: VisitMode;
  publishWeekdays: boolean;
  allowedModes?: readonly VisitMode[];
  onSpecialtyChange?: (val: string) => void;
  onLicenseChange?: (val: string) => void;
  onFeeChange?: (val: string) => void;
  onFacilityChange: (val: string) => void;
  onDoctorChange?: (val: string) => void;
  onDayChange: (day: number) => void;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
  onDurationChange: (val: string) => void;
  onModeChange: (mode: VisitMode) => void;
  onPublishWeekdaysChange: (checked: boolean) => void;
  onSubmitPublish: (e: FormEvent<HTMLFormElement>) => void;
  onToggleSchedule: (sched: DoctorScheduleSummary) => void;
  onDeleteSchedule: (sched: DoctorScheduleSummary) => void;
  onUpdateSchedule?: (
    scheduleId: string,
    patch: UpdateScheduleInput,
  ) => Promise<void>;
  onDuplicateSchedule?: (
    sched: DoctorScheduleSummary,
    targetDayOfWeek: number,
  ) => Promise<void>;
  heading: string;
  signInHint: string;
  publishBtnLabel: string;
  publishWeekdaysLabel: string;
  activeStatusLabel: string;
  pausedStatusLabel: string;
  pauseBtnLabel: string;
  resumeBtnLabel: string;
  deleteBtnLabel: string;
  clinicLabel: string;
  clinicPlaceholder: string;
  clinicEmpty: string;
  practitionerLabel?: string;
  practitionerPlaceholder?: string;
  practitionerEmpty?: string;
  specialtyLabel?: string;
  licenseLabel?: string;
  feeLabel?: string;
}

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_PX = 60; // 1px = 1 minute
const TOTAL_GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
const HOURS_LIST = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, idx) => START_HOUR + idx,
);

const TIME_PRESETS = [
  { id: "morning", label: "Morning", range: "08:30–12:30", start: "08:30", end: "12:30" },
  { id: "mid", label: "Mid-Morning", range: "09:00–12:00", start: "09:00", end: "12:00" },
  { id: "afternoon", label: "Afternoon", range: "14:00–18:00", start: "14:00", end: "18:00" },
  { id: "fullday", label: "Full Day", range: "09:00–17:00", start: "09:00", end: "17:00" },
] as const;

const DURATION_OPTIONS = ["15", "20", "30", "45", "60"] as const;
const FEE_PRESETS = [20000, 30000, 35000, 40000, 50000] as const;

const STUDIO_COPY = {
  en: {
    studioTitle: "Weekly Schedule Calendar",
    myShifts: "My Shifts",
    allShifts: "All Clinic",
    viewGrid: "Calendar Grid",
    viewList: "List View",
    newShiftBtn: "New Shift",
    practiceBtn: "Specialty & Fee",
    allModes: "All",
    pausedFilter: "Paused",
    weeklySummary: (hrs: number, slots: number) => `${hrs}h/wk · ${slots} slots/wk`,
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    daysOrder: [1, 2, 3, 4, 5, 6, 0] as const,
    stepDays: "1. Choose Day or Workweek",
    stepMode: "2. Visit Format",
    stepHours: "3. Shift Hours",
    stepDuration: "4. Slot Length",
    slotsPerDay: (n: number) => `${n} bookable slot${n === 1 ? "" : "s"} / day`,
    editShiftTitle: "Edit Shift Window",
    saveChangesBtn: "Save Changes",
    cancelBtn: "Cancel",
    copyNextDayTitle: "Duplicate to next day",
    editShiftTitleBtn: "Edit shift",
    resizeTitle: "Drag to resize shift duration",
    modeTitles: {
      IN_PERSON: "Clinic Visit",
      TELEHEALTH: "Video Visit",
      HOME_VISIT: "Home Visit",
    },
    emptyList: "No shifts match this filter.",
  },
  fr: {
    studioTitle: "Calendrier Hebdomadaire des Créneaux",
    myShifts: "Mes Créneaux",
    allShifts: "Toute la Clinique",
    viewGrid: "Grille Horaire",
    viewList: "Liste",
    newShiftBtn: "Nouveau Créneau",
    practiceBtn: "Spécialité & Tarif",
    allModes: "Tous",
    pausedFilter: "En Pause",
    weeklySummary: (hrs: number, slots: number) => `${hrs}h/sem · ${slots} créneaux`,
    daysShort: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    daysOrder: [1, 2, 3, 4, 5, 6, 0] as const,
    stepDays: "1. Jour ou Semaine",
    stepMode: "2. Type de Visite",
    stepHours: "3. Horaires",
    stepDuration: "4. Durée du Créneau",
    slotsPerDay: (n: number) => `${n} créneau${n === 1 ? "" : "x"} / jour`,
    editShiftTitle: "Modifier le Créneau",
    saveChangesBtn: "Enregistrer",
    cancelBtn: "Annuler",
    copyNextDayTitle: "Dupliquer au jour suivant",
    editShiftTitleBtn: "Modifier le créneau",
    resizeTitle: "Glisser pour ajuster la durée",
    modeTitles: {
      IN_PERSON: "Cabinet",
      TELEHEALTH: "Vidéo",
      HOME_VISIT: "Domicile",
    },
    emptyList: "Aucun créneau trouvé.",
  },
  ar: {
    studioTitle: "تقويم ساعات العمل الأسبوعي",
    myShifts: "فتراتي",
    allShifts: "كل العيادة",
    viewGrid: "شبكة التقويم",
    viewList: "قائمة",
    newShiftBtn: "إضافة فترة",
    practiceBtn: "التخصص والتعريفة",
    allModes: "الكل",
    pausedFilter: "متوقف",
    weeklySummary: (hrs: number, slots: number) => `${hrs} ساعة/أسبوع · ${slots} موعد`,
    daysShort: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
    daysOrder: [1, 2, 3, 4, 5, 6, 0] as const,
    stepDays: "1. اختر اليوم أو الأسبوع",
    stepMode: "2. نوع الزيارة",
    stepHours: "3. ساعات العمل",
    stepDuration: "4. مدة الموعد",
    slotsPerDay: (n: number) => `${n} مواعيد متاحة / يوم`,
    editShiftTitle: "تعديل فترة العمل",
    saveChangesBtn: "حفظ التعديلات",
    cancelBtn: "إلغاء",
    copyNextDayTitle: "نسخ إلى اليوم التالي",
    editShiftTitleBtn: "تعديل الفترة",
    resizeTitle: "اسحب لتغيير مدة الفترة",
    modeTitles: {
      IN_PERSON: "في العيادة",
      TELEHEALTH: "فيديو",
      HOME_VISIT: "زيارة منزلية",
    },
    emptyList: "لا توجد فترات عمل مطابقة.",
  },
} as const;

export function VisualScheduleBuilder({
  currentUser,
  schedules,
  clinicOptions,
  doctorOptions,
  currencyCode,
  canManageSchedule,
  isPendingStaff,
  busy,
  showPracticeProfileFields,
  specialtyInput,
  licenseInput,
  feeMinorInput,
  schedFacilityId,
  schedDoctorId,
  schedDay,
  schedStart,
  schedEnd,
  schedDuration,
  schedMode,
  publishWeekdays,
  allowedModes = ["IN_PERSON", "TELEHEALTH", "HOME_VISIT"],
  onSpecialtyChange,
  onLicenseChange,
  onFeeChange,
  onFacilityChange,
  onDoctorChange,
  onDayChange,
  onStartChange,
  onEndChange,
  onDurationChange,
  onModeChange,
  onPublishWeekdaysChange,
  onSubmitPublish,
  onToggleSchedule,
  onDeleteSchedule,
  onUpdateSchedule,
  onDuplicateSchedule,
  heading,
  signInHint,
  publishBtnLabel,
  publishWeekdaysLabel,
  activeStatusLabel,
  pausedStatusLabel,
  pauseBtnLabel,
  resumeBtnLabel,
  deleteBtnLabel,
  clinicLabel,
  clinicPlaceholder,
  clinicEmpty,
  practitionerLabel,
  practitionerPlaceholder,
  practitionerEmpty,
  specialtyLabel,
  licenseLabel,
  feeLabel,
}: VisualScheduleBuilderProps) {
  const { locale, isRtl } = useLocale();
  const sc = STUDIO_COPY[locale] ?? STUDIO_COPY.en;

  const isSelfPractitioner =
    currentUser?.role === "DOCTOR" || currentUser?.role === "NURSE";
  const [ownerScope, setOwnerScope] = useState<"MINE" | "ALL">(
    isSelfPractitioner ? "MINE" : "ALL",
  );
  const [modeFilter, setModeFilter] = useState<VisitMode | "ALL" | "PAUSED">("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const formatMinorToMajor = (minorStr: string) => {
    if (minorStr === "") return "";
    const num = Number(minorStr);
    if (!Number.isFinite(num)) return "";
    const major = num / 100;
    return Number.isInteger(major) ? String(major) : major.toFixed(2);
  };
  const [feeMajorDraft, setFeeMajorDraft] = useState<string>(() =>
    formatMinorToMajor(feeMinorInput),
  );
  const [lastSyncedMinor, setLastSyncedMinor] = useState<string>(feeMinorInput);
  if (feeMinorInput !== lastSyncedMinor) {
    setLastSyncedMinor(feeMinorInput);
    setFeeMajorDraft(formatMinorToMajor(feeMinorInput));
  }

  // Drag & Drop state (moving shifts across days/hours)
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

  // Pointer Resize state (zero-thrash snapped preview + pure pointerup commit)
  const [resizingShift, setResizingShift] = useState<{
    id: string;
    previewEndMin: number;
  } | null>(null);

  // Pointer Click/Drag-Select on empty calendar slots
  const [createSelection, setCreateSelection] = useState<{
    dayOfWeek: number;
    anchorMin: number;
    currentMin: number;
  } | null>(null);

  // Edit existing shift modal state
  const [editingShift, setEditingShift] = useState<{
    id: string;
    facilityId: string;
    dayOfWeek: number;
    startTimeUtc: string;
    endTimeUtc: string;
    slotDurationMinutes: string;
    visitMode: VisitMode;
    isActive: boolean;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const colRectCacheRef = useRef<Map<number, DOMRect>>(new Map());
  const resizeMetaRef = useRef<{
    id: string;
    minEndMin: number;
    originY: number;
    originEndMin: number;
    latestEndMin: number;
  } | null>(null);
  const createMetaRef = useRef<{
    dayOfWeek: number;
    anchorMin: number;
    currentMin: number;
    columnEl: HTMLDivElement;
  } | null>(null);
  const callbacksRef = useRef({
    onUpdateSchedule,
    onPublishWeekdaysChange,
    onDayChange,
    onStartChange,
    onEndChange,
  });
  callbacksRef.current = {
    onUpdateSchedule,
    onPublishWeekdaysChange,
    onDayChange,
    onStartChange,
    onEndChange,
  };

  // Responsive mobile default: phones (<768px) default to thumb-friendly LIST view (1-tap switch to Grid anytime!)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("LIST");
    }
  }, []);

  // Auto-scroll calendar grid to 08:00 when entering GRID view
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_PX - 12);
    }
  }, [viewMode]);

  const activeResizeId = resizingShift?.id ?? null;

  // Global pointer listeners for 60fps bottom-edge shift resizing (pure + touch-safe + pointercancel cleanup)
  useEffect(() => {
    if (!activeResizeId || !resizeMetaRef.current) return;

    function handleMove(ev: PointerEvent) {
      const meta = resizeMetaRef.current;
      if (!meta) return;
      const deltaMin = ev.clientY - meta.originY;
      const rawEnd = snapMinutes(meta.originEndMin + deltaMin, 30);
      const clamped = Math.max(meta.minEndMin, Math.min(END_HOUR * 60, rawEnd));
      if (clamped === meta.latestEndMin) return; // Zero-thrash: skip React commit until 30-min snap boundary crosses
      meta.latestEndMin = clamped;
      setResizingShift({ id: meta.id, previewEndMin: clamped });
    }

    function handleEnd(commit: boolean) {
      const meta = resizeMetaRef.current;
      resizeMetaRef.current = null;
      setResizingShift(null);
      if (
        commit &&
        meta &&
        meta.latestEndMin !== meta.originEndMin &&
        callbacksRef.current.onUpdateSchedule
      ) {
        void callbacksRef.current.onUpdateSchedule(meta.id, {
          endTimeUtc: formatMinutesToHhMm(meta.latestEndMin),
        });
      }
    }

    const onUp = () => handleEnd(true);
    const onCancel = () => handleEnd(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [activeResizeId]);

  const activeCreateKey = createSelection
    ? `${createSelection.dayOfWeek}-${createSelection.anchorMin}`
    : null;

  // Global pointer listeners for zero-thrash click/drag-select empty slot creation
  useEffect(() => {
    if (!activeCreateKey || !createMetaRef.current) return;

    function handleMove(ev: PointerEvent) {
      const meta = createMetaRef.current;
      if (!meta) return;
      const relY = ev.clientY - meta.columnEl.getBoundingClientRect().top;
      const rawMin = snapMinutes(START_HOUR * 60 + relY, 30);
      const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, rawMin));
      if (clamped === meta.currentMin) return;
      meta.currentMin = clamped;
      setCreateSelection({
        dayOfWeek: meta.dayOfWeek,
        anchorMin: meta.anchorMin,
        currentMin: clamped,
      });
    }

    function handleEnd(commit: boolean) {
      const meta = createMetaRef.current;
      createMetaRef.current = null;
      setCreateSelection(null);
      if (!commit || !meta) return;
      const minStart = Math.min(meta.anchorMin, meta.currentMin);
      let maxEnd = Math.max(meta.anchorMin, meta.currentMin);
      if (maxEnd - minStart < 30) {
        maxEnd = Math.min(END_HOUR * 60, minStart + 180);
      }
      callbacksRef.current.onPublishWeekdaysChange(false);
      callbacksRef.current.onDayChange(meta.dayOfWeek);
      callbacksRef.current.onStartChange(formatMinutesToHhMm(minStart));
      callbacksRef.current.onEndChange(formatMinutesToHhMm(maxEnd));
      setComposerOpen(true);
    }

    const onUp = () => handleEnd(true);
    const onCancel = () => handleEnd(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [activeCreateKey]);

  const mySchedulesCount = useMemo(() => {
    if (!currentUser) return 0;
    return schedules.filter((s) => s.doctorUserId === currentUser.id).length;
  }, [currentUser, schedules]);

  const scopedSchedules = useMemo(() => {
    let base = schedules;
    if (isSelfPractitioner && ownerScope === "MINE" && currentUser) {
      const own = schedules.filter((s) => s.doctorUserId === currentUser.id);
      base = own.length > 0 ? own : schedules;
    }
    if (modeFilter === "PAUSED") {
      return base.filter((s) => !s.isActive);
    }
    if (modeFilter !== "ALL") {
      return base.filter((s) => s.visitMode === modeFilter);
    }
    return base;
  }, [currentUser, isSelfPractitioner, modeFilter, ownerScope, schedules]);

  const weeklyTotals = useMemo(() => {
    let totalMin = 0;
    let totalSlots = 0;
    for (const s of scopedSchedules) {
      if (!s.isActive) continue;
      const diff = Math.max(
        0,
        parseHhMmToMinutes(s.endTimeUtc) - parseHhMmToMinutes(s.startTimeUtc),
      );
      totalMin += diff;
      totalSlots += estimateSlotCount(
        s.startTimeUtc,
        s.endTimeUtc,
        s.slotDurationMinutes,
      );
    }
    return {
      hours: Math.round((totalMin / 60) * 10) / 10,
      slots: totalSlots,
    };
  }, [scopedSchedules]);

  // Packed columns strictly keyed on schedule data (NOT live resize pixels!) for 60fps resizing
  const packedByDay = useMemo(() => {
    const map = new Map<
      number,
      ReturnType<typeof packTimeIntervals<DoctorScheduleSummary>>
    >();
    for (const dow of sc.daysOrder) {
      const dayItems = scopedSchedules
        .filter((s) => s.dayOfWeek === dow)
        .map((s) => ({
          id: s.id,
          startMin: parseHhMmToMinutes(s.startTimeUtc),
          endMin: parseHhMmToMinutes(s.endTimeUtc),
          item: s,
        }));
      map.set(dow, packTimeIntervals(dayItems));
    }
    return map;
  }, [sc.daysOrder, scopedSchedules]);

  function canMutateShift(sched: DoctorScheduleSummary): boolean {
    if (!currentUser || isPendingStaff) return false;
    return (
      ["CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(currentUser.role) ||
      sched.doctorUserId === currentUser.id
    );
  }

  function handleShiftDragStart(
    e: ReactDragEvent<HTMLDivElement>,
    sched: DoctorScheduleSummary,
  ) {
    if (!canMutateShift(sched) || busy) {
      e.preventDefault();
      return;
    }
    colRectCacheRef.current.clear();
    const startMin = parseHhMmToMinutes(sched.startTimeUtc);
    const endMin = parseHhMmToMinutes(sched.endTimeUtc);
    const durationMin = Math.max(30, endMin - startMin);
    const rect = e.currentTarget.getBoundingClientRect();
    const grabOffsetMin = Math.max(0, Math.min(durationMin - 15, e.clientY - rect.top));

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sched.id);
    setDraggingShift({ id: sched.id, durationMin, grabOffsetMin });
  }

  function handleDayDragOver(e: ReactDragEvent<HTMLDivElement>, dayOfWeek: number) {
    if (!draggingShift) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    let rect = colRectCacheRef.current.get(dayOfWeek);
    if (!rect) {
      rect = e.currentTarget.getBoundingClientRect();
      colRectCacheRef.current.set(dayOfWeek, rect);
    }
    const relY = e.clientY - rect.top - draggingShift.grabOffsetMin;
    const rawStart = snapMinutes(START_HOUR * 60 + relY, 30);
    const clampedStart = Math.max(
      START_HOUR * 60,
      Math.min(END_HOUR * 60 - draggingShift.durationMin, rawStart),
    );
    const clampedEnd = Math.min(END_HOUR * 60, clampedStart + draggingShift.durationMin);
    setDropPreview((prev) =>
      prev &&
      prev.dayOfWeek === dayOfWeek &&
      prev.startMin === clampedStart &&
      prev.endMin === clampedEnd
        ? prev
        : { dayOfWeek, startMin: clampedStart, endMin: clampedEnd },
    );
  }

  function handleDayDrop(e: ReactDragEvent<HTMLDivElement>, dayOfWeek: number) {
    e.preventDefault();
    const active = draggingShift;
    const preview = dropPreview;
    setDraggingShift(null);
    setDropPreview(null);
    colRectCacheRef.current.clear();
    if (!active || !preview || !onUpdateSchedule) return;

    const existing = schedules.find((s) => s.id === active.id);
    const nextStart = formatMinutesToHhMm(preview.startMin);
    const nextEnd = formatMinutesToHhMm(preview.endMin);
    if (
      existing &&
      existing.dayOfWeek === dayOfWeek &&
      existing.startTimeUtc === nextStart &&
      existing.endTimeUtc === nextEnd
    ) {
      return;
    }
    void onUpdateSchedule(active.id, {
      dayOfWeek,
      startTimeUtc: nextStart,
      endTimeUtc: nextEnd,
    });
  }

  function handleEmptySlotPointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    dayOfWeek: number,
  ) {
    if (!canManageSchedule || isPendingStaff || busy) return;
    if (e.pointerType === "touch") return; // Preserve native vertical scroll on touchscreens; use + button or New Shift
    if ((e.target as HTMLElement).closest("[data-shift-card='true']")) return;
    const colEl = e.currentTarget;
    const rect = colEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const snapped = Math.max(
      START_HOUR * 60,
      Math.min(END_HOUR * 60 - 30, snapMinutes(START_HOUR * 60 + relY, 30)),
    );
    createMetaRef.current = {
      dayOfWeek,
      anchorMin: snapped,
      currentMin: snapped,
      columnEl: colEl,
    };
    setCreateSelection({
      dayOfWeek,
      anchorMin: snapped,
      currentMin: snapped,
    });
  }

  function openEditModal(sched: DoctorScheduleSummary) {
    setEditingShift({
      id: sched.id,
      facilityId: sched.facilityId,
      dayOfWeek: sched.dayOfWeek,
      startTimeUtc: sched.startTimeUtc,
      endTimeUtc: sched.endTimeUtc,
      slotDurationMinutes: String(sched.slotDurationMinutes),
      visitMode: sched.visitMode,
      isActive: sched.isActive,
    });
  }

  async function handleSaveEditShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingShift || !onUpdateSchedule) return;
    await onUpdateSchedule(editingShift.id, {
      facilityId: editingShift.facilityId,
      dayOfWeek: editingShift.dayOfWeek,
      startTimeUtc: editingShift.startTimeUtc,
      endTimeUtc: editingShift.endTimeUtc,
      slotDurationMinutes: Number(editingShift.slotDurationMinutes) || 30,
      visitMode: editingShift.visitMode,
      isActive: editingShift.isActive,
    });
    setEditingShift(null);
  }

  const estimatedComposerSlots = estimateSlotCount(
    schedStart,
    schedEnd,
    Number(schedDuration) || 30,
  );

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      {/* 1. Google Calendar–Style Studio Toolbar (Responsive touch targets >=36px) */}
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2.5 sm:items-center">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC]">
              <CalendarClock className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-editorial text-base font-bold text-[#0F243E]">
                  {sc.studioTitle}
                </h2>
                <span className="whitespace-nowrap rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-0.5 font-mono-tabular text-[11px] font-bold text-[#0B6B5C]">
                  {sc.weeklySummary(weeklyTotals.hours, weeklyTotals.slots)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle: My Shifts vs All Facility */}
            {isSelfPractitioner && schedules.length > mySchedulesCount && mySchedulesCount > 0 ? (
              <div className="inline-flex rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1">
                <button
                  type="button"
                  onClick={() => setOwnerScope("MINE")}
                  className={`min-h-[34px] rounded-lg px-2.5 text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                    ownerScope === "MINE"
                      ? "bg-[#0066CC] text-white shadow-2xs"
                      : "text-[#4A627D] hover:text-[#0F243E]"
                  }`}
                >
                  {sc.myShifts} ({mySchedulesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerScope("ALL")}
                  className={`min-h-[34px] rounded-lg px-2.5 text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                    ownerScope === "ALL"
                      ? "bg-[#0066CC] text-white shadow-2xs"
                      : "text-[#4A627D] hover:text-[#0F243E]"
                  }`}
                >
                  {sc.allShifts} ({schedules.length})
                </button>
              </div>
            ) : null}

            {/* View Switcher: Calendar Grid vs Compact List */}
            <div className="inline-flex rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1">
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                  viewMode === "GRID"
                    ? "bg-[#0066CC] text-white shadow-2xs"
                    : "text-[#4A627D] hover:text-[#0F243E]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{sc.viewGrid}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                  viewMode === "LIST"
                    ? "bg-[#0066CC] text-white shadow-2xs"
                    : "text-[#4A627D] hover:text-[#0F243E]"
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{sc.viewList}</span>
              </button>
            </div>

            {showPracticeProfileFields ? (
              <UiButton
                size="sm"
                variant="outline"
                onClick={() => setPracticeOpen((prev) => !prev)}
              >
                <Settings2 className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{sc.practiceBtn}</span>
              </UiButton>
            ) : null}

            <UiButton
              size="sm"
              variant="primary"
              disabled={!canManageSchedule || isPendingStaff || busy}
              onClick={() => setComposerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{sc.newShiftBtn}</span>
            </UiButton>
          </div>
        </div>

        {/* Mode Filter Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E8F1FA] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", ...allowedModes, "PAUSED"] as const).map((filterVal) => {
              const active = modeFilter === filterVal;
              const label =
                filterVal === "ALL"
                  ? sc.allModes
                  : filterVal === "PAUSED"
                    ? sc.pausedFilter
                    : sc.modeTitles[filterVal];
              return (
                <button
                  key={filterVal}
                  type="button"
                  onClick={() => setModeFilter(filterVal)}
                  className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-95 ${
                    active
                      ? "bg-[#0F243E] text-white"
                      : "border border-[#D7E4F2] bg-[#F8FBFE] text-[#4A627D] hover:border-[#0066CC] hover:text-[#0066CC]"
                  }`}
                >
                  {filterVal === "IN_PERSON" ? (
                    <span className="h-2 w-2 rounded-full bg-[#0066CC]" />
                  ) : filterVal === "TELEHEALTH" ? (
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  ) : filterVal === "HOME_VISIT" ? (
                    <span className="h-2 w-2 rounded-full bg-[#0F9D88]" />
                  ) : filterVal === "PAUSED" ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  ) : null}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {!canManageSchedule ? (
            <span className="text-xs font-medium text-[#556E89]">{signInHint}</span>
          ) : null}
        </div>

        {/* Collapsible Practice Specialty / Fee Drawer */}
        {showPracticeProfileFields && practiceOpen ? (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-[#BFDBFE] bg-[#F3F8FD] p-4 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold text-[#2F4661]">
              <span>{specialtyLabel ?? "Specialty"}</span>
              <UiInput
                value={specialtyInput}
                onChange={(e) => onSpecialtyChange?.(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-[#2F4661]">
              <span>{licenseLabel ?? "Medical License #"}</span>
              <UiInput
                value={licenseInput}
                onChange={(e) => onLicenseChange?.(e.target.value)}
              />
            </label>
            <ClinicalStepper
              id="schedule-practice-fee"
              label={feeLabel ?? `Fee (${currencyCode})`}
              value={feeMajorDraft}
              onChange={(next) => {
                setFeeMajorDraft(next);
                const raw = next.trim().replace(",", ".");
                if (raw === "") {
                  setLastSyncedMinor("");
                  onFeeChange?.("");
                  return;
                }
                const parsed = Number.parseFloat(raw);
                if (Number.isFinite(parsed) && parsed >= 0) {
                  const nextMinor = String(Math.round(parsed * 100));
                  setLastSyncedMinor(nextMinor);
                  onFeeChange?.(nextMinor);
                }
              }}
              step={50}
              min={0}
              max={5000}
              unit={currencyCode}
              presets={FEE_PRESETS.map((minor) => ({
                label: `${minor / 100}`,
                value: String(minor / 100),
              }))}
            />
          </div>
        ) : null}
      </section>

      {/* 2. Main Interactive Google Calendar Time-Grid OR Responsive List View */}
      {viewMode === "GRID" ? (
        <section className="overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_8px_28px_-14px_rgba(15,36,62,0.1)]">
          <div className="overflow-x-auto overscroll-x-contain">
            <div className="min-w-[690px]">
              {/* Sticky 7-Day Column Headers (fits all 7 days inside 768px tablet cleanly!) */}
              <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#D7E4F2] bg-[#F8FBFE]">
                <div className="sticky start-0 z-20 flex items-center justify-center border-e border-[#E8F1FA] bg-[#F8FBFE] py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6B829D]">
                  UTC
                </div>
                {sc.daysOrder.map((dow) => {
                  const dayPacked = packedByDay.get(dow) ?? [];
                  const dayHours =
                    Math.round(
                      (dayPacked
                        .filter((p) => p.item.isActive)
                        .reduce((acc, p) => acc + (p.endMin - p.startMin), 0) /
                        60) *
                        10,
                    ) / 10;
                  return (
                    <div
                      key={dow}
                      className="flex items-center justify-between gap-1 border-e border-[#E8F1FA] px-2 py-2 last:border-e-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0F243E]">
                          {sc.daysShort[dow]}
                        </p>
                        <p className="font-mono-tabular text-[10px] font-semibold text-[#6B829D]">
                          {dayHours > 0 ? `${dayHours}h` : "—"}
                        </p>
                      </div>
                      {canManageSchedule && !isPendingStaff ? (
                        <button
                          type="button"
                          onClick={() => {
                            onPublishWeekdaysChange(false);
                            onDayChange(dow);
                            setComposerOpen(true);
                          }}
                          title={`Add shift on ${sc.daysShort[dow]}`}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#D7E4F2] bg-white text-[#0066CC] transition-colors hover:bg-[#EBF4FF] active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Scrollable Viewport-Aware Hourly Time-Grid Body */}
              <div
                ref={scrollContainerRef}
                className="relative h-[clamp(400px,calc(100dvh-300px),680px)] overflow-y-auto overscroll-y-contain"
              >
                <div
                  className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]"
                  style={{ height: `${TOTAL_GRID_HEIGHT}px` }}
                >
                  {/* Sticky Left Time Gutter (never scrolls out of sight horizontally!) */}
                  <div className="sticky start-0 z-20 relative border-e border-[#E8F1FA] bg-[#FBFDFF]">
                    {HOURS_LIST.map((hour) => (
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

                  {/* 7 Interactive Day Columns (Mon -> Sun) */}
                  {sc.daysOrder.map((dow) => {
                    const packed = packedByDay.get(dow) ?? [];
                    const isDropTarget = dropPreview?.dayOfWeek === dow;
                    const isCreateTarget = createSelection?.dayOfWeek === dow;

                    return (
                      <div
                        key={dow}
                        onDragOver={(e) => handleDayDragOver(e, dow)}
                        onDrop={(e) => handleDayDrop(e, dow)}
                        onPointerDown={(e) => handleEmptySlotPointerDown(e, dow)}
                        className={`relative border-e border-[#E8F1FA] transition-colors last:border-e-0 ${
                          isDropTarget
                            ? "bg-[#EBF4FF]/40"
                            : canManageSchedule && !isPendingStaff
                              ? "md:cursor-crosshair bg-white"
                              : "bg-white"
                        }`}
                      >
                        {/* Hourly & Half-Hour Guide Lines */}
                        {HOURS_LIST.map((hour) => (
                          <div
                            key={hour}
                            style={{
                              top: `${(hour - START_HOUR) * HOUR_PX}px`,
                              height: `${HOUR_PX}px`,
                            }}
                            className="pointer-events-none absolute inset-x-0 border-t border-[#EDF3FA] first:border-t-0"
                          >
                            <div className="mt-[29px] border-t border-dashed border-[#F3F7FC]" />
                          </div>
                        ))}

                        {/* Drag-and-Drop Ghost Target Preview */}
                        {isDropTarget && dropPreview ? (
                          <div
                            style={{
                              top: `${Math.max(0, dropPreview.startMin - START_HOUR * 60)}px`,
                              height: `${Math.max(30, dropPreview.endMin - dropPreview.startMin)}px`,
                            }}
                            className="pointer-events-none absolute inset-x-1 z-20 flex flex-col justify-center rounded-xl border-2 border-dashed border-[#0066CC] bg-[#EBF4FF]/90 px-1.5 py-1 text-center shadow-sm"
                          >
                            <span
                              dir="ltr"
                              className="font-mono-tabular text-[10.5px] font-bold text-[#0052A3]"
                            >
                              {sc.daysShort[dow]} ·{" "}
                              {formatMinutesToHhMm(dropPreview.startMin)}–
                              {formatMinutesToHhMm(dropPreview.endMin)}
                            </span>
                          </div>
                        ) : null}

                        {/* Click/Drag Empty Slot Selection Preview */}
                        {isCreateTarget && createSelection ? (
                          <div
                            style={{
                              top: `${Math.max(
                                0,
                                Math.min(
                                  createSelection.anchorMin,
                                  createSelection.currentMin,
                                ) -
                                  START_HOUR * 60,
                              )}px`,
                              height: `${Math.max(
                                30,
                                Math.abs(
                                  createSelection.currentMin -
                                    createSelection.anchorMin,
                                ) || 60,
                              )}px`,
                            }}
                            className="pointer-events-none absolute inset-x-1 z-20 rounded-xl border-2 border-[#0066CC] bg-[#0066CC]/15 px-1.5 py-1"
                          >
                            <span
                              dir="ltr"
                              className="font-mono-tabular text-[10px] font-bold text-[#0052A3]"
                            >
                              + {sc.daysShort[dow]}{" "}
                              {formatMinutesToHhMm(
                                Math.min(
                                  createSelection.anchorMin,
                                  createSelection.currentMin,
                                ),
                              )}
                            </span>
                          </div>
                        ) : null}

                        {/* Packed Proportional Shift Blocks */}
                        {packed.map((block) => {
                          const sched = block.item;
                          const canMutate = canMutateShift(sched);
                          const isBeingDragged = draggingShift?.id === sched.id;
                          const isBeingResized = resizingShift?.id === sched.id;
                          const effectiveEndMin = isBeingResized
                            ? resizingShift.previewEndMin
                            : block.endMin;

                          const topPx = Math.max(
                            0,
                            block.startMin - START_HOUR * 60,
                          );
                          const rawHeightPx = effectiveEndMin - block.startMin;
                          const heightPx = Math.max(88, rawHeightPx);
                          const colWidthPct = 100 / block.colCount;
                          const leftPct = block.colIndex * colWidthPct;

                          const displayEnd = isBeingResized
                            ? formatMinutesToHhMm(effectiveEndMin)
                            : sched.endTimeUtc;
                          const slotCount = estimateSlotCount(
                            sched.startTimeUtc,
                            displayEnd,
                            sched.slotDurationMinutes,
                          );

                          const cardStyle = !sched.isActive
                            ? "border-amber-300 bg-amber-50/95 border-s-4 border-s-amber-500"
                            : sched.visitMode === "TELEHEALTH"
                              ? "border-indigo-200 bg-indigo-50/95 border-s-4 border-s-indigo-600"
                              : sched.visitMode === "HOME_VISIT"
                                ? "border-[#B2E5DC] bg-[#E6F7F4]/95 border-s-4 border-s-[#0F9D88]"
                                : "border-[#BFDBFE] bg-[#EBF4FF]/95 border-s-4 border-s-[#0066CC]";

                          return (
                            <div
                              key={sched.id}
                              data-shift-card="true"
                              draggable={canMutate && !busy && !isBeingResized}
                              onDragStart={(e) => handleShiftDragStart(e, sched)}
                              onDragEnd={() => {
                                setDraggingShift(null);
                                setDropPreview(null);
                                colRectCacheRef.current.clear();
                              }}
                              onDoubleClick={() => {
                                if (canMutate && onUpdateSchedule) {
                                  openEditModal(sched);
                                }
                              }}
                              style={{
                                top: `${topPx + 2}px`,
                                height: `${heightPx - 4}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${colWidthPct}% - 4px)`,
                              }}
                              className={`group absolute z-10 flex flex-col justify-between overflow-hidden rounded-xl border p-1.5 text-[10px] shadow-xs transition-shadow hover:z-20 hover:shadow-md xl:p-2 xl:text-[10.5px] ${cardStyle} ${
                                isBeingDragged ? "opacity-45 ring-2 ring-[#0066CC]" : ""
                              } ${isBeingResized ? "z-30 ring-2 ring-[#0066CC] shadow-lg" : ""} ${
                                canMutate ? "cursor-grab active:cursor-grabbing" : ""
                              }`}
                            >
                              {/* Header: Crisp Un-Colliding Time Range + Status Dot/Pill */}
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="flex min-w-0 items-center gap-0.5 font-mono-tabular font-bold tracking-tight text-[#0F243E]">
                                    {canMutate ? (
                                      <GripVertical
                                        className="hidden h-3 w-3 shrink-0 text-[#6B829D] xl:inline"
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <span dir="ltr" className="truncate">
                                      {sched.startTimeUtc}–{displayEnd}
                                    </span>
                                  </span>
                                  {sched.isActive ? (
                                    <span
                                      title={activeStatusLabel}
                                      aria-label={activeStatusLabel}
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F9D88]"
                                    />
                                  ) : (
                                    <span className="shrink-0 rounded-full bg-amber-200/90 px-1 py-0.5 text-[8px] font-bold text-amber-950">
                                      {pausedStatusLabel}
                                    </span>
                                  )}
                                </div>

                                <p className="truncate font-semibold text-[#0F243E]">
                                  {sched.facilityName}
                                </p>
                                <p className="truncate text-[9.5px] text-[#4A627D]">
                                  {formatVisitMode(sched.visitMode, locale)} · {slotCount}s
                                </p>
                              </div>

                              {/* Quick Control Bar */}
                              {canMutate ? (
                                <div
                                  className="mt-1 flex flex-wrap items-center gap-1 pb-1"
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onToggleSchedule(sched)}
                                    className="inline-flex h-6 items-center justify-center gap-0.5 rounded-md border border-[#CBDDF0] bg-white/95 px-1.5 text-[10px] font-semibold text-[#2F4661] transition-colors hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95 disabled:opacity-50"
                                  >
                                    {sched.isActive ? (
                                      <>
                                        <Pause className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                        <span>{pauseBtnLabel}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                        <span>{resumeBtnLabel}</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onDeleteSchedule(sched)}
                                    aria-label={deleteBtnLabel}
                                    className="inline-flex h-6 items-center justify-center gap-0.5 rounded-md bg-white/95 px-1.5 text-[10px] font-semibold text-[#DC2626] ring-1 ring-rose-200 transition-colors hover:bg-rose-50 active:scale-95 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                    <span>{deleteBtnLabel}</span>
                                  </button>
                                  {onUpdateSchedule ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => openEditModal(sched)}
                                      title={sc.editShiftTitleBtn}
                                      aria-label={sc.editShiftTitleBtn}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#CBDDF0] bg-white/95 text-[#4A627D] transition-colors hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
                                    >
                                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                  {onDuplicateSchedule ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void onDuplicateSchedule(
                                          sched,
                                          (sched.dayOfWeek + 1) % 7,
                                        )
                                      }
                                      title={sc.copyNextDayTitle}
                                      aria-label={sc.copyNextDayTitle}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#CBDDF0] bg-white/95 text-[#4A627D] transition-colors hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
                                    >
                                      <Copy className="h-2.5 w-2.5" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {/* Generous Touch-Safe Bottom Drag-Resize Handle */}
                              {canMutate && onUpdateSchedule ? (
                                <div
                                  role="separator"
                                  aria-orientation="horizontal"
                                  title={sc.resizeTitle}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const startM = parseHhMmToMinutes(sched.startTimeUtc);
                                    const endM = parseHhMmToMinutes(sched.endTimeUtc);
                                    const minEndM = Math.min(
                                      END_HOUR * 60,
                                      startM + Math.max(30, sched.slotDurationMinutes),
                                    );
                                    resizeMetaRef.current = {
                                      id: sched.id,
                                      minEndMin: minEndM,
                                      originY: e.clientY,
                                      originEndMin: endM,
                                      latestEndMin: endM,
                                    };
                                    setResizingShift({
                                      id: sched.id,
                                      previewEndMin: endM,
                                    });
                                  }}
                                  className="touch-none absolute inset-x-1 -bottom-1 flex h-5 cursor-ns-resize items-end justify-center pb-1.5 opacity-60 transition-opacity hover:opacity-100"
                                >
                                  <span className="h-1 w-8 rounded-full bg-[#0066CC]/50" />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Responsive Touch-First List View (Default on Mobile <768px & Toggleable for Bulk Shifts) */
        <section className="rounded-2xl border border-[#D7E4F2] bg-white p-3.5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-5">
          {scopedSchedules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#CBDDF0] bg-[#F3F8FD] p-6 text-center text-xs text-[#4A627D]">
              {sc.emptyList}
            </p>
          ) : (
            <div className="max-h-[clamp(400px,calc(100dvh-300px),680px)] divide-y divide-[#E8F1FA] overflow-y-auto overscroll-y-contain">
              {scopedSchedules.map((sched) => {
                const canMutate = canMutateShift(sched);
                const slotCount = estimateSlotCount(
                  sched.startTimeUtc,
                  sched.endTimeUtc,
                  sched.slotDurationMinutes,
                );
                return (
                  <div
                    key={sched.id}
                    className="flex flex-col gap-3 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] font-bold text-[#0052A3]">
                        {sc.daysShort[sched.dayOfWeek]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            dir="ltr"
                            className="font-mono-tabular text-sm font-bold text-[#0F243E]"
                          >
                            {sched.startTimeUtc}–{sched.endTimeUtc}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                              sched.isActive
                                ? "bg-[#E6F7F4] text-[#0B6B5C]"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {sched.isActive ? activeStatusLabel : pausedStatusLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <EntityAvatar
                            name={sched.doctorName}
                            role="DOCTOR"
                            specialty={sched.specialty}
                            avatarUrl={sched.doctorAvatarUrl ?? null}
                            size="xs"
                          />
                          <p className="truncate font-semibold text-[#0F243E]">
                            {sched.facilityName}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#556E89]">
                          {formatVisitMode(sched.visitMode, locale)} · {slotCount} slots ·{" "}
                          {sched.slotDurationMinutes}m
                        </p>
                      </div>
                    </div>

                    {canMutate ? (
                      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                        {onUpdateSchedule ? (
                          <UiButton
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openEditModal(sched)}
                            aria-label={sc.editShiftTitleBtn}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sm:hidden">{sc.editShiftTitleBtn}</span>
                          </UiButton>
                        ) : null}
                        {onDuplicateSchedule ? (
                          <UiButton
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void onDuplicateSchedule(
                                sched,
                                (sched.dayOfWeek + 1) % 7,
                              )
                            }
                            aria-label={sc.copyNextDayTitle}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          </UiButton>
                        ) : null}
                        <UiButton
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onToggleSchedule(sched)}
                        >
                          {sched.isActive ? pauseBtnLabel : resumeBtnLabel}
                        </UiButton>
                        <UiButton
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => onDeleteSchedule(sched)}
                        >
                          {deleteBtnLabel}
                        </UiButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. Mobile Bottom Sheet / Desktop Modal: Create New Shift */}
      {composerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          className="ms-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0F243E]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setComposerOpen(false)}
        >
          <div
            className="ms-modal-in max-h-[88dvh] w-full max-w-2xl overflow-y-auto overscroll-y-contain rounded-t-2xl border border-[#D7E4F2] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E8F1FA] pb-4">
              <div>
                <h3 className="font-editorial text-lg font-bold text-[#0F243E]">
                  {heading}
                </h3>
                <p className="text-xs font-semibold text-[#0B6B5C]">
                  {sc.slotsPerDay(estimatedComposerSlots)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label={sc.cancelBtn}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] text-[#4A627D] transition-colors hover:bg-[#F3F8FD] active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                onSubmitPublish(e);
                setComposerOpen(false);
              }}
              className="mt-4 space-y-5"
            >
              <div
                className={`grid grid-cols-1 gap-3 ${
                  !isSelfPractitioner &&
                  doctorOptions &&
                  onDoctorChange &&
                  practitionerLabel
                    ? "sm:grid-cols-2"
                    : ""
                }`}
              >
                <EntityPicker
                  id="sched-facility-picker"
                  label={clinicLabel}
                  placeholder={clinicPlaceholder}
                  emptyLabel={clinicEmpty}
                  options={clinicOptions}
                  value={schedFacilityId}
                  onChange={onFacilityChange}
                  required
                />
                {!isSelfPractitioner &&
                doctorOptions &&
                onDoctorChange &&
                practitionerLabel ? (
                  <EntityPicker
                    id="sched-doctor-picker"
                    label={practitionerLabel}
                    placeholder={practitionerPlaceholder ?? "Search practitioner…"}
                    emptyLabel={practitionerEmpty ?? "No practitioners"}
                    options={doctorOptions}
                    value={schedDoctorId ?? ""}
                    onChange={onDoctorChange}
                    required
                  />
                ) : null}
              </div>

              {/* Day Pills + Mon-Fri Batch */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F243E]">
                    {sc.stepDays}
                  </span>
                  <label className="inline-flex min-h-[34px] cursor-pointer items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-1 text-xs font-semibold text-[#0052A3]">
                    <input
                      type="checkbox"
                      checked={publishWeekdays}
                      onChange={(e) => onPublishWeekdaysChange(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#0066CC]"
                    />
                    <span>{publishWeekdaysLabel}</span>
                  </label>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {sc.daysOrder.map((dow) => {
                    const active = publishWeekdays
                      ? dow >= 1 && dow <= 5
                      : schedDay === dow;
                    return (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => {
                          onPublishWeekdaysChange(false);
                          onDayChange(dow);
                        }}
                        className={`min-h-[42px] rounded-xl border text-xs font-bold transition-colors active:scale-95 ${
                          active
                            ? "border-[#0052A3] bg-[#0066CC] text-white"
                            : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC] hover:bg-[#EBF4FF]"
                        }`}
                      >
                        {sc.daysShort[dow]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visit Format */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-[#0F243E]">
                  {sc.stepMode}
                </span>
                <div
                  className={`grid gap-2 ${
                    allowedModes.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-3"
                  }`}
                >
                  {allowedModes.map((mode) => {
                    const selected = schedMode === mode;
                    const Icon =
                      mode === "TELEHEALTH"
                        ? Video
                        : mode === "HOME_VISIT"
                          ? Home
                          : Stethoscope;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onModeChange(mode)}
                        className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition-colors active:scale-[0.98] ${
                          selected
                            ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3] ring-2 ring-[#0066CC]/15"
                            : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#BFDBFE]"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{sc.modeTitles[mode]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours + Slot Duration */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-[#0F243E]">
                    {sc.stepHours}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_PRESETS.map((preset) => {
                      const active =
                        schedStart === preset.start && schedEnd === preset.end;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onStartChange(preset.start);
                            onEndChange(preset.end);
                          }}
                          className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                            active
                              ? "border-[#0066CC] bg-[#0066CC] text-white"
                              : "border-[#D7E4F2] bg-[#F8FBFE] text-[#2F4661] hover:border-[#0066CC]"
                          }`}
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span dir="ltr">{preset.range}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="time"
                      dir="ltr"
                      aria-label="Start UTC"
                      value={schedStart}
                      onChange={(e) => onStartChange(e.target.value)}
                      className="h-10 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 font-mono-tabular text-xs font-semibold text-[#0F243E]"
                    />
                    <input
                      type="time"
                      dir="ltr"
                      aria-label="End UTC"
                      value={schedEnd}
                      onChange={(e) => onEndChange(e.target.value)}
                      className="h-10 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 font-mono-tabular text-xs font-semibold text-[#0F243E]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-bold text-[#0F243E]">
                    {sc.stepDuration}
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {DURATION_OPTIONS.map((mins) => {
                      const selected = schedDuration === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => onDurationChange(mins)}
                          className={`min-h-[42px] rounded-xl border font-mono-tabular text-xs font-bold transition-colors active:scale-95 ${
                            selected
                              ? "border-[#0052A3] bg-[#0066CC] text-white"
                              : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC]"
                          }`}
                        >
                          {mins}m
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E8F1FA] pt-4">
                <UiButton
                  type="button"
                  variant="outline"
                  onClick={() => setComposerOpen(false)}
                >
                  {sc.cancelBtn}
                </UiButton>
                <UiButton
                  type="submit"
                  variant="primary"
                  disabled={busy || !canManageSchedule || isPendingStaff}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{publishBtnLabel}</span>
                </UiButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* 4. Mobile Bottom Sheet / Desktop Modal: Edit Existing Shift */}
      {editingShift && onUpdateSchedule ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sc.editShiftTitle}
          className="ms-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0F243E]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setEditingShift(null)}
        >
          <div
            className="ms-modal-in max-h-[88dvh] w-full max-w-xl overflow-y-auto overscroll-y-contain rounded-t-2xl border border-[#D7E4F2] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E8F1FA] pb-4">
              <h3 className="font-editorial text-lg font-bold text-[#0F243E]">
                {sc.editShiftTitle}
              </h3>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                aria-label={sc.cancelBtn}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7E4F2] text-[#4A627D] transition-colors hover:bg-[#F3F8FD] active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveEditShift(e)}
              className="mt-4 space-y-4"
            >
              <EntityPicker
                id="edit-shift-facility"
                label={clinicLabel}
                placeholder={clinicPlaceholder}
                emptyLabel={clinicEmpty}
                options={clinicOptions}
                value={editingShift.facilityId}
                onChange={(val) =>
                  setEditingShift((prev) =>
                    prev ? { ...prev, facilityId: val } : null,
                  )
                }
                required
              />

              <div className="grid grid-cols-7 gap-1.5">
                {sc.daysOrder.map((dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() =>
                      setEditingShift((prev) =>
                        prev ? { ...prev, dayOfWeek: dow } : null,
                      )
                    }
                    className={`min-h-[42px] rounded-xl border text-xs font-bold transition-colors active:scale-95 ${
                      editingShift.dayOfWeek === dow
                        ? "border-[#0052A3] bg-[#0066CC] text-white"
                        : "border-[#D7E4F2] bg-white text-[#2F4661]"
                    }`}
                  >
                    {sc.daysShort[dow]}
                  </button>
                ))}
              </div>

              <div
                className={`grid gap-2 ${
                  allowedModes.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-3"
                }`}
              >
                {allowedModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setEditingShift((prev) =>
                        prev ? { ...prev, visitMode: mode } : null,
                      )
                    }
                    className={`min-h-[42px] rounded-xl border text-xs font-bold transition-colors active:scale-[0.98] ${
                      editingShift.visitMode === mode
                        ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                        : "border-[#D7E4F2] bg-white text-[#4A627D]"
                    }`}
                  >
                    {sc.modeTitles[mode]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="time"
                  dir="ltr"
                  value={editingShift.startTimeUtc}
                  onChange={(e) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, startTimeUtc: e.target.value } : null,
                    )
                  }
                  className="h-10 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 font-mono-tabular text-xs font-semibold text-[#0F243E]"
                />
                <input
                  type="time"
                  dir="ltr"
                  value={editingShift.endTimeUtc}
                  onChange={(e) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, endTimeUtc: e.target.value } : null,
                    )
                  }
                  className="h-10 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3 font-mono-tabular text-xs font-semibold text-[#0F243E]"
                />
                <div className="flex items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-1">
                  {DURATION_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setEditingShift((prev) =>
                          prev ? { ...prev, slotDurationMinutes: m } : null,
                        )
                      }
                      className={`h-8 flex-1 rounded-lg font-mono-tabular text-xs font-bold transition ${
                        editingShift.slotDurationMinutes === m
                          ? "bg-[#0066CC] text-white shadow-2xs"
                          : "text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-xs font-semibold text-[#0F243E]">
                <input
                  type="checkbox"
                  checked={editingShift.isActive}
                  onChange={(e) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, isActive: e.target.checked } : null,
                    )
                  }
                  className="h-4 w-4 rounded accent-[#0066CC]"
                />
                <span>
                  {editingShift.isActive ? activeStatusLabel : pausedStatusLabel}
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-[#E8F1FA] pt-4">
                <UiButton
                  type="button"
                  variant="outline"
                  onClick={() => setEditingShift(null)}
                >
                  {sc.cancelBtn}
                </UiButton>
                <UiButton type="submit" variant="primary" disabled={busy}>
                  {sc.saveChangesBtn}
                </UiButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
