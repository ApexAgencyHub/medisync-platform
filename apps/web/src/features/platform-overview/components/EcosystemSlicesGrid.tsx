"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

const ECOSYSTEM_PORTALS = [
  {
    id: "patient",
    href: "/patient",
    imageSrc: "/media/avatars/patient.webp",
    imageAlt: "Patient care portal",
  },
  {
    id: "doctor",
    href: "/booking",
    imageSrc: "/media/avatars/doctor-female.webp",
    imageAlt: "Medical specialist consultation",
  },
  {
    id: "clinic",
    href: "/profiles",
    imageSrc: "/media/facilities/clinic-interior.webp",
    imageAlt: "Verified medical clinic",
  },
  {
    id: "hospital",
    href: "/map",
    imageSrc: "/media/facilities/hospital-hub.webp",
    imageAlt: "Emergency hospital care center",
  },
  {
    id: "driver",
    href: "/map",
    imageSrc: "/media/vehicles/ambulance-van.webp",
    imageAlt: "Medical ambulance and transport fleet",
  },
  {
    id: "pharmacy",
    href: "/pharmacy",
    imageSrc: "/media/facilities/pharmacy-interior.webp",
    imageAlt: "Dispensing pharmacy storefront",
  },
  {
    id: "lab",
    href: "/clinical",
    imageSrc: "/media/avatars/lab-tech.webp",
    imageAlt: "Diagnostic lab and scans",
  },
  {
    id: "admin",
    href: "/admin",
    imageSrc: "/media/avatars/driver-ems.webp",
    imageAlt: "Operations compliance center",
  },
] as const;

export function EcosystemSlicesGrid() {
  const { t } = useLocale();

  return (
    <section aria-label="Medical Ecosystem Portals" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t("ecosystem.heading")}
          </h2>
          <p className="text-sm text-slate-600">{t("ecosystem.subtitle")}</p>
        </div>
        <span className="font-mono-tabular text-xs font-medium text-teal-800">
          {t("ecosystem.verifiedBadge")}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ECOSYSTEM_PORTALS.map((portal) => {
          const titleKey = `ecosystem.role.${portal.id}.title`;
          const summaryKey = `ecosystem.role.${portal.id}.summary`;
          return (
            <Link
              key={portal.id}
              href={portal.href}
              className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-teal-700/60 hover:bg-slate-50/40 active:scale-[0.99]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <img
                      src={portal.imageSrc}
                      alt={portal.imageAlt}
                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                    />
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-800"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-teal-900">
                  {t(titleKey)}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {t(summaryKey)}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-teal-800">
                <span>{t("ecosystem.openPortal")}</span>
                <span aria-hidden="true">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
