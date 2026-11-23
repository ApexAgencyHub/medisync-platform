"use client";

import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  Navigation,
  Pill,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import type {
  AuthenticatedUser,
  DirectoryDriverSummary,
  DispatchRequestSummary,
  DriverStatus,
  LocaleCode,
  UserMediaDocument,
} from "@medisync/contracts";
import { ProfileCredentialsPanel } from "@/features/auth-portal";
import { formatDispatchStatus, formatDriverStatus, formatUrgencyLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiBadge } from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";

export type DriverSidebarTab = "radar" | "trips" | "papers";
export type DriverQueueFilter = "ALL" | "EMS" | "COURIER";

const DRIVER_UI_COPY: Record<
  LocaleCode,
  {
    tabRadar: string;
    tabTrips: (count: number) => string;
    tabPapers: string;
    filterAll: string;
    filterEms: string;
    filterCourier: string;
    courierBadge: string;
    emsBadge: string;
    statsTitle: string;
    activeJobs: string;
    completedTrips: string;
    courierDrops: string;
    beaconStatus: string;
    historyTitle: string;
    historyEmpty: string;
    fleetTitle: string;
    verifiedBadge: string;
    pendingBadge: string;
    zoneLabel: string;
    defaultVehicle: string;
    papersSubtitle: string;
    closePanel: string;
  }
> = {
  en: {
    tabRadar: "Live Radar",
    tabTrips: (n) => `Trips (${n})`,
    tabPapers: "Papers",
    filterAll: "All Jobs",
    filterEms: "EMS / Patient",
    filterCourier: "Pharmacy Courier",
    courierBadge: "Courier",
    emsBadge: "EMS Ride",
    statsTitle: "Shift Performance & Trips",
    activeJobs: "Active Mission",
    completedTrips: "Completed",
    courierDrops: "OTC / Parapharma",
    beaconStatus: "Beacon",
    historyTitle: "Completed & Closed Missions",
    historyEmpty:
      "Completed patient pickups and pharmacy courier drops will be recorded here.",
    fleetTitle: "Vehicle & Compliance File",
    verifiedBadge: "Dispatch Verified",
    pendingBadge: "Pending Approval",
    zoneLabel: "Zone",
    defaultVehicle: "Medical Rapid Response Vehicle",
    papersSubtitle:
      "Upload or inspect your Driver License, Vehicle Inspection, Insurance Certificate, and National ID.",
    closePanel: "Close panel",
  },
  fr: {
    tabRadar: "Radar Direct",
    tabTrips: (n) => `Courses (${n})`,
    tabPapers: "Papiers",
    filterAll: "Tout",
    filterEms: "Urgence / Patient",
    filterCourier: "Parapharma / OTC",
    courierBadge: "Parapharma OTC",
    emsBadge: "Transport",
    statsTitle: "Activité & Historique des Courses",
    activeJobs: "Course active",
    completedTrips: "Terminées",
    courierDrops: "Parapharma OTC",
    beaconStatus: "Balise",
    historyTitle: "Missions Terminées & Historique",
    historyEmpty:
      "Vos transports patients et livraisons parapharmacie (Loi 17-04) s'afficheront ici.",
    fleetTitle: "Véhicule & Dossier Réglementaire",
    verifiedBadge: "Validé Dispatch",
    pendingBadge: "En attente Admin",
    zoneLabel: "Secteur",
    defaultVehicle: "Véhicule d'Intervention Médicale",
    papersSubtitle:
      "Déposez votre permis de conduire, visite technique, assurance véhicule et CIN.",
    closePanel: "Fermer le panneau",
  },
  ar: {
    tabRadar: "الرادار المباشر",
    tabTrips: (n) => `الرحلات (${n})`,
    tabPapers: "الوثائق",
    filterAll: "الكل",
    filterEms: "نقل المرضى",
    filterCourier: "شبه الصيدلية (OTC)",
    courierBadge: "توصيل OTC",
    emsBadge: "نقل إسعافي",
    statsTitle: "ملخص العمل وسجل الرحلات",
    activeJobs: "مهمة جارية",
    completedTrips: "مكتملة",
    courierDrops: "شبه الصيدلية",
    beaconStatus: "الحالة",
    historyTitle: "سجل الرحلات والتوصيلات المكتملة",
    historyEmpty:
      "ستظهر هنا جميع رحلات نقل المرضى وتوصيلات شبه الصيدلية (قانون 17-04) بعد إتمامها.",
    fleetTitle: "بيانات المركبة ووثائق السائق",
    verifiedBadge: "حساب معتمد",
    pendingBadge: "في انتظار المصادقة",
    zoneLabel: "منطقة الخدمة",
    defaultVehicle: "مركبة إسعاف وتدخل طبي",
    papersSubtitle:
      "ارفع رخصة السياقة، الفحص التقني للمركبة، التأمين المهني والبطاقة الوطنية.",
    closePanel: "إغلاق اللوحة",
  },
};

