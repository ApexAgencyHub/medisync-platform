"use client";

import Link from "next/link";
import type { CountryPack } from "@medisync/contracts";
import { ArrowRight } from "lucide-react";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import { formatCountryDisplayName } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { LocaleTogglePill } from "@/shared/i18n/LocaleTogglePill";

interface CountryPackExplorerProps {
  packs: readonly CountryPack[];
}

export function CountryPackExplorer({ packs }: CountryPackExplorerProps) {
  const { locale, t, isRtl } = useLocale();
  const activePack = resolveActivePack(packs);
  const countryCode = activePack?.code ?? ACTIVE_COUNTRY_CODE;
  const countryDisplayName = activePack
    ? formatCountryDisplayName(activePack.code, activePack.name, locale)
    : "Morocco";

  const partnerCtaLabel =
    locale === "fr"
      ? "Rejoindre comme Partenaire / Chauffeur"
      : locale === "ar"
        ? "انضم كشريك طبي أو سائق"
        : "Join as Medical Partner / Driver";

  return (
    <footer
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={t("country.eyebrow")}
      className="border-t border-[#D7E4F2] bg-white text-[#0F243E]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-[#0F243E]">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#0F9D88]"
            />
            <span>
              {t("country.activePrefix")}: {countryDisplayName}
            </span>
          </span>
          <span aria-hidden="true" className="text-[#B7CDE4]">
            ·
          </span>
          <LocaleTogglePill ariaLabel="Regional language selector" />
          {activePack ? (
            <>
              <span aria-hidden="true" className="text-[#B7CDE4]">
                ·
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[#DC2626] ring-1 ring-rose-200">
                <span>
                  {locale === "fr"
                    ? "Urgences:"
                    : locale === "ar"
                      ? "الطوارئ:"
                      : "Emergency:"}
                </span>
                <strong dir="ltr" className="font-bold">
                  {activePack.emergencyHotlines.ambulance} /{" "}
                  {activePack.emergencyHotlines.generalEmergency}
                </strong>
              </span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs font-medium text-[#4A627D]">
          <Link href={`/map?country=${countryCode}`} className="hover:text-[#0066CC]">
            {t("nav.map")}
          </Link>
          <Link href={`/booking?country=${countryCode}`} className="hover:text-[#0066CC]">
            {t("nav.booking")}
          </Link>
          <Link href={`/pharmacy?country=${countryCode}`} className="hover:text-[#0066CC]">
            {t("nav.pharmacy")}
          </Link>
          <Link href="/profiles" className="hover:text-[#0066CC]">
            {t("nav.profiles")}
          </Link>
          <Link href="/portal" className="hover:text-[#0066CC]">
            {t("nav.portal")}
          </Link>
          <Link
            href="/pro"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 py-2 font-semibold text-white shadow-xs hover:bg-[#0052A3]"
          >
            <span>{partnerCtaLabel}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
