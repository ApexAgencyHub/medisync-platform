"use client";

import Link from "next/link";
import {
  Activity,
  Ambulance,
  ArrowUpRight,
  Building2,
  FlaskConical,
  Pill,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

const ECOSYSTEM_PORTALS = [
  {
    id: "patient",
    href: "/booking",
    icon: Users,
  },
  {
    id: "doctor",
    href: "/clinical",
    icon: Stethoscope,
  },
  {
    id: "clinic",
    href: "/booking",
    icon: Building2,
  },
  {
    id: "hospital",
    href: "/map",
    icon: Activity,
  },
  {
    id: "driver",
    href: "/map",
    icon: Ambulance,
  },
  {
    id: "pharmacy",
    href: "/pharmacy",
    icon: Pill,
  },
  {
    id: "lab",
    href: "/clinical",
    icon: FlaskConical,
  },
  {
    id: "admin",
    href: "/admin",
    icon: ShieldAlert,
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
          const Icon = portal.icon;
          const titleKey = `ecosystem.role.${portal.id}.title`;
          const summaryKey = `ecosystem.role.${portal.id}.summary`;
          return (
            <Link
              key={portal.id}
              href={portal.href}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-teal-700/60 hover:bg-slate-50/40 active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-800"
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
