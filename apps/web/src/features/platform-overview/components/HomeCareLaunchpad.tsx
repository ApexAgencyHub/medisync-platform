"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
            className="flex min-h-[52px] items-center gap-3 rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-transform hover:bg-teal-900 active:scale-[0.98]"
          >
            <img
              src="/media/vehicles/ambulance-van.webp"
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-white/25 object-cover"
            />
            <span className="min-w-0 truncate">{t("home.ctaFindCare")}</span>
          </Link>

          <Link
            href="/booking"
            className="flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-teal-700 hover:bg-teal-50/40 active:scale-[0.98]"
          >
            <img
              src="/media/avatars/doctor-female.webp"
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-cover"
            />
            <span className="min-w-0 truncate">{t("home.ctaBookDoctor")}</span>
          </Link>

          <Link
            href="/pharmacy"
            className="flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-teal-700 hover:bg-teal-50/40 active:scale-[0.98]"
          >
            <img
              src="/media/facilities/pharmacy-interior.webp"
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-cover"
            />
            <span className="min-w-0 truncate">{t("home.ctaOrderPharmacy")}</span>
          </Link>

          <Link
            href="/portal"
            className="flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-teal-700 hover:bg-teal-50/40 active:scale-[0.98]"
          >
            <img
              src="/media/facilities/clinic-interior.webp"
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-cover"
            />
            <span className="min-w-0 truncate">{t("home.ctaPortal")}</span>
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <Link
            href="/profiles"
            className="text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline"
          >
            Doctors, Nurses, Clinics &amp; Fleet →
          </Link>
          <Link
            href="/patient"
            className="text-xs font-semibold text-slate-700 hover:text-teal-900 hover:underline"
          >
            My Care &amp; Saved Docs →
          </Link>
        </div>
      </div>
    </div>
  );
}
