"use client";

import type { LocaleCode } from "@medisync/contracts";
import { Check, Globe } from "lucide-react";
import { useLocale } from "./locale-store";

const LOCALES: readonly {
  code: LocaleCode;
  badge: string;
  label: string;
  directionHint: string;
}[] = [
  { code: "en", badge: "EN", label: "English", directionHint: "Left to right" },
  { code: "fr", badge: "FR", label: "Français", directionHint: "Gauche à droite" },
  { code: "ar", badge: "AR", label: "العربية", directionHint: "من اليمين إلى اليسار" },
];

/** Sidebar language selector displaying full native language names and direction hints. */
export function LocaleTogglePill() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Interface language selector"
      className="space-y-1.5"
    >
      {LOCALES.map((item) => {
        const active = item.code === locale;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code)}
            aria-pressed={active}
            className={
              active
                ? "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-teal-700 bg-teal-50 px-3 py-2 text-start text-teal-950 shadow-xs"
                : "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-start text-slate-700 transition-colors hover:border-teal-700/60 hover:bg-slate-50"
            }
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={
                  active
                    ? "inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-800 font-mono-tabular text-[11px] font-bold text-white"
                    : "inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono-tabular text-[11px] font-bold text-slate-700"
                }
              >
                {item.badge}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {item.directionHint}
                </p>
              </div>
            </div>
            {active ? (
              <Check className="h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
            ) : (
              <Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
