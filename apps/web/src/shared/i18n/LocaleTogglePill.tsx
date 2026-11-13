"use client";

import type { LocaleCode } from "@medisync/contracts";
import { Globe } from "lucide-react";
import { useLocale } from "./locale-store";

const LOCALES: readonly { code: LocaleCode; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

export function LocaleTogglePill() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Interface language selector"
      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      <Globe
        className="mx-1 h-3.5 w-3.5 shrink-0 text-slate-500"
        aria-hidden="true"
      />
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
                ? "rounded-md bg-teal-800 px-2 py-1 text-[11px] font-bold text-white"
                : "rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
