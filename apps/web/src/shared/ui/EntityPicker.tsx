"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

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
  const [filterQuery, setFilterQuery] = useState("");

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
          {label}
          {required ? <span className="ml-0.5 text-red-700">*</span> : null}
        </label>
        {selectedItem ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            <span>Clear</span>
          </button>
        ) : null}
      </div>

      {options.length > 4 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={filterQuery}
            disabled={disabled}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={`Search ${label}`}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-800 focus:border-teal-700 focus:bg-white focus:outline-none"
          />
        </div>
      ) : null}

      <select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none disabled:bg-slate-100"
      >
        <option value="">{options.length === 0 ? emptyLabel : `Select ${label}...`}</option>
        {filtered.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.sublabel ? `${opt.label} — ${opt.sublabel}` : opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
