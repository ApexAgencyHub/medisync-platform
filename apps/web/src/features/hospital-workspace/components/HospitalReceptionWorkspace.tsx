"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  DispatchStreamEventSchema,
  type AppointmentStatus,
  type AppointmentSummary,
  type AuthenticatedUser,
  type CountryPack,
  type DispatchRequestSummary,
  type DispatchStatus,
  type DispatchUrgency,
  type FacilityOpenStatus,
  type ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Activity,
  Ambulance,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  GripVertical,
  Kanban,
  List,
  Map as MapIcon,
  Phone,
  Search,
  ShieldCheck,
  Siren,
  UserCheck,
  XCircle,
} from "lucide-react";
import { listFacilities } from "@/features/auth-portal";
import {
  fetchAppointments,
  transitionAppointmentStatus,
} from "@/features/booking";
import {
  DynamicViewportVectorMap,
  createDispatchRequest,
  getPresetForCountry,
  listDispatchRequests,
  panViewport,
  queryViewportFacilities,
  updateDispatchStatus,
  updateFacilityOperationalStatus,
  zoomViewport,
  type ClientDispatchPin,
  type ViewportBox,
} from "@/features/maps-dispatch";
import { HospitalBillingPanel } from "./HospitalBillingPanel";
import {
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import { syncPendingSessionStatus } from "@/shared/auth/role-capabilities";
import { WorkspaceRoleGuard } from "@/shared/auth/WorkspaceRoleGuard";
import { checkBackendOnline } from "@/shared/api/directory-client";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import {
  formatCountryDisplayName,
  formatDispatchStatus,
  formatFacilityKind,
  formatOpenStatus,
  formatUrgencyLabel,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { useLocale } from "@/shared/i18n/locale-store";
import { HOSPITAL_COPY } from "../hospital-i18n";
import {
  formatPractitionerDisplayName,
  StatStrip,
  UiBadge,
  UiButton,
  WorkspaceHeader,
  type UiBadgeTone,
  useToastSetter,
} from "@/shared/ui/primitives";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";

interface HospitalReceptionWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const APPT_STATUS_TONE: Record<AppointmentStatus, UiBadgeTone> = {
  CONFIRMED: "teal",
  CHECKED_IN: "emerald",
  COMPLETED: "slate",
  CANCELLED: "red",
  NO_SHOW: "amber",
};

const DISPATCH_STATUS_TONE: Record<DispatchStatus, UiBadgeTone> = {
  REQUESTED: "amber",
  ASSIGNED: "teal",
  EN_ROUTE: "teal",
  ARRIVED: "emerald",
  COMPLETED: "slate",
  CANCELLED: "red",
};

const TRANSFER_REASON_CHIPS_BY_LOCALE = {
  en: [
    "SAMU 141 Trauma Transfer",
    "ICU Bed Transfer",
    "Cardiac Cath Lab",
    "Wheelchair Transfer",
  ],
  fr: [
    "Transfert Urgence SAMU 141",
    "Transfert Réanimation",
    "Cardiologie Interventionnelle",
    "Transport Fauteuil",
  ],
  ar: [
    "نقل طارئ SAMU 141",
    "نقل للعناية المركزة",
    "قسطرة القلب",
    "نقل بكرسي متحرك",
  ],
} as const;

type ReceptionKanbanLane = "CONFIRMED" | "CHECKED_IN" | "COMPLETED";

function canAccessHospitalDesk(role: AuthenticatedUser["role"] | undefined): boolean {
  return role === "HOSPITAL_ADMIN" || role === "CLINIC_STAFF";
}

export function HospitalReceptionWorkspace({
  packs,
  apiBaseUrl,
}: HospitalReceptionWorkspaceProps) {
  const { locale, t, isRtl } = useLocale();
  const h = HOSPITAL_COPY[locale];
  const m = h.messages;
  const activePack = resolveActivePack(packs) ?? packs[0];
  const selectedCountry = activePack?.code ?? ACTIVE_COUNTRY_CODE;
  const countryDisplayName = formatCountryDisplayName(
    selectedCountry,
    activePack?.name ?? selectedCountry,
    locale,
  );

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const isPendingStaff = isPendingStaffVerification(currentUser);
  const hasDeskRole = canAccessHospitalDesk(currentUser?.role);

  const [apiOnline, setApiOnline] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);

  const [viewport, setViewport] = useState<ViewportBox>(() =>
    getPresetForCountry(selectedCountry),
  );
  const [postgisMs, setPostgisMs] = useState<number | null>(null);
  const [showLiveMap, setShowLiveMap] = useState(false);

  const [facilities, setFacilities] = useState<ViewportFacilityItem[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);

  const [apptFilter, setApptFilter] = useState<"ALL" | AppointmentStatus>("ALL");
  const [apptViewMode, setApptViewMode] = useState<"board" | "list">("board");
  const [apptSearch, setApptSearch] = useState("");
  const [draggingApptId, setDraggingApptId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<ReceptionKanbanLane | null>(
    null,
  );
  const [showAllFacilityAppointments, setShowAllFacilityAppointments] =
    useState(false);
  const [transferUrgency, setTransferUrgency] =
    useState<DispatchUrgency>("EMERGENCY");
  const [transferNotes, setTransferNotes] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setApptViewMode("list");
    }
  }, []);

  const setBanner = useToastSetter();

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      if (stored.user.facilityId) {
        setSelectedFacilityId(stored.user.facilityId);
      }
    }
    setSessionHydrated(true);

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (cancelled) return;
      setApiOnline(online);
      if (online && stored) {
        void syncPendingSessionStatus(apiBaseUrl, stored, { force: true }).then(
          (syncRes) => {
            if (cancelled) return;
            if (syncRes.status === "updated" && syncRes.session) {
              setCurrentUser(syncRes.session.user);
              if (syncRes.session.user.facilityId) {
                setSelectedFacilityId((prev) => prev || syncRes.session!.user.facilityId!);
              }
            } else if (syncRes.status === "expired") {
              setSessionToken(null);
              setCurrentUser(null);
            }
          },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const refreshViewportFacilities = useCallback(
    async (box: ViewportBox) => {
      const vpRes = await queryViewportFacilities(
        apiBaseUrl,
        selectedCountry,
        box,
        {},
      );
      if (vpRes.ok) {
        setPostgisMs(vpRes.data.queryMs);
        setFacilities((prev) => {
          const map = new Map<string, ViewportFacilityItem>(
            prev.map((item) => [item.id, item]),
          );
          for (const fac of vpRes.data.facilities) {
            map.set(fac.id, fac);
          }
          return [...map.values()];
        });
      }
    },
    [apiBaseUrl, selectedCountry],
  );

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const refreshHospitalDesk = useCallback(
    async (
      token: string,
      user: AuthenticatedUser | null,
    ) => {
      if (isPendingStaffVerification(user) || !canAccessHospitalDesk(user?.role)) {
        return;
      }
      const [facListRes, vpRes, apptsRes, dispatchRes] = await Promise.all([
        listFacilities(apiBaseUrl, token, selectedCountry),
        queryViewportFacilities(apiBaseUrl, selectedCountry, viewportRef.current, {}),
        fetchAppointments(apiBaseUrl, token, selectedCountry),
        listDispatchRequests(apiBaseUrl, token, selectedCountry),
      ]);

      const merged = new Map<string, ViewportFacilityItem>();
      if (facListRes.ok) {
        for (const fac of facListRes.data.facilities) {
          merged.set(fac.id, {
            ...fac,
            openStatus: "OPEN",
            is24_7: false,
            acceptsEmergency: fac.kind === "HOSPITAL",
            specialties: [],
            phone: null,
            distanceMeters: null,
          });
        }
      }
      if (vpRes.ok) {
        setPostgisMs(vpRes.data.queryMs);
        for (const fac of vpRes.data.facilities) {
          merged.set(fac.id, fac);
        }
      }
      const allMerged = [...merged.values()];
      setFacilities(allMerged);
      setSelectedFacilityId((prev) => {
        if (prev && merged.has(prev)) return prev;
        if (user?.facilityId && merged.has(user.facilityId)) {
          return user.facilityId;
        }
        const preferred =
          allMerged.find((f) => f.kind === "HOSPITAL" || f.kind === "CLINIC") ??
          allMerged[0];
        return preferred?.id ?? "";
      });

      if (apptsRes.ok) {
        setAppointments(apptsRes.data.appointments);
      }
      if (dispatchRes.ok) {
        setDispatches(dispatchRes.data.dispatches);
      }
    },
    [apiBaseUrl, selectedCountry],
  );

  useEffect(() => {
    if (!apiOnline || !sessionHydrated) return;
    if (currentUser && (!hasDeskRole || isPendingStaff)) {
      return;
    }
    if (sessionToken && currentUser && hasDeskRole && !isPendingStaff) {
      void refreshHospitalDesk(sessionToken, currentUser);
      return;
    }
    void refreshViewportFacilities(viewportRef.current);
  }, [
    apiOnline,
    currentUser,
    hasDeskRole,
    isPendingStaff,
    refreshHospitalDesk,
    refreshViewportFacilities,
    sessionHydrated,
    sessionToken,
  ]);

  // Real-time SSE updates for incoming ambulance arrivals
  useEffect(() => {
    if (
      !apiOnline ||
      !sessionToken ||
      !hasDeskRole ||
      isPendingStaff ||
      typeof EventSource === "undefined"
    ) {
      setStreamConnected(false);
      return;
    }

    const streamUrl = `${apiBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(
      sessionToken,
    )}`;
    const es = new EventSource(streamUrl);
    let active = true;
    let hasConnectedOnce = false;

    const handleDispatchUpdated = (event: MessageEvent<string>) => {
      try {
        const parsed = DispatchStreamEventSchema.safeParse(
          JSON.parse(event.data),
        );
        if (!parsed.success || parsed.data.type !== "dispatch.updated") return;
        const incoming = parsed.data.dispatch;
        setDispatches((prev) => {
          const exists = prev.some((d) => d.id === incoming.id);
          if (!exists) return [incoming, ...prev];
          return prev.map((d) => (d.id === incoming.id ? incoming : d));
        });
      } catch {
        // Ignore malformed SSE payload
      }
    };

    es.addEventListener("snapshot", () => {
      setStreamConnected(true);
      if (hasConnectedOnce) {
        void listDispatchRequests(apiBaseUrl, sessionToken, selectedCountry).then(
          (res) => {
            if (active && res.ok) {
              setDispatches(res.data.dispatches);
            }
          },
        );
      }
      hasConnectedOnce = true;
    });
    es.addEventListener("dispatch.updated", handleDispatchUpdated as EventListener);
    es.onerror = () => setStreamConnected(false);

    return () => {
      active = false;
      es.close();
      setStreamConnected(false);
    };
  }, [apiBaseUrl, apiOnline, hasDeskRole, isPendingStaff, selectedCountry, sessionToken]);

  const hospitalFacilities = useMemo(() => {
    const primary = facilities.filter(
      (f) => f.kind === "HOSPITAL" || f.kind === "CLINIC" || f.id === selectedFacilityId,
    );
    return primary.length > 0 ? primary : facilities;
  }, [facilities, selectedFacilityId]);

  const selectedFacility = useMemo(
    () =>
      facilities.find((f) => f.id === selectedFacilityId) ??
      hospitalFacilities[0] ??
      null,
    [facilities, hospitalFacilities, selectedFacilityId],
  );

  const facilityDeskAppointments = useMemo(
    () => appointments.filter((a) => a.visitMode !== "HOME_VISIT"),
    [appointments],
  );

  const visibleAppointments = useMemo(() => {
    const scoped =
      !showAllFacilityAppointments && selectedFacility
        ? facilityDeskAppointments.filter((a) => a.facilityId === selectedFacility.id)
        : facilityDeskAppointments;
    const finalSet =
      scoped.length > 0 || showAllFacilityAppointments
        ? scoped
        : facilityDeskAppointments;
    const q = apptSearch.trim().toLowerCase();
    return finalSet.filter((a) => {
      if (apptFilter !== "ALL" && a.status !== apptFilter) return false;
      if (q) {
        const hay =
          `${a.patientName} ${a.doctorName} ${a.specialty} ${a.facilityName} ${a.reason ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    facilityDeskAppointments,
    apptFilter,
    apptSearch,
    selectedFacility,
    showAllFacilityAppointments,
  ]);

  const sortedDispatches = useMemo(() => {
    return [...dispatches].sort((a, b) => {
      const aMatch = selectedFacility && a.targetFacilityId === selectedFacility.id ? 1 : 0;
      const bMatch = selectedFacility && b.targetFacilityId === selectedFacility.id ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.createdAtIso.localeCompare(a.createdAtIso);
    });
  }, [dispatches, selectedFacility]);

  const mapClientPins = useMemo<ClientDispatchPin[]>(
    () =>
      sortedDispatches
        .filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED")
        .map((d) => ({
          id: d.id,
          pickupLat: d.pickupLat,
          pickupLng: d.pickupLng,
          pickupAddress: d.pickupAddress,
          urgency: d.urgency,
          status: d.status,
          targetFacilityId: d.targetFacilityId,
          driverUserId: d.driverUserId,
        })),
    [sortedDispatches],
  );

  const deskMetrics = useMemo(() => {
    const base =
      selectedFacility && !showAllFacilityAppointments
        ? facilityDeskAppointments.filter((a) => a.facilityId === selectedFacility.id)
        : facilityDeskAppointments;
    const confirmed = base.filter((a) => a.status === "CONFIRMED").length;
    const checkedIn = base.filter((a) => a.status === "CHECKED_IN").length;
    const activeIncoming = sortedDispatches.filter(
      (d) =>
        (d.targetFacilityId === selectedFacility?.id || !d.targetFacilityId) &&
        d.status !== "COMPLETED" &&
        d.status !== "CANCELLED",
    ).length;
    return { confirmed, checkedIn, activeIncoming };
  }, [
    facilityDeskAppointments,
    selectedFacility,
    showAllFacilityAppointments,
    sortedDispatches,
  ]);

  async function handleUpdateFacilityStatus(nextPatch: {
    openStatus?: FacilityOpenStatus;
    is24_7?: boolean;
    acceptsEmergency?: boolean;
  }) {
    if (
      !sessionToken ||
      !selectedFacility ||
      isPendingStaff ||
      !hasDeskRole ||
      actionLockRef.current
    ) {
      return;
    }
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await updateFacilityOperationalStatus(
        apiBaseUrl,
        sessionToken,
        selectedFacility.id,
        {
          openStatus: nextPatch.openStatus ?? selectedFacility.openStatus,
          is24_7: nextPatch.is24_7 ?? selectedFacility.is24_7,
          acceptsEmergency:
            nextPatch.acceptsEmergency ?? selectedFacility.acceptsEmergency,
        },
      );
      if (!res.ok) {
        setBanner({
          tone: "error",
          text: m.facilityReadinessFailed(res.error),
        });
        return;
      }
      setFacilities((prev) =>
        prev.map((item) =>
          item.id === res.data.facility.id ? res.data.facility : item,
        ),
      );
      setBanner({
        tone: "success",
        text: m.facilityUpdated(
          res.data.facility.name,
          formatOpenStatus(res.data.facility.openStatus, locale),
          res.data.facility.acceptsEmergency
            ? h.readiness.erActiveToast
            : h.readiness.routineOnlyToast,
        ),
      });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleTransitionAppointment(
    appointmentId: string,
    status: "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED",
  ) {
    if (!sessionToken || isPendingStaff || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await transitionAppointmentStatus(
        apiBaseUrl,
        sessionToken,
        appointmentId,
        { status },
      );
      if (!res.ok) {
        setBanner({
          tone: "error",
          text:
            res.status === 409
              ? m.conflictApptRefreshed
              : m.receptionUpdateFailed(res.error),
        });
        if (res.status === 409) {
          await refreshHospitalDesk(sessionToken, currentUser);
        }
      } else {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? res.data.appointment : a)),
        );
        setBanner({
          tone: "success",
          text: m.patientMarked(
            res.data.appointment.patientName,
            h.enums.appointmentStatus[res.data.appointment.status] ??
              res.data.appointment.status,
          ),
        });
      }
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  function handleKanbanDrop(targetLane: ReceptionKanbanLane) {
    const draggedId = draggingApptId;
    setDraggingApptId(null);
    setDragOverLane(null);
    if (!draggedId || busy || isPendingStaff || !hasDeskRole) return;
    const item = appointments.find((a) => a.id === draggedId);
    if (!item || item.status === targetLane) return;
    if (item.status === "CONFIRMED" && targetLane === "CHECKED_IN") {
      void handleTransitionAppointment(item.id, "CHECKED_IN");
    } else if (item.status === "CHECKED_IN" && targetLane === "COMPLETED") {
      void handleTransitionAppointment(item.id, "COMPLETED");
    }
  }

  async function handleRequestTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !sessionToken ||
      !selectedFacility ||
      isPendingStaff ||
      actionLockRef.current
    ) {
      return;
    }
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await createDispatchRequest(apiBaseUrl, sessionToken, {
        pickupLat: selectedFacility.lat,
        pickupLng: selectedFacility.lng,
        pickupAddress: `${selectedFacility.name} · ${h.ems.intakeBaySuffix}`,
        targetFacilityId: selectedFacility.id,
        urgency: transferUrgency,
        notes: transferNotes.trim() || h.ems.defaultTransferNote,
      });
      if (!res.ok) {
        setBanner({
          tone: "error",
          text: m.transferFailed(res.error),
        });
        return;
      }
      setDispatches((prev) => [res.data.dispatch, ...prev]);
      setBanner({
        tone: "success",
        text: m.transferBroadcast(countryDisplayName, selectedFacility.name),
      });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleDispatchTransition(
    dispatchId: string,
    nextStatus: DispatchStatus,
  ) {
    if (!sessionToken || isPendingStaff || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await updateDispatchStatus(
        apiBaseUrl,
        sessionToken,
        dispatchId,
        nextStatus,
      );
      if (!res.ok) {
        setBanner({
          tone: "error",
          text:
            res.status === 409
              ? m.conflictDispatchSync
              : m.transferUpdateFailed(res.error),
        });
        if (res.status === 409) {
          await refreshHospitalDesk(sessionToken, currentUser);
        }
      } else {
        setDispatches((prev) =>
          prev.map((d) => (d.id === dispatchId ? res.data.dispatch : d)),
        );
        setBanner({
          tone: "success",
          text: m.transferUpdated(
            formatDispatchStatus(res.data.dispatch.status, locale),
          ),
        });
      }
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={t("hospital.heading")}
        countryCode={selectedCountry}
        countryName={countryDisplayName}
        currencyCode={activePack?.currencyCode ?? selectedCountry}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        extraMeta={
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              streamConnected ? "text-[#0066CC]" : "text-slate-600"
            }`}
          >
            <Activity className="h-3 w-3" aria-hidden="true" />
            <span>{streamConnected ? h.header.liveStream : h.header.onDemandSync}</span>
          </span>
        }
        user={currentUser}
        guestLabel={h.header.guestLabel}
        onSignOut={() => {
          revokeClientSession(apiBaseUrl);
          setSessionToken(null);
          setCurrentUser(null);
          setAppointments([]);
          setDispatches([]);
        }}
        actions={
          currentUser && sessionToken && hasDeskRole && !isPendingStaff ? (
            <div className="flex items-center gap-2">
              <UiButton
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void refreshHospitalDesk(sessionToken, currentUser)}
              >
                {h.header.syncBtn}
              </UiButton>
              <Link
                href="/profile"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] px-3 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{t("nav.profile")}</span>
              </Link>
            </div>
          ) : undefined
        }
      />

      <VerificationGateNotice user={currentUser} compact />

      <WorkspaceRoleGuard
        user={currentUser}
        hydrated={sessionHydrated}
        allowedRoles={["HOSPITAL_ADMIN", "CLINIC_STAFF"]}
        workspaceTitle={h.header.guardTitle}
        requiredRoleDescription={h.header.guardRoles}
      >
      <div className="space-y-4">
      <StatStrip
        columns={4}
        ariaLabel={h.sidebar.liveQueueTitle}
        items={[
          {
            label: h.sidebar.confirmedWaiting,
            value: String(deskMetrics.confirmed),
            tone: "neutral",
          },
          {
            label: h.sidebar.checkedIn,
            value: String(deskMetrics.checkedIn),
            tone: "emerald",
          },
          {
            label: h.sidebar.activeTransfers,
            value: String(deskMetrics.activeIncoming),
            tone: "crimson",
          },
          {
            label: h.sidebar.countryFacilities(countryDisplayName),
            value: String(hospitalFacilities.length),
            tone: "neutral",
          },
        ]}
      />

      <div className="space-y-4">
          {/* 1. Facility Operational Readiness */}
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E4F2] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#0F243E]">
                  {h.readiness.title}
                </h2>
                <MoroccanComplianceBadge domain="hospital" locale={locale} />
              </div>
              {selectedFacility ? (
                <UiBadge
                  tone={
                    selectedFacility.openStatus === "OPEN"
                      ? "emerald"
                      : selectedFacility.openStatus === "BUSY"
                        ? "amber"
                        : "red"
                  }
                >
                  {formatOpenStatus(selectedFacility.openStatus, locale)}
                </UiBadge>
              ) : null}
            </div>

            {hospitalFacilities.length > 0 && selectedFacility ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <EntityPicker
                    id="hospital-facility-select"
                    label={h.readiness.assignedLabel}
                    placeholder={h.readiness.assignedLabel}
                    emptyLabel={h.readiness.noFacilities}
                    value={selectedFacility.id}
                    onChange={setSelectedFacilityId}
                    options={hospitalFacilities.map((fac) => ({
                      id: fac.id,
                      label: fac.name,
                      sublabel: formatFacilityKind(fac.kind, locale),
                    }))}
                  />

                  <div className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-4 py-3 text-xs">
                    <p className="font-semibold text-[#0F243E]">
                      {selectedFacility.name}
                    </p>
                    <p className="mt-0.5 font-mono-tabular text-slate-600">
                      {formatFacilityKind(selectedFacility.kind, locale)} ·{" "}
                      {h.readiness.licensePrefix} <span dir="ltr">{selectedFacility.licenseNumber}</span> ·{" "}
                      {h.enums.verificationStatus[selectedFacility.verificationStatus] ??
                        selectedFacility.verificationStatus}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(["OPEN", "BUSY", "CLOSED"] as const).map((statusOption) => {
                    const active = selectedFacility.openStatus === statusOption;
                    return (
                      <button
                        key={statusOption}
                        type="button"
                        disabled={busy || !hasDeskRole || isPendingStaff}
                        onClick={() =>
                          void handleUpdateFacilityStatus({
                            openStatus: statusOption,
                          })
                        }
                        className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                          active
                            ? statusOption === "OPEN"
                              ? "border-[#0052A3] bg-[#0066CC] text-white"
                              : statusOption === "BUSY"
                                ? "border-amber-700 bg-amber-600 text-white"
                                : "border-rose-800 bg-rose-700 text-white"
                            : "border-[#CBDDF0] bg-[#F3F8FD] text-slate-700 hover:bg-white hover:text-[#0066CC]"
                        }`}
                      >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {h.readiness.setStatusPrefix}{" "}
                          {formatOpenStatus(statusOption, locale)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy || !hasDeskRole || isPendingStaff}
                    onClick={() =>
                      void handleUpdateFacilityStatus({
                        is24_7: !selectedFacility.is24_7,
                      })
                    }
                    className={`flex min-h-[42px] items-center justify-between rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      selectedFacility.is24_7
                        ? "border-emerald-300 bg-emerald-50/90 text-emerald-950"
                        : "border-[#CBDDF0] bg-[#F3F8FD] text-slate-700 hover:bg-white"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      {h.readiness.continuous247}
                    </span>
                    <span className="font-mono-tabular font-bold">
                      {selectedFacility.is24_7
                        ? h.readiness.activeState
                        : h.readiness.offState}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={busy || !hasDeskRole || isPendingStaff}
                    onClick={() =>
                      void handleUpdateFacilityStatus({
                        acceptsEmergency: !selectedFacility.acceptsEmergency,
                      })
                    }
                    className={`flex min-h-[42px] items-center justify-between rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      selectedFacility.acceptsEmergency
                        ? "border-rose-300 bg-rose-50/90 text-rose-950"
                        : "border-[#CBDDF0] bg-[#F3F8FD] text-slate-700 hover:bg-rose-50/50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Siren className="h-4 w-4" aria-hidden="true" />
                      {h.readiness.erIntakeBay}
                    </span>
                    <span className="font-mono-tabular font-bold">
                      {selectedFacility.acceptsEmergency
                        ? h.readiness.acceptingState
                        : h.readiness.pausedState}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                {h.readiness.noFacilities}
              </p>
            )}
          </section>

          {/* 2. Reception Patient Flow Kanban & Queue */}
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F1FA] pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                <h2 className="font-editorial text-sm font-bold text-[#0F243E]">
                  {h.queue.title(visibleAppointments.length)}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-8 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-2.5 focus-within:border-[#0066CC] focus-within:bg-white">
                  <Search className="h-3.5 w-3.5 text-[#556E89]" aria-hidden="true" />
                  <input
                    type="search"
                    value={apptSearch}
                    onChange={(e) => setApptSearch(e.target.value)}
                    placeholder={
                      locale === "fr"
                        ? "Rechercher patient, médecin, motif…"
                        : locale === "ar"
                          ? "ابحث عن مريض، طبيب، سبب…"
                          : "Search patient, doctor, reason..."
                    }
                    aria-label="Search reception queue"
                    className="w-36 bg-transparent text-xs text-[#0F243E] placeholder:text-[#7D95B0] focus:outline-none sm:w-48"
                  />
                </div>

                <div
                  role="group"
                  aria-label="Queue layout switcher"
                  className="inline-flex rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setApptViewMode("board");
                      setApptFilter("ALL");
                    }}
                    className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition ${
                      apptViewMode === "board"
                        ? "bg-[#0066CC] text-white shadow-2xs"
                        : "text-[#4A627D] hover:text-[#0F243E]"
                    }`}
                  >
                    <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {locale === "fr" ? "Tableau" : locale === "ar" ? "لوحة" : "Board"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApptViewMode("list")}
                    className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition ${
                      apptViewMode === "list"
                        ? "bg-[#0066CC] text-white shadow-2xs"
                        : "text-[#4A627D] hover:text-[#0F243E]"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {locale === "fr" ? "Liste" : locale === "ar" ? "قائمة" : "List"}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllFacilityAppointments((prev) => !prev)}
                  className="min-h-[32px] rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] px-3 py-1 text-xs font-semibold text-[#0F243E] hover:bg-white"
                >
                  {showAllFacilityAppointments
                    ? h.queue.showSelectedOnly
                    : h.queue.includeNetwork}
                </button>
              </div>
            </div>

            {apptViewMode === "list" ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  ["ALL", "CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] as const
                ).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setApptFilter(statusKey)}
                    className={`min-h-[32px] rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      apptFilter === statusKey
                        ? "border-[#0052A3] bg-[#0066CC] text-white"
                        : "border-[#CBDDF0] bg-[#F3F8FD] text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                    }`}
                  >
                    {statusKey === "ALL"
                      ? h.queue.allVisitsFilter
                      : locale === "en"
                        ? statusKey.replace("_", " ")
                        : h.enums.appointmentStatus[statusKey] ?? statusKey}
                  </button>
                ))}
              </div>
            ) : null}

            {visibleAppointments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-4 text-xs text-slate-600">
                {h.queue.emptyPrefix}
              </p>
            ) : apptViewMode === "board" ? (
              <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-3">
                {(
                  [
                    {
                      lane: "CONFIRMED" as const,
                      title:
                        locale === "en"
                          ? "Confirmed"
                          : h.enums.appointmentStatus.CONFIRMED ?? "Confirmed",
                      accent: "border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3]",
                      items: visibleAppointments.filter(
                        (a) => a.status === "CONFIRMED",
                      ),
                    },
                    {
                      lane: "CHECKED_IN" as const,
                      title:
                        locale === "en"
                          ? "Checked In"
                          : h.enums.appointmentStatus.CHECKED_IN ?? "Checked In",
                      accent: "border-[#B2E5DC] bg-[#E6F7F4] text-[#0A6E5E]",
                      items: visibleAppointments.filter(
                        (a) => a.status === "CHECKED_IN",
                      ),
                    },
                    {
                      lane: "COMPLETED" as const,
                      title:
                        locale === "en"
                          ? "Completed"
                          : h.enums.appointmentStatus.COMPLETED ?? "Completed",
                      accent: "border-[#CBDDF0] bg-[#F3F8FD] text-[#2F4661]",
                      items: visibleAppointments.filter(
                        (a) =>
                          a.status === "COMPLETED" ||
                          a.status === "NO_SHOW" ||
                          a.status === "CANCELLED",
                      ),
                    },
                  ] as const
                ).map((col) => {
                  const isOver = dragOverLane === col.lane;
                  return (
                    <div
                      key={col.lane}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverLane !== col.lane) setDragOverLane(col.lane);
                      }}
                      onDragLeave={() => {
                        if (dragOverLane === col.lane) setDragOverLane(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleKanbanDrop(col.lane);
                      }}
                      className={`flex min-h-[220px] flex-col rounded-2xl border p-3 transition ${
                        isOver
                          ? "border-[#0066CC] bg-[#EBF4FF]/70 ring-2 ring-[#0066CC]/25"
                          : "border-[#D7E4F2] bg-[#F8FBFE]"
                      }`}
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${col.accent}`}
                        >
                          {col.title}
                        </span>
                        <span className="font-mono-tabular text-xs font-bold text-[#556E89]">
                          {col.items.length}
                        </span>
                      </div>

                      <div className="max-h-[420px] flex-1 space-y-2.5 overflow-y-auto pe-0.5 [scrollbar-width:thin]">
                        {col.items.length === 0 ? (
                          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#CBDDF0] text-[11px] text-[#7D95B0]">
                            —
                          </div>
                        ) : (
                          col.items.map((appt) => {
                            const canDrag =
                              (appt.status === "CONFIRMED" ||
                                appt.status === "CHECKED_IN") &&
                              hasDeskRole &&
                              !isPendingStaff;
                            return (
                              <article
                                key={appt.id}
                                draggable={canDrag}
                                onDragStart={() => setDraggingApptId(appt.id)}
                                onDragEnd={() => {
                                  setDraggingApptId(null);
                                  setDragOverLane(null);
                                }}
                                className={`space-y-2 rounded-xl border bg-white p-3 text-xs shadow-2xs transition ${
                                  draggingApptId === appt.id
                                    ? "opacity-55 border-[#0066CC]"
                                    : "border-[#D7E4F2] hover:border-[#93C5FD]"
                                } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    {canDrag ? (
                                      <GripVertical
                                        className="h-3.5 w-3.5 shrink-0 text-[#9CB4CE]"
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <span className="truncate font-bold text-[#0F243E]">
                                      <bdi dir="auto">{appt.patientName}</bdi>
                                    </span>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-[#F3F8FD] px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-[#4A627D]">
                                    {formatVisitMode(appt.visitMode, locale)}
                                  </span>
                                </div>

                                <p className="truncate text-[11px] text-[#4A627D]">
                                  {formatPractitionerDisplayName(
                                    appt.doctorName,
                                    appt.specialty,
                                  )}{" "}
                                  · {formatSpecialtyLabel(appt.specialty, locale)}
                                </p>

                                <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono-tabular text-[10.5px] text-[#556E89]">
                                  <span dir="ltr">
                                    {new Date(appt.slotStartIso).toLocaleTimeString(
                                      locale === "ar"
                                        ? "ar-MA"
                                        : locale === "fr"
                                          ? "fr-FR"
                                          : "en-US",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </span>
                                  {appt.patientPhone ? (
                                    <a
                                      href={`tel:${appt.patientPhone}`}
                                      dir="ltr"
                                      className="inline-flex items-center gap-1 rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2 py-0.5 text-[10px] font-semibold text-[#0066CC] hover:bg-[#EBF4FF]"
                                    >
                                      <Phone className="h-2.5 w-2.5" aria-hidden="true" />
                                      <span>{appt.patientPhone}</span>
                                    </a>
                                  ) : null}
                                </div>

                                {appt.reason ? (
                                  <p className="truncate text-[11px] text-[#556E89]">
                                    &ldquo;<bdi dir="auto">{appt.reason}</bdi>&rdquo;
                                  </p>
                                ) : null}

                                <div className="flex flex-wrap items-center gap-1.5 border-t border-[#EDF4FB] pt-2">
                                  {appt.status === "CONFIRMED" ? (
                                    <>
                                      <UiButton
                                        size="sm"
                                        disabled={busy || isPendingStaff || !hasDeskRole}
                                        onClick={() =>
                                          void handleTransitionAppointment(
                                            appt.id,
                                            "CHECKED_IN",
                                          )
                                        }
                                        className="flex-1"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>{h.queue.checkInBtn}</span>
                                      </UiButton>
                                      <UiButton
                                        size="sm"
                                        variant="outline"
                                        disabled={busy || isPendingStaff || !hasDeskRole}
                                        onClick={() =>
                                          void handleTransitionAppointment(
                                            appt.id,
                                            "NO_SHOW",
                                          )
                                        }
                                      >
                                        <span>{h.queue.noShowBtn}</span>
                                      </UiButton>
                                      <UiButton
                                        size="sm"
                                        variant="outline"
                                        disabled={busy || isPendingStaff || !hasDeskRole}
                                        onClick={() =>
                                          void handleTransitionAppointment(
                                            appt.id,
                                            "CANCELLED",
                                          )
                                        }
                                        aria-label={h.queue.cancelBtn}
                                      >
                                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                      </UiButton>
                                    </>
                                  ) : appt.status === "CHECKED_IN" ? (
                                    <UiButton
                                      size="sm"
                                      disabled={busy || isPendingStaff || !hasDeskRole}
                                      onClick={() =>
                                        void handleTransitionAppointment(
                                          appt.id,
                                          "COMPLETED",
                                        )
                                      }
                                      className="w-full"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>{h.queue.completeVisitBtn}</span>
                                    </UiButton>
                                  ) : (
                                    <UiBadge tone={APPT_STATUS_TONE[appt.status]}>
                                      {h.enums.appointmentStatus[appt.status] ??
                                        appt.status}
                                    </UiBadge>
                                  )}
                                </div>
                              </article>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {visibleAppointments.map((appt) => (
                  <li
                    key={appt.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#0F243E]">
                          <bdi dir="auto">{appt.patientName}</bdi>
                        </span>
                        {appt.patientPhone ? (
                          <a
                            href={`tel:${appt.patientPhone}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1 rounded-full border border-[#D7E4F2] bg-white px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#0066CC] hover:bg-[#EBF4FF]"
                          >
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            <span>{appt.patientPhone}</span>
                          </a>
                        ) : null}
                        <UiBadge tone={APPT_STATUS_TONE[appt.status]}>
                          {h.enums.appointmentStatus[appt.status] ?? appt.status}
                        </UiBadge>
                        <span className="rounded-full bg-white px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-700">
                          {formatVisitMode(appt.visitMode, locale)}
                        </span>
                      </div>
                      <p className="text-slate-700">
                        {formatPractitionerDisplayName(
                          appt.doctorName,
                          appt.specialty,
                        )}{" "}
                        · {formatSpecialtyLabel(appt.specialty, locale)} ·{" "}
                        {appt.facilityName}
                      </p>
                      <p className="font-mono-tabular text-slate-500">
                        <span dir="ltr">
                          {new Date(appt.slotStartIso).toLocaleString(
                            locale === "ar"
                              ? "ar-MA"
                              : locale === "fr"
                                ? "fr-FR"
                                : "en-US",
                          )}
                        </span>
                        {appt.reason ? (
                          <>
                            {" "}
                            · &ldquo;<bdi dir="auto">{appt.reason}</bdi>&rdquo;
                          </>
                        ) : (
                          ""
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {appt.status === "CONFIRMED" ? (
                        <>
                          <UiButton
                            size="sm"
                            disabled={busy || isPendingStaff || !hasDeskRole}
                            onClick={() =>
                              void handleTransitionAppointment(
                                appt.id,
                                "CHECKED_IN",
                              )
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{h.queue.checkInBtn}</span>
                          </UiButton>
                          <UiButton
                            size="sm"
                            variant="outline"
                            disabled={busy || isPendingStaff || !hasDeskRole}
                            onClick={() =>
                              void handleTransitionAppointment(appt.id, "NO_SHOW")
                            }
                          >
                            <span>{h.queue.noShowBtn}</span>
                          </UiButton>
                          <UiButton
                            size="sm"
                            variant="outline"
                            disabled={busy || isPendingStaff || !hasDeskRole}
                            onClick={() =>
                              void handleTransitionAppointment(
                                appt.id,
                                "CANCELLED",
                              )
                            }
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{h.queue.cancelBtn}</span>
                          </UiButton>
                        </>
                      ) : null}

                      {appt.status === "CHECKED_IN" ? (
                        <UiButton
                          size="sm"
                          disabled={busy || isPendingStaff || !hasDeskRole}
                          onClick={() =>
                            void handleTransitionAppointment(
                              appt.id,
                              "COMPLETED",
                            )
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{h.queue.completeVisitBtn}</span>
                        </UiButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Incoming Ambulance & Transfer Board + Shared Expandable Map */}
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F1FA] pb-3">
              <div className="flex items-center gap-2">
                <Ambulance className="h-4 w-4 text-rose-700" aria-hidden="true" />
                <h2 className="font-editorial text-sm font-bold text-[#0F243E]">
                  {h.ems.title(sortedDispatches.length)}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowLiveMap((prev) => !prev)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] px-3.5 py-1.5 text-xs font-semibold text-[#0F243E] hover:bg-white"
              >
                <MapIcon className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                <span>{showLiveMap ? h.ems.hideMapBtn : h.ems.openMapBtn}</span>
              </button>
            </div>

            {showLiveMap ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-xs">
                <DynamicViewportVectorMap
                  countryCode={selectedCountry}
                  viewport={viewport}
                  facilities={facilities}
                  drivers={[]}
                  clientPins={mapClientPins}
                  activeLayer="HOSPITAL"
                  selectedFacilityId={selectedFacility?.id ?? null}
                  highlightedTargetFacilityId={selectedFacility?.id ?? null}
                  postgisQueryMs={postgisMs}
                  redisQueryMs={null}
                  busy={busy}
                  onSelectFacility={(id) => setSelectedFacilityId(id)}
                  onZoom={(factor) =>
                    setViewport((prev) => zoomViewport(prev, factor))
                  }
                  onPan={(dLat, dLng) =>
                    setViewport((prev) => panViewport(prev, dLat, dLng))
                  }
                  onReset={() => setViewport(getPresetForCountry(selectedCountry))}
                  onSearchViewport={() =>
                    void refreshViewportFacilities(viewport)
                  }
                  onViewportChange={(next) => setViewport(next)}
                />
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleRequestTransfer(e)}
              className="mt-4 space-y-3 rounded-2xl border border-[#D7E4F2] bg-[#F8FBFE] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="radiogroup"
                  aria-label={h.ems.urgencyLabel}
                  className="flex flex-wrap gap-1.5"
                >
                  {(["EMERGENCY", "URGENT", "ROUTINE"] as const).map((urg) => {
                    const active = transferUrgency === urg;
                    return (
                      <button
                        key={urg}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTransferUrgency(urg)}
                        className={`min-h-[36px] rounded-full border px-3.5 text-xs font-bold transition ${
                          active
                            ? urg === "EMERGENCY"
                              ? "border-rose-700 bg-rose-600 text-white"
                              : urg === "URGENT"
                                ? "border-amber-600 bg-amber-500 text-white"
                                : "border-[#0052A3] bg-[#0066CC] text-white"
                            : "border-[#CBDDF0] bg-white text-[#4A627D] hover:border-[#0066CC]"
                        }`}
                      >
                        {h.enums.urgencyOption[urg]}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TRANSFER_REASON_CHIPS_BY_LOCALE[locale].map((chip) => {
                    const active = transferNotes === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setTransferNotes(chip)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                            : "border-[#D7E4F2] bg-white text-[#556E89] hover:border-[#0066CC] hover:text-[#0066CC]"
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                <div className="sm:col-span-9">
                  <input
                    id="hospital-transfer-note"
                    type="text"
                    aria-label={h.ems.noteLabel}
                    placeholder={h.ems.defaultTransferNote}
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#CBDDF0] bg-white px-3.5 py-2 text-xs text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <UiButton
                    type="submit"
                    disabled={
                      busy ||
                      !sessionToken ||
                      !selectedFacility ||
                      isPendingStaff ||
                      !hasDeskRole
                    }
                    className="min-h-[42px] w-full"
                  >
                    {h.ems.requestBtn}
                  </UiButton>
                </div>
              </div>
            </form>

            {sortedDispatches.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-4 text-xs text-slate-600">
                {h.ems.noActiveTransfers(countryDisplayName)}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {sortedDispatches.map((item) => {
                  const targetsSelected =
                    selectedFacility && item.targetFacilityId === selectedFacility.id;
                  return (
                    <li
                      key={item.id}
                      className={`flex flex-col gap-2.5 rounded-xl border p-3.5 text-xs shadow-2xs sm:flex-row sm:items-center sm:justify-between ${
                        targetsSelected
                          ? "border-[#B2E5DC] bg-[#E6F7F4]/70"
                          : "border-[#D7E4F2] bg-white"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#0F243E]">
                            {item.pickupAddress}
                          </span>
                          <UiBadge tone={DISPATCH_STATUS_TONE[item.status]}>
                            {formatDispatchStatus(item.status, locale)}
                          </UiBadge>
                          <span className="font-mono-tabular font-semibold text-rose-700">
                            {formatUrgencyLabel(item.urgency, locale)}
                          </span>
                        </div>
                        {item.notes ? (
                          <p className="text-slate-600">{item.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.status === "EN_ROUTE" ? (
                          <UiButton
                            size="sm"
                            disabled={busy || isPendingStaff || !hasDeskRole}
                            onClick={() =>
                              void handleDispatchTransition(item.id, "ARRIVED")
                            }
                          >
                            {h.ems.confirmArrivalBtn}
                          </UiButton>
                        ) : null}
                        {item.status === "ARRIVED" ? (
                          <UiButton
                            size="sm"
                            disabled={busy || isPendingStaff || !hasDeskRole}
                            onClick={() =>
                              void handleDispatchTransition(item.id, "COMPLETED")
                            }
                          >
                            {h.ems.completeIntakeBtn}
                          </UiButton>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {sessionToken && currentUser && hasDeskRole ? (
            <HospitalBillingPanel
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              countryCode={selectedCountry}
              currencyCode={activePack?.currencyCode ?? selectedCountry}
              selectedFacilityId={selectedFacilityId}
              busy={busy}
              isLocked={isPendingStaff}
            />
          ) : null}
      </div>
      </div>
      </WorkspaceRoleGuard>
    </div>
  );
}