export function isPharmacyCourierDispatch(
  dispatch: Pick<DispatchRequestSummary, "notes">,
): boolean {
  return Boolean(dispatch.notes && /pharmacy\s+courier/i.test(dispatch.notes));
}

interface DriverTabBarProps {
  activeTab: DriverSidebarTab;
  completedCount: number;
  pendingPaperCount: number;
  onSelectTab: (tab: DriverSidebarTab) => void;
  compact?: boolean;
}

export function DriverTabBar({
  activeTab,
  completedCount,
  pendingPaperCount,
  onSelectTab,
  compact = false,
}: DriverTabBarProps) {
  const { locale } = useLocale();
  const c = DRIVER_UI_COPY[locale];

  return (
    <div
      role="tablist"
      aria-label="Driver dashboard sections"
      className={
        compact
          ? "inline-flex h-9 items-center gap-0.5 rounded-full border border-[#D7E4F2] bg-white/97 p-1 shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] backdrop-blur-xl xl:h-10"
          : "grid grid-cols-3 gap-1 rounded-2xl border border-[#D7E4F2] bg-white p-1.5 shadow-[0_10px_28px_-10px_rgba(15,36,62,0.14)]"
      }
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "radar"}
        onClick={() => onSelectTab("radar")}
        className={`inline-flex items-center justify-center gap-1 whitespace-nowrap font-semibold transition ${
          compact
            ? "h-7 rounded-full px-2 text-[11px] xl:h-8 xl:px-3"
            : "h-9 rounded-xl px-2 text-[11px]"
        } ${
          activeTab === "radar"
            ? "bg-[#0066CC] text-white shadow-xs"
            : "text-[#4A627D] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
        }`}
      >
        <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{c.tabRadar}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "trips"}
        onClick={() => onSelectTab("trips")}
        className={`inline-flex items-center justify-center gap-1 whitespace-nowrap font-semibold transition ${
          compact
            ? "h-7 rounded-full px-2 text-[11px] xl:h-8 xl:px-3"
            : "h-9 rounded-xl px-2 text-[11px]"
        } ${
          activeTab === "trips"
            ? "bg-[#0066CC] text-white shadow-xs"
            : "text-[#4A627D] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
        }`}
      >
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{c.tabTrips(completedCount)}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "papers"}
        onClick={() => onSelectTab("papers")}
        className={`inline-flex items-center justify-center gap-1 whitespace-nowrap font-semibold transition ${
          compact
            ? "h-7 rounded-full px-2 text-[11px] xl:h-8 xl:px-3"
            : "h-9 rounded-xl px-2 text-[11px]"
        } ${
          activeTab === "papers"
            ? "bg-[#0066CC] text-white shadow-xs"
            : "text-[#4A627D] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
        }`}
      >
        <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {c.tabPapers}
          {pendingPaperCount > 0 ? ` (${pendingPaperCount})` : ""}
        </span>
      </button>
    </div>
  );
}

