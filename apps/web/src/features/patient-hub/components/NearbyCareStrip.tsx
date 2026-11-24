"use client";

import Link from "next/link";
import type {
  DirectoryDoctorSummary,
  DirectoryFacilitySummary,
  LocaleCode,
} from "@medisync/contracts";
import { ArrowRight, MapPin, Stethoscope, Video } from "lucide-react";
import { isNursingSpecialty } from "@/shared/config/morocco-standards";
import { UiBadge } from "@/shared/ui/primitives";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
} from "@/shared/ui/EntityAvatar";
import { formatPlainSpecialty, type PatientUiCopy } from "../patient-copy";

interface NearbyCareStripProps {
  copy: PatientUiCopy;
  locale: LocaleCode;
  doctors: readonly DirectoryDoctorSummary[];
  facilities: readonly DirectoryFacilitySummary[];
}

function isNurseRole(item: Pick<DirectoryDoctorSummary, "role" | "specialty">): boolean {
  return item.role === "NURSE" || isNursingSpecialty(item.specialty);
}

/** Shows real verified clinicians & nearby open clinics/pharmacies with borderless sky-ice studio portrait frames. */
export function NearbyCareStrip({
  copy,
  locale,
  doctors,
  facilities,
}: NearbyCareStripProps) {
  const featuredClinicians = doctors.slice(0, 4);
  const featuredFacilities = facilities.slice(0, 3);

  if (featuredClinicians.length === 0 && featuredFacilities.length === 0) {
    return null;
  }

  return (
    <section
      id="patient-nearby"
      aria-label={copy.nearbyTitle}
      className="space-y-4 py-2"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
            {copy.nearbyTitle}
          </h2>
          <p className="text-xs text-slate-600">{copy.nearbySubtitle}</p>
        </div>

        <Link
          href="/profiles"
          className="inline-flex items-center gap-1 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-4 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-[#E1EBF2]"
        >
          <span>{copy.nearbyBrowseAll}</span>
          <ArrowRight
            className="h-3.5 w-3.5 rtl:rotate-180"
            aria-hidden="true"
          />
        </Link>
      </div>

      {featuredClinicians.length > 0 ? (
        <div
          className={`grid gap-4 ${
            featuredClinicians.length === 1
              ? "grid-cols-1"
              : featuredClinicians.length === 2
                ? "sm:grid-cols-2"
                : featuredClinicians.length === 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {featuredClinicians.map((doc) => {
            const isNurse = isNurseRole(doc);
            const plainSpecialty = formatPlainSpecialty(doc.specialty, locale);
            const portraitSrc =
              doc.avatarUrl ??
              resolveDefaultAvatar(
                doc.fullName,
                doc.role ?? (isNurse ? "NURSE" : "DOCTOR"),
                doc.specialty,
              );
            const workplaceHref = isNurse
              ? `/booking?doctorId=${encodeURIComponent(doc.id)}&provider=nurse`
              : `/booking?doctorId=${encodeURIComponent(doc.id)}&mode=IN_PERSON`;
            const videoHref = `/booking?doctorId=${encodeURIComponent(doc.id)}&mode=TELEHEALTH`;
            return (
              <article
                key={doc.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#EEF4FB] p-2.5 transition hover:bg-[#E5EEF9]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#E3ECFA]">
                  <img
                    src={portraitSrc}
                    alt={doc.fullName}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="-mt-6 relative z-10 flex flex-1 flex-col justify-between gap-2.5 rounded-xl bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-bold text-slate-950">
                      <bdi dir="auto">{doc.fullName}</bdi>
                    </p>
                    <p className="text-xs font-semibold text-[#0066CC]">
                      <bdi dir="auto">{plainSpecialty}</bdi>
                    </p>
                    {doc.facilityName ? (
                      <p className="truncate text-[11px] text-slate-500">
                        <bdi dir="auto">{doc.facilityName}</bdi>
                      </p>
                    ) : null}
                  </div>

                  {isNurse ? (
                    <Link
                      href={workplaceHref}
                      className="inline-flex min-h-[36px] w-full items-center justify-center rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.99]"
                    >
                      {copy.requestNurseLabel}
                    </Link>
                  ) : (
                    <div
                      className={`grid gap-1.5 ${
                        doc.telehealthEnabled
                          ? "grid-cols-1 sm:grid-cols-2"
                          : "grid-cols-1"
                      }`}
                    >
                      <Link
                        href={workplaceHref}
                        className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl bg-[#0066CC] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.99]"
                      >
                        <Stethoscope className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{copy.visitWorkplaceLabel}</span>
                      </Link>
                      {doc.telehealthEnabled ? (
                        <Link
                          href={videoHref}
                          className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-[#0066CC] transition hover:bg-[#0066CC] hover:text-white active:scale-[0.99]"
                        >
                          <Video className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{copy.videoCallLabel}</span>
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {featuredFacilities.length > 0 ? (
        <div
          className={`grid gap-3 pt-1 ${
            featuredFacilities.length === 1
              ? "grid-cols-1"
              : featuredFacilities.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {featuredFacilities.map((fac) => {
            const isPharmacy = fac.kind === "PHARMACY";
            const href = isPharmacy
              ? `/pharmacy?facilityId=${encodeURIComponent(fac.id)}`
              : `/map?layer=${encodeURIComponent(fac.kind)}&facilityId=${encodeURIComponent(fac.id)}`;
            return (
              <Link
                key={fac.id}
                href={href}
                className="group flex items-center gap-3 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3 transition hover:bg-[#E1EBF2] active:scale-[0.99]"
              >
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                  <img
                    src={resolveFacilityPicture(fac.kind)}
                    alt={fac.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {fac.openStatus === "OPEN" ? (
                      <UiBadge tone="emerald" className="text-[10px]">
                        {copy.openNowLabel}
                      </UiBadge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs font-bold text-slate-950 sm:text-sm">
                    <bdi dir="auto">{fac.name}</bdi>
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      <bdi dir="auto">{fac.address}</bdi>
                    </span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
