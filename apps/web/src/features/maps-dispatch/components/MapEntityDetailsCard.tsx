"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type {
  DirectoryDoctorSummary,
  DriverStatus,
  FacilityKind,
  VehicleType,
  ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Ambulance,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Clock,
  Globe,
  Hospital,
  Languages,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Shield,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import {
  formatDriverStatus,
  formatFacilityKind,
  formatLanguageList,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import { EntityMediaPair } from "@/shared/ui/EntityMediaPair";
import { UiBadge } from "@/shared/ui/primitives";
import { MAPS_COPY, type MapsUiCopy } from "../maps-i18n";

export type MapEnrichedFacility = ViewportFacilityItem & {
  acceptedInsurances?: readonly string[];
  languagesSpoken?: readonly string[];
  telehealthEnabled?: boolean;
  homeVisitEnabled?: boolean;
};

export interface MapSelectedDriverData {
  kind: "DRIVER";
  id: string;
  fullName: string;
  avatarUrl: string | null;
  vehicleType: VehicleType;
  vehicleLabel: string;
  serviceZone: string;
  facilityId: string | null;
  facilityName: string;
  facilityAddress: string | null;
  countryCode: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  distanceKm: number;
  email: string | null;
  recordedAtIso: string | null;
}

export interface MapSelectedFacilityData {
  kind: "FACILITY";
  facility: MapEnrichedFacility;
  distanceKm: number;
  emergencyHotline: string;
  staffDoctors: readonly DirectoryDoctorSummary[];
}

export interface MapSelectedDoctorData {
  kind: "DOCTOR";
  doctor: DirectoryDoctorSummary;
  facility: MapEnrichedFacility | null;
  lat: number;
  lng: number;
  distanceKm: number;
  currencyCode: string;
}

export type MapSelectedEntity =
  | MapSelectedDriverData
  | MapSelectedFacilityData
  | MapSelectedDoctorData;

interface MapEntityDetailsCardProps {
  entity: MapSelectedEntity;
  hudTopPaddingPx: number;
  cardRef: RefObject<HTMLDivElement | null>;
  driverMode?: boolean;
  onClose: () => void;
  onSelectFacilityById: (facilityId: string) => void;
  onSelectDoctorById: (doctorId: string) => void;
  onFastBookDestination?: (facilityId: string) => void;
}

function getFacilityPortalAction(
  kind: FacilityKind,
  copy: MapsUiCopy,
): {
  href: string;
  label: string;
} {
  if (kind === "PHARMACY") {
    return { href: "/pharmacy", label: copy.openPharmacyStorefront };
  }
  if (kind === "DIAGNOSTIC_LAB") {
    return { href: "/lab", label: copy.viewDiagnosticLab };
  }
  return { href: "/booking", label: copy.bookAppointment };
}

function getStatusBadgeTone(
  status: string,
): "emerald" | "amber" | "red" | "slate" {
  if (status === "AVAILABLE" || status === "OPEN" || status === "VERIFIED") {
    return "emerald";
  }
  if (status === "BUSY" || status === "ASSIGNED" || status === "PENDING_REVIEW") {
    return "amber";
  }
  if (status === "EN_ROUTE" || status === "CLOSED" || status === "SUSPENDED") {
    return "red";
  }
  return "slate";
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <span className="mt-0.5 shrink-0 text-[#0066CC]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <div className="mt-0.5 font-medium text-slate-800 break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

function DistanceCoordsReadout({
  distanceKm,
  lat,
  lng,
  kmShort,
  countryCode,
  className,
}: {
  distanceKm: number;
  lat: number;
  lng: number;
  kmShort: string;
  countryCode?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="inline-flex items-baseline gap-0.5">
        <bdi dir="ltr">~{distanceKm.toFixed(1)}</bdi>
        <span>{kmShort}</span>
      </span>
      <span aria-hidden="true">·</span>
      <bdi dir="ltr">
        {lat.toFixed(4)}, {lng.toFixed(4)}
        {countryCode ? ` (${countryCode})` : ""}
      </bdi>
    </span>
  );
}

/** Floating entity details inspector rendered when selecting a map driver, facility, or clinician icon. */
export function MapEntityDetailsCard({
  entity,
  hudTopPaddingPx,
  cardRef,
  driverMode = false,
  onClose,
  onSelectFacilityById,
  onSelectDoctorById,
  onFastBookDestination,
}: MapEntityDetailsCardProps) {
  const { locale, isRtl } = useLocale();
  const copy = MAPS_COPY[locale];

  const title =
    entity.kind === "DRIVER"
      ? entity.fullName
      : entity.kind === "FACILITY"
        ? entity.facility.name
        : entity.doctor.fullName;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`${title} ${copy.detailsSuffix}`}
      dir={isRtl ? "rtl" : "ltr"}
      data-map-hud="true"
      style={{ ["--hud-top" as string]: `${hudTopPaddingPx}px` } as CSSProperties}
      className="pointer-events-auto absolute z-35 flex flex-col overflow-hidden rounded-xl bg-white/95 shadow-[0_18px_46px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.08] backdrop-blur-2xl max-sm:inset-x-2.5 max-sm:bottom-2.5 max-sm:max-h-[58dvh] sm:top-[var(--hud-top)] sm:bottom-auto sm:start-3.5 sm:w-[376px] sm:max-h-[calc(100%-var(--hud-top)-54px)]"
    >
      {/* Card Header */}
      <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {entity.kind === "DRIVER" ? (
              <>
                <UiBadge tone="emerald">
                  <Ambulance className="me-1 h-3 w-3" aria-hidden="true" />
                  {entity.vehicleType === "MEDICAL_SHUTTLE"
                    ? copy.medicalShuttle
                    : copy.ambulanceUnit}
                </UiBadge>
                <UiBadge tone={getStatusBadgeTone(entity.status)}>
                  {formatDriverStatus(entity.status, locale)}
                </UiBadge>
              </>
            ) : entity.kind === "FACILITY" ? (
              <>
                <UiBadge tone="emerald">
                  <Hospital className="me-1 h-3 w-3" aria-hidden="true" />
                  {formatFacilityKind(entity.facility.kind, locale)}
                </UiBadge>
                <UiBadge tone={getStatusBadgeTone(entity.facility.openStatus)}>
                  {formatOpenStatus(entity.facility.openStatus, locale)}
                </UiBadge>
                {entity.facility.verificationStatus === "VERIFIED" ? (
                  <UiBadge tone="emerald">
                    <BadgeCheck className="me-0.5 h-3 w-3" aria-hidden="true" />
                    {copy.verifiedBadge}
                  </UiBadge>
                ) : null}
              </>
            ) : (
              <>
                <UiBadge tone="emerald">
                  <Stethoscope className="me-1 h-3 w-3" aria-hidden="true" />
                  {formatSpecialtyLabel(entity.doctor.specialty, locale)}
                </UiBadge>
                {entity.doctor.credentialVerified ? (
                  <UiBadge tone="emerald">
                    <BadgeCheck className="me-0.5 h-3 w-3" aria-hidden="true" />
                    {copy.verifiedBadge}
                  </UiBadge>
                ) : null}
              </>
            )}
          </div>
          <h2 className="mt-1.5 truncate text-sm font-bold text-slate-950 sm:text-base">
            <bdi dir="auto">{title}</bdi>
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeDetailsAria}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-950"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Complete Entity Details */}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3 [scrollbar-width:thin]">
        {entity.kind === "DRIVER" ? (
          <>
            <EntityMediaPair
              variant="showcase"
              primarySrc={
                entity.avatarUrl ||
                resolveDefaultAvatar(entity.fullName, "DRIVER")
              }
              primaryAlt={`${entity.fullName} ${copy.driverPortraitSuffix}`}
              primaryLabel={copy.driverWord}
              secondarySrc={resolveVehiclePicture(entity.vehicleType)}
              secondaryAlt={entity.vehicleLabel}
              secondaryLabel={entity.vehicleLabel}
              title={entity.fullName}
              subtitle={`${entity.vehicleLabel} · ${entity.serviceZone}`}
              badge={formatDriverStatus(entity.status, locale)}
              specs={[
                {
                  label: copy.statusLabel,
                  value: formatDriverStatus(entity.status, locale),
                },
                { label: copy.vehicleLabel, value: entity.vehicleLabel },
                { label: copy.serviceZoneLabel, value: entity.serviceZone },
                { label: copy.baseFacilityLabel, value: entity.facilityName },
              ]}
            />

            <div className="space-y-2.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3">
              <DetailRow
                icon={<Ambulance className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.vehicleLabel}
                value={entity.vehicleLabel}
              />
              <DetailRow
                icon={<Navigation className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.serviceZoneLabel}
                value={entity.serviceZone}
              />
              <DetailRow
                icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.baseFacilityLabel}
                value={
                  entity.facilityId ? (
                    <button
                      type="button"
                      onClick={() => onSelectFacilityById(entity.facilityId!)}
                      className="text-start font-semibold text-[#0066CC] hover:underline"
                    >
                      {entity.facilityName}
                      {entity.facilityAddress
                        ? ` · ${entity.facilityAddress}`
                        : ""}
                    </button>
                  ) : (
                    entity.facilityName
                  )
                }
              />
              {entity.email ? (
                <DetailRow
                  icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={copy.dispatchContactLabel}
                  value={entity.email}
                />
              ) : null}
              <DetailRow
                icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.locationDistanceLabel}
                value={
                  <DistanceCoordsReadout
                    distanceKm={entity.distanceKm}
                    lat={entity.lat}
                    lng={entity.lng}
                    kmShort={copy.kmShort}
                    countryCode={entity.countryCode}
                    className="flex flex-wrap items-center gap-1.5 font-mono-tabular"
                  />
                }
              />
              {entity.recordedAtIso ? (
                <DetailRow
                  icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={copy.lastGpsSyncLabel}
                  value={new Date(entity.recordedAtIso).toLocaleTimeString()}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {entity.facilityId ? (
                <button
                  type="button"
                  onClick={() => onSelectFacilityById(entity.facilityId!)}
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                  <span>{copy.viewBaseHubBtn}</span>
                </button>
              ) : null}
              <Link
                href="/portal"
                className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0052A3]"
              >
                <span>{copy.openDispatchPortalBtn}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : entity.kind === "FACILITY" ? (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-2.5">
              <img
                src={resolveFacilityPicture(entity.facility.kind)}
                alt={entity.facility.name}
                className="aspect-[4/3] h-16 w-24 shrink-0 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] object-cover "
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  {entity.facility.address}
                </p>
                <div className="flex flex-wrap gap-1">
                  {entity.facility.is24_7 ? (
                    <UiBadge tone="emerald">{copy.badge247}</UiBadge>
                  ) : null}
                  {entity.facility.acceptsEmergency ? (
                    <UiBadge tone="red">{copy.badgeEmergencyCare}</UiBadge>
                  ) : null}
                  {entity.facility.telehealthEnabled ? (
                    <UiBadge tone="emerald">{copy.badgeTelehealth}</UiBadge>
                  ) : null}
                  {entity.facility.homeVisitEnabled ? (
                    <UiBadge tone="slate">{copy.badgeHomeVisits}</UiBadge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-900/[0.05]">
              <DetailRow
                icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.addressCoordsLabel}
                value={
                  <>
                    <span className="block">
                      <bdi dir="auto">{entity.facility.address}</bdi>
                    </span>
                    <DistanceCoordsReadout
                      distanceKm={entity.distanceKm}
                      lat={entity.facility.lat}
                      lng={entity.facility.lng}
                      kmShort={copy.kmShort}
                      countryCode={entity.facility.countryCode}
                      className="flex flex-wrap items-center gap-1.5 font-mono-tabular text-[11px] text-slate-500"
                    />
                  </>
                }
              />
              <DetailRow
                icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.phoneEmergencyLabel}
                value={
                  entity.facility.phone ? (
                    <a
                      dir="ltr"
                      href={`tel:${entity.facility.phone}`}
                      className="inline-block font-mono-tabular font-semibold text-[#0066CC] hover:underline"
                    >
                      <bdi dir="ltr">{entity.facility.phone}</bdi>
                    </a>
                  ) : (
                    <span>
                      {copy.emergencyHotlinePrefix}{" "}
                      <bdi dir="ltr">{entity.emergencyHotline}</bdi>
                    </span>
                  )
                }
              />
              <DetailRow
                icon={<Shield className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.licenseAccreditationLabel}
                value={
                  <span className="font-mono-tabular">
                    {entity.facility.licenseNumber} ·{" "}
                    {entity.facility.verificationStatus}
                  </span>
                }
              />
              {entity.facility.specialties.length > 0 ? (
                <DetailRow
                  icon={
                    <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                  label={copy.specialtiesServicesLabel}
                  value={entity.facility.specialties
                    .map((s) => formatSpecialtyLabel(s, locale))
                    .join(" · ")}
                />
              ) : null}
              {entity.facility.acceptedInsurances &&
              entity.facility.acceptedInsurances.length > 0 ? (
                <DetailRow
                  icon={<Globe className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={copy.acceptedInsuranceLabel}
                  value={entity.facility.acceptedInsurances.join(" · ")}
                />
              ) : null}
              {entity.facility.languagesSpoken &&
              entity.facility.languagesSpoken.length > 0 ? (
                <DetailRow
                  icon={<Languages className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={copy.languagesLabel}
                  value={formatLanguageList(entity.facility.languagesSpoken)}
                />
              ) : null}
            </div>

            {!driverMode && entity.staffDoctors.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {copy.stationedStaffHeading} ({entity.staffDoctors.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entity.staffDoctors.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onSelectDoctorById(doc.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-2.5 py-1 text-[11px] font-semibold text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <Stethoscope
                        className="h-3 w-3 text-[#0066CC]"
                        aria-hidden="true"
                      />
                      <span>{doc.fullName}</span>
                      <span className="text-slate-400">
                        · {formatSpecialtyLabel(doc.specialty, locale)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {driverMode ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${entity.facility.lat},${entity.facility.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0052A3]"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.navigateFacilityBtn}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <>
                  {onFastBookDestination &&
                  (entity.facility.kind === "HOSPITAL" ||
                    entity.facility.kind === "CLINIC") ? (
                    <button
                      type="button"
                      onClick={() => onFastBookDestination(entity.facility.id)}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                    >
                      <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.fastBookEmsHereBtn}</span>
                    </button>
                  ) : null}
                  {(() => {
                    const action = getFacilityPortalAction(
                      entity.facility.kind,
                      copy,
                    );
                    return (
                      <Link
                        href={action.href}
                        className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0052A3]"
                      >
                        <span>{action.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    );
                  })()}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <EntityMediaPair
              variant="showcase"
              primarySrc={
                entity.doctor.avatarUrl ||
                resolveDefaultAvatar(
                  entity.doctor.fullName,
                  "DOCTOR",
                  entity.doctor.specialty,
                )
              }
              primaryAlt={`${entity.doctor.fullName} ${copy.clinicianPortraitSuffix}`}
              primaryLabel={copy.clinicianWord}
              secondarySrc={resolveFacilityPicture(
                entity.facility?.kind ?? "CLINIC",
              )}
              secondaryAlt={
                entity.doctor.facilityName ?? copy.medicalPracticeFallback
              }
              secondaryLabel={
                entity.doctor.facilityName ?? copy.practiceFallback
              }
              title={entity.doctor.fullName}
              subtitle={`${formatSpecialtyLabel(entity.doctor.specialty, locale)} · ${entity.doctor.facilityName ?? entity.doctor.countryCode}`}
              badge={`${(entity.doctor.consultationFeeMinor / 100).toFixed(0)} ${entity.currencyCode}`}
            />

            <div className="space-y-2.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3">
              <DetailRow
                icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.practiceFacilityLabel}
                value={
                  entity.doctor.facilityId && entity.facility ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectFacilityById(entity.doctor.facilityId!)
                      }
                      className="text-start font-semibold text-[#0066CC] hover:underline"
                    >
                      {entity.facility.name} · {entity.facility.address}
                    </button>
                  ) : (
                    entity.doctor.facilityName ?? entity.doctor.countryCode
                  )
                }
              />
              <DetailRow
                icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.consultationFeeLabel}
                value={
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {(entity.doctor.consultationFeeMinor / 100).toFixed(0)}{" "}
                    {entity.currencyCode}
                  </span>
                }
              />
              <DetailRow
                icon={<Video className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.consultationModesLabel}
                value={(
                  entity.doctor.homeVisitEnabled &&
                  !entity.doctor.telehealthEnabled &&
                  /nursing|infirmier|nurse/i.test(entity.doctor.specialty)
                    ? [copy.homeVisitWord]
                    : [
                        copy.clinicVisitWord,
                        entity.doctor.telehealthEnabled
                          ? copy.videoVisitWord
                          : null,
                        entity.doctor.homeVisitEnabled
                          ? copy.homeVisitWord
                          : null,
                      ]
                )
                  .filter(Boolean)
                  .join(" · ")}
              />
              <DetailRow
                icon={<Globe className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.acceptedInsuranceLabel}
                value={entity.doctor.acceptedInsurances.join(" · ")}
              />
              <DetailRow
                icon={<Languages className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.languagesLabel}
                value={formatLanguageList(entity.doctor.languagesSpoken)}
              />
              <DetailRow
                icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.emailLabel}
                value={entity.doctor.email}
              />
              <DetailRow
                icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                label={copy.locationDistanceLabel}
                value={
                  <DistanceCoordsReadout
                    distanceKm={entity.distanceKm}
                    lat={entity.lat}
                    lng={entity.lng}
                    kmShort={copy.kmShort}
                    className="flex flex-wrap items-center gap-1.5 font-mono-tabular"
                  />
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {entity.facility ? (
                <button
                  type="button"
                  onClick={() => onSelectFacilityById(entity.facility!.id)}
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                  <span>{copy.viewClinicBtn}</span>
                </button>
              ) : null}
              <Link
                href="/booking"
                className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0052A3]"
              >
                <span>{copy.bookAppointment}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
