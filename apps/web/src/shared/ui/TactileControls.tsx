"use client";

import type { ReactNode } from "react";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import type { LocaleCode } from "@medisync/contracts";
import {
  MOROCCAN_REGULATION_BADGES,
  type MoroccanComplianceDomain,
} from "../config/morocco-standards";

export interface TactilePillOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string | undefined;
  icon?: ReactNode | undefined;
  badge?: string | undefined;
  disabled?: boolean | undefined;
}

export function TactilePillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  id,
  size = "sm",
  tone = "blue",
  layout = "wrap",
  className = "",
}: {
  options: readonly TactilePillOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  id?: string;
  size?: "xs" | "sm" | "md";
  tone?: "blue" | "teal" | "ink" | "amber" | "rose";
  layout?: "wrap" | "segmented" | "grid2" | "grid3" | "grid4";
  className?: string;
}) {
  const activeStyle =
    tone === "teal"
      ? "border-[#0F9D88] bg-[#0F9D88] text-white shadow-xs"
      : tone === "ink"
        ? "border-[#0F243E] bg-[#0F243E] text-white shadow-xs"
        : tone === "amber"
          ? "border-amber-600 bg-amber-600 text-white shadow-xs"
          : tone === "rose"
            ? "border-[#DC2626] bg-[#DC2626] text-white shadow-xs"
            : "border-[#0066CC] bg-[#0066CC] text-white shadow-xs";

  const sizeClass =
    size === "xs"
      ? "min-h-[30px] px-2.5 py-1 text-[11px]"
      : size === "md"
        ? "min-h-[40px] px-3.5 py-2 text-xs"
        : "min-h-[34px] px-3 py-1.5 text-xs";

  const containerClass =
    layout === "segmented"
      ? "inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1"
      : layout === "grid2"
        ? "grid grid-cols-2 gap-2"
        : layout === "grid3"
          ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
          : layout === "grid4"
            ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
            : "flex flex-wrap items-center gap-1.5";

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`${containerClass} ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${sizeClass} ${
              selected
                ? activeStyle
                : layout === "segmented"
                  ? "border-transparent bg-transparent text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                  : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC] hover:bg-[#F3F8FD]"
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span className="truncate">{opt.label}</span>
            {opt.badge ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-[#E8F1FA] text-[#0052A3]"
                }`}
              >
                {opt.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ClinicalStepper({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
  decimals = 0,
  presets,
  tone = "default",
  placeholder,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  presets?: readonly { label: string; value: string }[];
  tone?: "default" | "alert";
  placeholder?: string;
}) {
  const numeric = Number.parseFloat(value.replace(",", "."));
  const hasNum = Number.isFinite(numeric);

  function nudge(delta: number) {
    const base = hasNum ? numeric : min;
    const clamped = Math.min(max, Math.max(min, base + delta));
    if (decimals > 0) {
      onChange(clamped.toFixed(decimals));
    } else if (!Number.isInteger(clamped)) {
      const normalized = Number(clamped.toFixed(2));
      onChange(
        Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2),
      );
    } else {
      onChange(String(Math.round(clamped)));
    }
  }

  return (
    <div
      className={`rounded-xl border p-2.5 transition-colors ${
        tone === "alert"
          ? "border-rose-300 bg-rose-50/70"
          : "border-[#D7E4F2] bg-[#F3F8FD]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <label
          htmlFor={id}
          className={`text-[11px] font-semibold ${
            tone === "alert" ? "text-rose-800" : "text-[#4A627D]"
          }`}
        >
          {label}
        </label>
        {unit ? (
          <span className="text-[10px] font-semibold text-[#6B829D]">{unit}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => nudge(-step)}
          aria-label={`Decrease ${label}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D7E4F2] bg-white text-[#0F243E] transition hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-8 min-w-0 flex-1 rounded-lg border bg-white px-2 text-center font-mono-tabular text-xs font-bold focus:outline-none focus:ring-2 ${
            tone === "alert"
              ? "border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20"
              : "border-[#CBDDF0] text-[#0F243E] focus:border-[#0066CC] focus:ring-[#0066CC]/18"
          }`}
        />
        <button
          type="button"
          onClick={() => nudge(step)}
          aria-label={`Increase ${label}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D7E4F2] bg-white text-[#0F243E] transition hover:border-[#0066CC] hover:text-[#0066CC] active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {presets && presets.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {presets.map((p) => {
            const active = value === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={`rounded-md px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold transition ${
                  active
                    ? "bg-[#0066CC] text-white"
                    : "bg-white text-[#4A627D] ring-1 ring-[#D7E4F2] hover:border-[#0066CC] hover:text-[#0066CC]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MoroccanComplianceBadge({
  domain,
  locale,
  className = "",
}: {
  domain: MoroccanComplianceDomain;
  locale: LocaleCode;
  className?: string;
}) {
  const label = MOROCCAN_REGULATION_BADGES[domain][locale];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-1 text-[11px] font-semibold text-[#0B6B5C] ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0F9D88]" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
