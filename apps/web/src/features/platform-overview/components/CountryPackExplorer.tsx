"use client";

import { useState } from "react";
import type { CountryPack } from "@medisync/contracts";
import { Globe, PhoneCall, ShieldCheck } from "lucide-react";

interface CountryPackExplorerProps {
  packs: readonly CountryPack[];
}

export function CountryPackExplorer({ packs }: CountryPackExplorerProps) {
  const [selectedCode, setSelectedCode] = useState<string>(
    packs[0]?.code ?? "INTL",
  );

  const active =
    packs.find((pack) => pack.code === selectedCode) ?? packs[0] ?? null;

  if (!active) return null;

  return (
    <section
      aria-label="Jurisdiction CountryPack Switcher"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>Sovereign Jurisdiction Adapter</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Active CountryPack: {active.name}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Select country pack">
          {packs.map((pack) => {
            const isSelected = pack.code === active.code;
            return (
              <button
                key={pack.code}
                type="button"
                onClick={() => setSelectedCode(pack.code)}
                className={`rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
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
          <dt className="text-xs font-medium text-slate-500">Direction & Locale</dt>
          <dd className="mt-1 font-mono-tabular text-sm font-semibold text-slate-900">
            {active.direction.toUpperCase()} · {active.defaultLocale}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Ambulance / Emergency</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-mono-tabular text-sm font-semibold text-red-700">
            <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {active.emergencyHotlines.ambulance} /{" "}
              {active.emergencyHotlines.generalEmergency}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Currency & Units</dt>
          <dd className="mt-1 font-mono-tabular text-sm font-semibold text-slate-900">
            {active.currencyCode} · {active.measurementSystem}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Data Residency</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-mono-tabular text-sm font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{active.dataResidencyRegion}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
