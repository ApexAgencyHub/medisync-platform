"use client";

import { Search, Stethoscope, X } from "lucide-react";
import type { SpecialtyOption } from "@/shared/i18n/specialties";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton, UiLinkButton, UiSelect } from "@/shared/ui/primitives";
import type {
  PatientSearchCategory,
  PatientSearchResultItem,
  PatientUiCopy,
} from "../patient-copy";

interface PatientSearchSectionProps {
  copy: PatientUiCopy;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchCategory: PatientSearchCategory;
  onSearchCategoryChange: (cat: PatientSearchCategory) => void;
  specialtyFilter: string;
  onSpecialtyFilterChange: (spec: string) => void;
  specialtyOptions: readonly SpecialtyOption[];
  isSearchActive: boolean;
  filteredResults: readonly PatientSearchResultItem[];
}

/** Plain-language care search bar with specialty filter, category tabs & photo-backed results. */
export function PatientSearchSection({
  copy,
  searchQuery,
  onSearchQueryChange,
  searchCategory,
  onSearchCategoryChange,
  specialtyFilter,
  onSpecialtyFilterChange,
  specialtyOptions,
  isSearchActive,
  filteredResults,
}: PatientSearchSectionProps) {
  return (
    <section
      id="patient-search"
      aria-label={copy.searchHeading}
      className="space-y-3.5 rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6"
    >
      <div className="space-y-0.5">
        <h2 className="text-base font-bold text-[#0F243E]">
          {copy.searchHeading}
        </h2>
        <p className="text-xs text-slate-600">{copy.searchSubheading}</p>
      </div>

      {/* Dedicated Full-Width Search Input + Doctor Specialty Filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex min-h-[42px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-[#D8DFDC] bg-[#F3F8FD] px-3.5 transition-all focus-within:border-[#0066CC] focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-700/15">
          <Search className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchAriaLabel}
            className="min-w-0 flex-1 bg-transparent py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-sm"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              aria-label={copy.clearSearchLabel}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <UiSelect
          aria-label={copy.specialtyFilterLabel}
          selectSize="sm"
          wrapperClassName="w-full sm:w-[235px] shrink-0"
          startIcon={
            <Stethoscope className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
          }
          className="h-[44px] rounded-xl border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-slate-50"
          value={specialtyFilter}
          onChange={(e) => {
            const next = e.target.value;
            onSpecialtyFilterChange(next);
            if (next !== "ALL") {
              onSearchCategoryChange("DOCTOR");
            }
          }}
        >
          <option value="ALL">{copy.allSpecialtiesLabel}</option>
          {specialtyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </UiSelect>
      </div>

      {/* Category Filter Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {copy.filterTabs.map((tab) => {
          const active = searchCategory === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                onSearchCategoryChange(tab.value);
                if (tab.value !== "DOCTOR" && tab.value !== "ALL") {
                  onSpecialtyFilterChange("ALL");
                }
              }}
              className={`min-h-[36px] rounded-xl px-4 text-xs font-semibold transition active:scale-[0.98] ${
                active
                  ? "bg-[#0066CC] text-white shadow-xs"
                  : "bg-white text-slate-700 ring-1 ring-slate-900/[0.06] hover:bg-emerald-50 hover:text-[#0066CC]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!isSearchActive ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            {copy.popularLabel}
          </span>
          {copy.quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onSearchQueryChange(chip.query)}
              className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-[#0066CC] ring-1 ring-slate-900/[0.06] transition hover:bg-[#0066CC] hover:text-white active:scale-[0.98]"
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 text-xs">
          <p className="text-slate-700">
            {copy.noResultsPrefix} &ldquo;
            {searchQuery ||
              (specialtyFilter !== "ALL" ? specialtyFilter : searchCategory)}
            &rdquo;.
          </p>
          <UiButton
            size="sm"
            variant="secondary"
            onClick={() => {
              onSearchQueryChange("");
              onSearchCategoryChange("ALL");
              onSpecialtyFilterChange("ALL");
            }}
          >
            {copy.resetSearchLabel}
          </UiButton>
        </div>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {filteredResults.map((result) => (
            <li
              key={result.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5  transition-all hover:shadow-[0_10px_24px_-8px_rgba(15,23,42,0.12)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {result.avatarName ? (
                  <EntityAvatar
                    name={result.avatarName}
                    {...(result.avatarRole ? { role: result.avatarRole } : {})}
                    {...(result.avatarSpecialty
                      ? { specialty: result.avatarSpecialty }
                      : {})}
                    size="sm"
                  />
                ) : (
                  <div className="h-12 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img
                      src={result.imageSrc}
                      alt={result.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <UiBadge tone={result.badgeTone}>{result.badgeLabel}</UiBadge>
                  <p className="truncate text-sm font-bold text-slate-900">
                    <bdi dir="auto">{result.title}</bdi>
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    <bdi dir="auto">{result.plainHint || result.subtitle}</bdi>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <UiLinkButton href={result.href} size="sm" variant="secondary" pill>
                  {result.ctaLabel}
                </UiLinkButton>
                {result.secondaryHref && result.secondaryCtaLabel ? (
                  <UiLinkButton
                    href={result.secondaryHref}
                    size="sm"
                    variant="outline"
                    pill
                  >
                    {result.secondaryCtaLabel}
                  </UiLinkButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
