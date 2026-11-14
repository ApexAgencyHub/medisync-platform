"use client";

import Link from "next/link";
import {
  CalendarCheck2,
  MapPin,
  Pill,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

export function HomeCareLaunchpad() {
  const { t } = useLocale();

  return (
    <div className="space-y-5 lg:col-span-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3 py-1 text-xs font-semibold text-teal-900">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t("home.eyebrow")}</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {t("home.title")}
      </h1>

      <p className="text-base leading-relaxed text-slate-600">
        {t("home.subtitle")}
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Link
            href="/map"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-transform hover:bg-teal-900 active:scale-[0.98]"
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("home.ctaFindCare")}</span>
          </Link>

          <Link
            href="/booking"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:bg-teal-50/40 active:scale-[0.98]"
          >
            <CalendarCheck2
              className="h-4 w-4 shrink-0 text-teal-800"
              aria-hidden="true"
            />
            <span>{t("home.ctaBookDoctor")}</span>
          </Link>

          <Link
            href="/pharmacy"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:bg-teal-50/40 active:scale-[0.98]"
          >
            <Pill
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>{t("home.ctaOrderPharmacy")}</span>
          </Link>

          <Link
            href="/portal"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 active:scale-[0.98]"
          >
            <UserCheck
              className="h-4 w-4 shrink-0 text-slate-700"
              aria-hidden="true"
            />
            <span>{t("home.ctaPortal")}</span>
          </Link>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-2.5 text-center sm:text-start">
          <Link
            href="/profiles"
            className="text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline"
          >
            Browse Doctors, Nurses (Infirmiers), Clinics &amp; Medical Vehicles →
          </Link>
        </div>
      </div>
    </div>
  );
}
