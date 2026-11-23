"use client";

import type { AvailableSlot, VisitMode } from "@medisync/contracts";
import {
  ArrowRight,
  Clock,
  Home,
  Languages,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Video,
} from "lucide-react";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
} from "@/shared/ui/EntityAvatar";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { UiBadge, UiButton } from "@/shared/ui/primitives";
import { BOOKING_COPY } from "../booking-i18n";
import { formatLanguageCodes, isNurseSpecialty } from "./booking-utils";

export interface EnrichedProviderGroup {
  key: string;
  doctorUserId: string;
  doctorName: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string | null;
  avatarUrl: string | null;
  licenseNumber: string | null;
  bio: string | null;
  acceptedInsurances: readonly string[];
  languagesSpoken: readonly string[];
  credentialVerified: boolean;
  telehealthEnabled: boolean;
  consultationFeeMinor: number;
  countryCode: string;
  slots: AvailableSlot[];
}

interface PractitionerSlotCardProps {
  group: EnrichedProviderGroup;
  currencyCode: string;
  selectedWeekdayLabel: string;
  onOpenSchedule: (initialSlotKey?: string, preferredMode?: VisitMode) => void;
}

/** Practitioner & home nurse scheduling card with localized specialty, workplace/video options & verified insurance metadata. */
export function PractitionerSlotCard({
  group,
  currencyCode,
  selectedWeekdayLabel,
  onOpenSchedule,
}: PractitionerSlotCardProps) {
  const { locale } = useLocale();
  const copy = BOOKING_COPY[locale];
  const { openImage } = useImageLightbox();
  const nurseTrack = isNurseSpecialty(group.specialty);
  const localizedSpecialty = formatSpecialtyLabel(group.specialty, locale);
  const openSlots = group.slots.filter((s) => s.isAvailable);
  const firstMode = group.slots[0]?.visitMode ?? "IN_PERSON";

  const primaryPhoto =
    group.avatarUrl ??
    resolveDefaultAvatar(group.doctorName, "DOCTOR", group.specialty);
  const workplacePhoto = resolveFacilityPicture(
    nurseTrack ? "HOSPITAL" : "CLINIC",
  );

  return (
    <li className="flex min-w-0 flex-col justify-between gap-3.5 overflow-hidden rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-900/[0.06] transition hover:bg-slate-100/70">
      {/* Top Practitioner & Facility Identity */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() =>
              openImage({
                src: primaryPhoto,
                alt: group.doctorName,
                primaryLabel: nurseTrack
                  ? copy.cardNursePortrait
                  : copy.cardDoctorPortrait,
                secondarySrc: workplacePhoto,
                secondaryAlt: group.facilityName,
                secondaryLabel: nurseTrack
                  ? copy.cardCareHub
                  : copy.cardClinicInterior,
                title: group.doctorName,
                subtitle: `${localizedSpecialty} · ${group.facilityName}`,
                badge: localizedSpecialty,
                specs: [
                  { label: copy.cardSpecialtyLabel, value: localizedSpecialty },
                  { label: copy.cardFacilityLabel, value: group.facilityName },
                  ...(group.facilityAddress
                    ? [{ label: copy.cardAddressLabel, value: group.facilityAddress }]
                    : []),
                  {
                    label: copy.cardVisitFeeLabel,
                    value: `${(group.consultationFeeMinor / 100).toFixed(2)} ${currencyCode}`,
                  },
                ],
              })
            }
            aria-label={`${copy.cardInspectPhotosAria} ${group.doctorName}`}
            className="h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD]  focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <img
              src={primaryPhoto}
              alt={group.doctorName}
              className="h-full w-full object-cover object-top"
            />
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-950">
                <bdi dir="auto">{group.doctorName}</bdi>
              </h3>
              {group.credentialVerified ? (
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-[#0066CC]"
                  aria-label={copy.cardVerifiedAria}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <UiBadge
                tone="emerald"
                className="max-w-full whitespace-normal text-start leading-tight"
              >
                {localizedSpecialty}
              </UiBadge>
              {nurseTrack ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <Home className="h-3 w-3 shrink-0 text-[#0066CC]" aria-hidden="true" />
                  <span>{formatVisitMode(firstMode, locale)}</span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <Stethoscope className="h-3 w-3 shrink-0 text-[#0066CC]" aria-hidden="true" />
                    <span>{copy.visitWorkplace}</span>
                  </span>
                  {group.telehealthEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0066CC]">
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <Video className="h-3 w-3 shrink-0 text-[#0066CC]" aria-hidden="true" />
                      <span>{copy.videoCall}</span>
                    </span>
                  ) : null}
                </>
              )}
            </div>

            <p className="flex items-start gap-1 text-xs text-slate-600">
              <MapPin
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <bdi dir="auto">
                  {firstMode === "HOME_VISIT"
                    ? `${copy.cardDispatchedFrom} ${group.facilityName}`
                    : group.facilityName}
                </bdi>
                {group.facilityAddress ? (
                  <span className="text-slate-500">
                    {" "}
                    · {group.facilityAddress}
                  </span>
                ) : null}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tabular text-sm font-bold text-slate-950">
              {(group.consultationFeeMinor / 100).toFixed(0)} {currencyCode}
            </span>
            <BookmarkButton
              compact
              entry={{
                id: group.doctorUserId,
                kind: nurseTrack ? "NURSE" : "DOCTOR",
                countryCode: group.countryCode,
                title: group.doctorName,
                subtitle: `${localizedSpecialty} · ${group.facilityName}`,
                facilityId: group.facilityId,
                facilityName: group.facilityName,
                href: `/booking?doctorId=${encodeURIComponent(group.doctorUserId)}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Real Database Insurance & Languages Strip (hidden when unconfigured) */}
      {group.acceptedInsurances.length > 0 ||
      group.languagesSpoken.length > 0 ||
      group.licenseNumber ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2 text-[11px] ring-1 ring-slate-900/[0.05]">
          <div className="flex flex-wrap items-center gap-1">
            {group.acceptedInsurances.length > 0 ? (
              <>
                <span className="font-medium text-slate-500">
                  {copy.cardCoverageLabel}
                </span>
                {group.acceptedInsurances.map((ins) => (
                  <span
                    key={ins}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-slate-700"
                  >
                    {ins}
                  </span>
                ))}
              </>
            ) : group.licenseNumber ? (
              <span className="font-mono-tabular text-[11px] font-medium text-slate-600">
                {copy.cardLicenseLabel} {group.licenseNumber}
              </span>
            ) : null}
          </div>

          {group.languagesSpoken.length > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
              <Languages
                className="h-3.5 w-3.5 text-[#0066CC]"
                aria-hidden="true"
              />
              <span className="font-mono-tabular">
                {formatLanguageCodes(group.languagesSpoken)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Footer Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Clock className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
          {openSlots.length > 0 ? (
            <span>
              {openSlots.length}{" "}
              {openSlots.length === 1
                ? copy.cardOpenSlotSingular
                : copy.cardOpenSlotPlural}{" "}
              · {selectedWeekdayLabel}
            </span>
          ) : (
            <span className="text-slate-500">
              {copy.cardNoOpenWindows} {selectedWeekdayLabel}
            </span>
          )}
        </span>

        {nurseTrack ? (
          <UiButton
            size="sm"
            type="button"
            variant={openSlots.length > 0 ? "primary" : "secondary"}
            onClick={() => onOpenSchedule()}
            className="rounded-full"
          >
            <span>{copy.cardChooseTime}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          </UiButton>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <UiButton
              size="sm"
              type="button"
              variant={openSlots.length > 0 ? "primary" : "secondary"}
              onClick={() => onOpenSchedule(undefined, "IN_PERSON")}
              className="rounded-full"
            >
              <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.visitWorkplace}</span>
            </UiButton>
            {group.telehealthEnabled ? (
              <UiButton
                size="sm"
                type="button"
                variant="outline"
                onClick={() => onOpenSchedule(undefined, "TELEHEALTH")}
                className="rounded-full"
              >
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.videoCall}</span>
              </UiButton>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
