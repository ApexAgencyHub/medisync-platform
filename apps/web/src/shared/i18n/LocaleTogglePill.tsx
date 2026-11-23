"use client";

import type { LocaleCode } from "@medisync/contracts";
import { useLocale } from "./locale-store";

const LOCALES: readonly {
  code: LocaleCode;
  label: string;
  directionHint: string;
}[] = [
  { code: "en", label: "English", directionHint: "Left to right" },
  { code: "fr", label: "Français", directionHint: "Gauche à droite" },
  { code: "ar", label: "العربية", directionHint: "من اليمين إلى اليسار" },
];

export function LocaleTogglePill({
  ariaLabel = "Interface language selector",
}: {
  variant?: "light" | "dark";
  ariaLabel?: string;
}) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1"
    >
      {LOCALES.map((item) => {
        const active = item.code === locale;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code)}
            aria-pressed={active}
            title={item.directionHint}
            className={
              active
                ? "flex min-h-[32px] items-center justify-center rounded-lg bg-[#0066CC] px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
                : "flex min-h-[32px] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-[#4A627D] transition-colors hover:bg-white hover:text-[#0F243E]"
            }
          >
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
