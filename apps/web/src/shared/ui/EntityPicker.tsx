"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

const PICKER_LABELS = {
  en: {
    clear: "Clear",
    change: "Change",
    done: "Done",
    noMatches: "No matching records",
    searchAria: (label: string) => `Search ${label}`,
    selectPrompt: (label: string) => `Select ${label}...`,
  },
  fr: {
    clear: "Effacer",
    change: "Changer",
    done: "OK",
    noMatches: "Aucun résultat",
    searchAria: (label: string) => `Rechercher : ${label}`,
    selectPrompt: (label: string) => `Choisir ${label}...`,
  },
  ar: {
    clear: "مسح",
    change: "تغيير",
    done: "تم",
    noMatches: "لا توجد نتائج مطابقة",
    searchAria: (label: string) => `البحث في ${label}`,
    selectPrompt: (label: string) => `اختر ${label}...`,
  },
} as const;

export interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface EntityPickerProps {
  id: string;
  label: string;
  placeholder: string;
  emptyLabel: string;
  options: readonly EntityOption[];
  value: string;
  onChange: (nextId: string) => void;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Modern tactile visual selector replacing legacy select dropdowns.
 * - Up to 6 options: direct 1-tap visual pills/cards.
 * - More than 6 options: interactive selected pill + live searchable card drawer.
 * - Synchronized native <select> preserves <label htmlFor>, FormData, and automation contracts.
 */
export function EntityPicker({
  id,
  label,
  placeholder,
  emptyLabel,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
}: EntityPickerProps) {
  const { locale } = useLocale();
  const p = PICKER_LABELS[locale] ?? PICKER_LABELS.en;
  const [filterQuery, setFilterQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [options, filterQuery]);

  const selectedItem = options.find((opt) => opt.id === value) ?? null;
  const compactMode = options.length > 6;

  return (
    <div className="relative space-y-1.5">
      {/* Synchronized native select for label association, FormData, and automation parity */}
      <select
        id={id}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute top-0 left-0 h-1 w-1 opacity-0"
      >
        <option value="">
          {options.length === 0 ? emptyLabel : p.selectPrompt(label)}
        </option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.sublabel ? `${opt.label} — ${opt.sublabel}` : opt.label}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-semibold text-[#0F243E]">
          {label}
          {required ? <span className="ms-0.5 text-[#DC2626]">*</span> : null}
        </label>
        {selectedItem ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setFilterQuery("");
            }}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#6B829D] transition hover:text-[#0F243E]"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            <span>{p.clear}</span>
          </button>
        ) : null}
      </div>

      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBDDF0] bg-[#F3F8FD] px-3 py-2 text-xs text-[#6B829D]">
          {emptyLabel}
        </div>
      ) : !compactMode ? (
        <div
          role="listbox"
          aria-label={label}
          aria-required={required || undefined}
          className="flex flex-wrap gap-1.5"
        >
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                onClick={() => onChange(opt.id)}
                className={`group flex min-h-[38px] max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-start transition active:scale-[0.98] disabled:opacity-50 ${
                  active
                    ? "border-[#0066CC] bg-[#0066CC] text-white shadow-xs"
                    : "border-[#D7E4F2] bg-white text-[#0F243E] hover:border-[#0066CC] hover:bg-[#F3F8FD]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    <bdi dir="auto">{opt.label}</bdi>
                  </span>
                  {opt.sublabel ? (
                    <span
                      className={`block truncate text-[10.5px] ${
                        active ? "text-white/80" : "text-[#6B829D]"
                      }`}
                    >
                      <bdi dir="auto">{opt.sublabel}</bdi>
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Selected visual chip or trigger button */}
          <button
            type="button"
            disabled={disabled}
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-start transition disabled:opacity-50 ${
              selectedItem
                ? "border-[#0066CC]/40 bg-[#EBF4FF] text-[#0F243E]"
                : "border-[#CBDDF0] bg-white text-[#4A627D] hover:border-[#0066CC]"
            }`}
          >
            <div className="min-w-0 flex-1">
              {selectedItem ? (
                <>
                  <p className="truncate text-xs font-bold text-[#0F243E]">
                    <bdi dir="auto">{selectedItem.label}</bdi>
                  </p>
                  {selectedItem.sublabel ? (
                    <p className="truncate text-[10.5px] text-[#4A627D]">
                      <bdi dir="auto">{selectedItem.sublabel}</bdi>
                    </p>
                  ) : null}
                </>
              ) : (
                <span className="text-xs font-medium text-[#6B829D]">
                  {p.selectPrompt(label)}
                </span>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#0066CC]">
              <span>{expanded ? p.done : selectedItem ? p.change : ""}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </span>
          </button>

          {expanded ? (
            <div className="space-y-2 rounded-xl border border-[#CBDDF0] bg-white p-2.5 shadow-[0_12px_28px_-12px_rgba(15,36,62,0.16)]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 start-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#6B829D]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={filterQuery}
                  disabled={disabled}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={placeholder}
                  aria-label={p.searchAria(label)}
                  className="w-full rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] py-1.5 pe-3 ps-8 text-xs text-[#0F243E] placeholder:text-[#7D96B2] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-[#6B829D]">
                  {p.noMatches}
                </p>
              ) : (
                <div
                  role="listbox"
                  aria-label={label}
                  className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2"
                >
                  {filtered.map((opt) => {
                    const active = opt.id === value;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(opt.id);
                          setExpanded(false);
                          setFilterQuery("");
                        }}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-start transition ${
                          active
                            ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                            : "border-[#E8F1FA] bg-[#F8FBFF] text-[#0F243E] hover:border-[#0066CC] hover:bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">
                            <bdi dir="auto">{opt.label}</bdi>
                          </p>
                          {opt.sublabel ? (
                            <p className="truncate text-[10.5px] text-[#6B829D]">
                              <bdi dir="auto">{opt.sublabel}</bdi>
                            </p>
                          ) : null}
                        </div>
                        {active ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