export function DriverMissionStepper({
  dispatch,
}: {
  dispatch: Pick<DispatchRequestSummary, "status" | "urgency" | "notes">;
}) {
  const { locale } = useLocale();
  const steps =
    locale === "fr"
      ? [
          { key: "ASSIGNED", label: "Acceptée" },
          { key: "EN_ROUTE", label: "En route" },
          { key: "ARRIVED", label: "Arrivé" },
          { key: "COMPLETED", label: "Terminée" },
        ]
      : locale === "ar"
        ? [
            { key: "ASSIGNED", label: "مقبولة" },
            { key: "EN_ROUTE", label: "في الطريق" },
            { key: "ARRIVED", label: "تم الوصول" },
            { key: "COMPLETED", label: "مكتملة" },
          ]
        : [
            { key: "ASSIGNED", label: "Accepted" },
            { key: "EN_ROUTE", label: "En Route" },
            { key: "ARRIVED", label: "Arrived" },
            { key: "COMPLETED", label: "Dropped Off" },
          ];

  const activeIdx =
    dispatch.status === "ASSIGNED"
      ? 0
      : dispatch.status === "EN_ROUTE"
        ? 1
        : dispatch.status === "ARRIVED"
          ? 2
          : dispatch.status === "COMPLETED"
            ? 3
            : -1;

  return (
    <div className="grid grid-cols-4 gap-1">
      {steps.map((step, idx) => {
        const completed = idx <= activeIdx;
        return (
          <div key={step.key} className="space-y-1 text-center">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                completed
                  ? dispatch.urgency === "EMERGENCY"
                    ? "bg-[#DC2626]"
                    : "bg-[#0066CC]"
                  : "bg-[#D7E4F2]"
              }`}
            />
            <span
              className={`block truncate text-[9.5px] font-semibold ${
                completed ? "text-[#0F243E]" : "text-[#87A0BC]"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface DriverQueueFilterBarProps {
  value: DriverQueueFilter;
  onChange: (next: DriverQueueFilter) => void;
  counts?: {
    all: number;
    ems: number;
    courier: number;
  };
}

export function DriverQueueFilterBar({
  value,
  onChange,
  counts,
}: DriverQueueFilterBarProps) {
  const { locale } = useLocale();
  const c = DRIVER_UI_COPY[locale];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {(
        [
          { id: "ALL", label: c.filterAll, count: counts?.all },
          { id: "EMS", label: c.filterEms, count: counts?.ems },
          { id: "COURIER", label: c.filterCourier, count: counts?.courier },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold transition ${
            value === opt.id
              ? "bg-[#0066CC] text-white"
              : "border border-[#D7E4F2] bg-[#F3F8FD] text-slate-700 hover:bg-[#E1EBF2]"
          }`}
        >
          <span>{opt.label}</span>
          {opt.count !== undefined && opt.count > 0 ? (
            <span
              className={`font-mono-tabular text-[9.5px] font-bold ${
                value === opt.id ? "text-white/90" : "text-[#0066CC]"
              }`}
            >
              ({opt.count})
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function DriverJobTypeBadge({
  dispatch,
}: {
  dispatch: Pick<DispatchRequestSummary, "notes">;
}) {
  const { locale } = useLocale();
  const c = DRIVER_UI_COPY[locale];
  const isCourier = isPharmacyCourierDispatch(dispatch);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isCourier
          ? "bg-indigo-50 text-indigo-800"
          : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {isCourier ? (
        <Pill className="h-2.5 w-2.5" aria-hidden="true" />
      ) : (
        <Truck className="h-2.5 w-2.5" aria-hidden="true" />
      )}
      <span>{isCourier ? c.courierBadge : c.emsBadge}</span>
    </span>
  );
}

interface DriverTripsStatsPanelProps {
  driverId: string;
  driverStatus: DriverStatus;
  dispatches: readonly DispatchRequestSummary[];
  onClose?: () => void;
}

export function DriverTripsStatsPanel({
  driverId,
  driverStatus,
  dispatches,
  onClose,
}: DriverTripsStatsPanelProps) {
  const { locale } = useLocale();
  const c = DRIVER_UI_COPY[locale];

  const myMissions = dispatches.filter((d) => d.driverUserId === driverId);
  const activeCount = myMissions.filter(
    (d) =>
      d.status === "ASSIGNED" ||
      d.status === "EN_ROUTE" ||
      d.status === "ARRIVED",
  ).length;
  const completedMissions = myMissions.filter(
    (d) => d.status === "COMPLETED",
  );
  const courierCount = completedMissions.filter((d) =>
    isPharmacyCourierDispatch(d),
  ).length;
  const closedHistory = myMissions.filter(
    (d) => d.status === "COMPLETED" || d.status === "CANCELLED",
  );

  return (
    <section className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white/96 p-4 shadow-[0_14px_34px_rgba(15,36,62,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-editorial text-xs font-bold uppercase tracking-wider text-[#2F4661]">
          {c.statsTitle}
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={c.closePanel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F3F8FD] text-slate-500 transition hover:bg-[#E8F1FA] hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3">
          <p className="text-[10.5px] font-semibold text-[#556E89]">
            {c.activeJobs}
          </p>
          <p className="mt-0.5 font-mono-tabular text-lg font-bold text-[#0066CC]">
            {activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#B2E5DC] bg-[#E6F7F4]/80 p-3">
          <p className="text-[10.5px] font-semibold text-[#0B6B5C]">
            {c.completedTrips}
          </p>
          <p className="mt-0.5 font-mono-tabular text-lg font-bold text-[#0F9D88]">
            {completedMissions.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3">
          <p className="text-[10.5px] font-semibold text-[#556E89]">
            {c.courierDrops}
          </p>
          <p className="mt-0.5 font-mono-tabular text-lg font-bold text-[#0F243E]">
            {courierCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#BFDBFE] bg-[#EBF4FF]/80 p-3">
          <p className="text-[10.5px] font-semibold text-[#0052A3]">
            {c.beaconStatus}
          </p>
          <p className="mt-0.5 truncate text-xs font-bold text-[#0066CC]">
            {formatDriverStatus(driverStatus, locale)}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          {c.historyTitle} ({closedHistory.length})
        </h3>
        {closedHistory.length === 0 ? (
          <p className="rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3.5 text-xs text-slate-500">
            {c.historyEmpty}
          </p>
        ) : (
          <ul className="space-y-2">
            {closedHistory.slice(0, 12).map((trip) => (
              <li
                key={trip.id}
                className="space-y-1 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-[#0066CC]"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-slate-900">
                      {formatUrgencyLabel(trip.urgency, locale)}
                    </span>
                  </div>
                  <UiBadge
                    tone={trip.status === "COMPLETED" ? "emerald" : "red"}
                  >
                    {formatDispatchStatus(trip.status, locale)}
                  </UiBadge>
                </div>
                <p className="text-slate-700">{trip.pickupAddress}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <DriverJobTypeBadge dispatch={trip} />
                  <span className="inline-flex items-center gap-1 font-mono-tabular">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {trip.updatedAtIso.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface DriverCredentialsPanelProps {
  apiBaseUrl: string;
  token: string;
  user: AuthenticatedUser;
  fleetInfo: DirectoryDriverSummary | null;
  documents: readonly UserMediaDocument[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onDocumentsUpdated: () => Promise<void>;
  onFeedback: (tone: "success" | "error" | "info", text: string) => void;
  onClose?: () => void;
}

export function DriverCredentialsPanel({
  apiBaseUrl,
  token,
  user,
  fleetInfo,
  documents,
  busy,
  onBusyChange,
  onDocumentsUpdated,
  onFeedback,
  onClose,
}: DriverCredentialsPanelProps) {
  const { locale } = useLocale();
  const c = DRIVER_UI_COPY[locale];

  return (
    <section className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <ShieldCheck className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
            <span>{c.fleetTitle}</span>
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-900">
            {fleetInfo?.vehicleLabel ?? c.defaultVehicle}
          </p>
          <p className="text-[11px] text-slate-500">
            {c.zoneLabel}: {fleetInfo?.serviceZone ?? user.countryCode}
          </p>
          <MoroccanComplianceBadge domain="driver" locale={locale} className="mt-2" />
        </div>
        <div className="flex items-center gap-1.5">
          <UiBadge
            tone={
              user.accountStatus === "ACTIVE" && user.credentialVerified
                ? "emerald"
                : "amber"
            }
          >
            {user.accountStatus === "ACTIVE" && user.credentialVerified
              ? c.verifiedBadge
              : c.pendingBadge}
          </UiBadge>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={c.closePanel}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F3F8FD] text-slate-500 transition hover:bg-[#E8F1FA] hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <ProfileCredentialsPanel
        apiBaseUrl={apiBaseUrl}
        token={token}
        userRole={user.role}
        documents={documents}
        busy={busy}
        onBusyChange={onBusyChange}
        onDocumentsUpdated={onDocumentsUpdated}
        onFeedback={onFeedback}
      />
    </section>
  );
}
