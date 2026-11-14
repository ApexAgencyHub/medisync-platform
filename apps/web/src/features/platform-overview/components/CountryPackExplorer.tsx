"use client";

import { useState } from "react";
import type { CountryPack } from "@medisync/contracts";
import { Globe, PhoneCall, ShieldCheck } from "lucide-react";
import {
  formatCoverageHub,
  formatLanguageList,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";

interface CountryPackExplorerProps {
  packs: readonly CountryPack[];
}

export function CountryPackExplorer({ packs }: CountryPackExplorerProps) {
  const { t } = useLocale();
  const [selectedCode, setSelectedCode] = useState<string>(
    packs[0]?.code ?? "INTL",
  );

  const active =
    packs.find((pack) => pack.code === selectedCode) ?? packs[0] ?? null;

  if (!active) return null;

  return (
    <section
      aria-label="Regional Health Standards Switcher"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>{t("country.eyebrow")}</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {t("country.activePrefix")}: <bdi dir="auto">{active.name}</bdi>
          </h2>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Select country pack"
        >
          {packs.map((pack) => {
            const isSelected = pack.code === active.code;
            return (
              <button
                key={pack.code}
                type="button"
                onClick={() => setSelectedCode(pack.code)}
                className={`rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors active:scale-95 ${
                  isSelected
                    ? "border-teal-800 bg-teal-800 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-700 hover:text-teal-800"
                }`}
              >
                {pack.code}
              </button>
            );
          })}
        </div>
      </div>

      <dl
        dir={active.direction}
        className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4"
      >
        <div>
          <dt className="text-xs font-medium text-slate-500">
            {t("country.dirLocale")}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            <bdi dir="auto">{formatLanguageList(active.supportedLocales)}</bdi>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">
            {t("country.emergencyNumbers")}
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 font-mono-tabular text-sm font-semibold text-red-700">
            <PhoneCall className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <bdi dir="ltr">
              {active.emergencyHotlines.ambulance} /{" "}
              {active.emergencyHotlines.generalEmergency}
            </bdi>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">
            {t("country.currencyUnits")}
          </dt>
          <dd
            dir="ltr"
            className="mt-1 font-mono-tabular text-sm font-semibold text-slate-900"
          >
            {active.currencyCode} ·{" "}
            {active.measurementSystem === "metric" ? "Metric" : "Imperial"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">
            {t("country.dataResidency")}
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <bdi dir="auto">
              {formatCoverageHub(active.dataResidencyRegion)}
            </bdi>
          </dd>
        </div>
      </dl>
    </section>
  );
}
