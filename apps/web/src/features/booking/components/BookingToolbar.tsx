"use client";

import type { RefObject } from "react";
import { VisitModeSchema, type CountryPack, type VisitMode } from "@medisync/contracts";
import {
  Calendar,
  Home,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";
import { MOROCCAN_CITIES } from "@/shared/config/morocco-standards";
import type { SpecialtyOption } from "@/shared/i18n/specialties";
import { UiSelect, UiSwitch } from "@/shared/ui/primitives";
import { MoroccanComplianceBadge, TactilePillGroup } from "@/shared/ui/TactileControls";
import { BOOKING_COPY } from "../booking-i18n";
import type { BookingTab, ProviderCategoryFilter } from "./booking-utils";

interface BookingToolbarProps {
  packs: readonly CountryPack[];
  selectedCountry: string;
  selectedDate: string;
  searchQuery: string;
  providerFilter: ProviderCategoryFilter;
  specialtyFilter: string;
  specialtyOptions: readonly SpecialtyOption[];
  visitModeFilter: VisitMode | "ALL";
  cityFilter: string;
  insuranceFilter: string;
  availableInsurances: readonly string[];
  includeBooked: boolean;
  activeTab: BookingTab;
  providerCount: number;
  totalSavedVisits: number;
  rollingDates: ReadonlyArray<{ label: string; sublabel: string; value: string }>;
  filtersOpen: boolean;
  hasPopoverFilter: boolean;
  hasActiveFilter: boolean;
  searchContainerRef: RefObject<HTMLDivElement | null>;
  onSearchChange: (q: string) => void;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  onCountryChange: (countryCode: string) => void;
  onVisitModeChange: (mode: VisitMode | "ALL") => void;
  onProviderFilterChange: (track: ProviderCategoryFilter) => void;
  onSpecialtyFilterChange: (specialty: string) => void;
  onCityFilterChange: (city: string) => void;
  onInsuranceFilterChange: (insurance: string) => void;
  onIncludeBookedChange: (checked: boolean) => void;
  onSelectDate: (isoDate: string) => void;
  onSelectTab: (tab: BookingTab) => void;
  onResetAllFilters: () => void;
}

/** Clinic search, doctor specialty selector, format chips, 5-day rolling calendar strip & view switcher. */
export function BookingToolbar({
  packs,
  selectedCountry,
  selectedDate,
  searchQuery,
  providerFilter,
  specialtyFilter,
  specialtyOptions,
  visitModeFilter,
  cityFilter,
  insuranceFilter,
  availableInsurances,
  includeBooked,
  activeTab,
  providerCount,
  totalSavedVisits,
  rollingDates,
  filtersOpen,
  hasPopoverFilter,
  hasActiveFilter,
  searchContainerRef,
  onSearchChange,
  onToggleFilters,
  onCloseFilters,
  onCountryChange,
  onVisitModeChange,
  onProviderFilterChange,
  onSpecialtyFilterChange,
  onCityFilterChange,
  onInsuranceFilterChange,
  onIncludeBookedChange,
  onSelectDate,
  onSelectTab,
  onResetAllFilters,
}: BookingToolbarProps) {
  const { locale, isRtl } = useLocale();
  const copy = BOOKING_COPY[locale];
  void packs;
  void selectedCountry;
  void onCountryChange;

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 sm:p-5"
    >
      {/* Row 1: Search, More Filters Popover, Practitioner Track, Specialty & View Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          ref={searchContainerRef}
          className="relative flex min-w-0 flex-1 items-center basis-full sm:basis-auto sm:min-w-[230px]"
        >
          <div className="flex h-10 w-full min-w-0 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white ps-3.5 pe-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/15">
            <Search
              className="h-4 w-4 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <input
              id="specialty-filter"
              type="search"
              aria-label={copy.searchAria}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label={copy.clearSearchAria}
                onClick={() => onSearchChange("")}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <span className="h-5 w-px shrink-0 bg-slate-100" aria-hidden="true" />
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-label={copy.toggleOptionsAria}
              onClick={onToggleFilters}
              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                filtersOpen || hasPopoverFilter
                  ? "bg-[#0066CC] text-white"
                  : "text-slate-700 hover:bg-[#E1EBF2]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.optionsLabel}</span>
              {hasPopoverFilter && !filtersOpen ? (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
              ) : null}
            </button>
          </div>

          {filtersOpen ? (
            <div
              role="dialog"
              aria-label={copy.optionsDialogAria}
              className={`absolute top-full z-40 mt-2 w-[min(320px,calc(100vw-2rem))] space-y-3 rounded-2xl border border-slate-200 bg-white/98 p-3.5 shadow-2xl backdrop-blur-xl ${
                isRtl ? "right-0" : "left-0"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {copy.optionsTitle}
                </span>
                <button
                  type="button"
                  aria-label={copy.closeOptionsAria}
                  onClick={onCloseFilters}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <MoroccanComplianceBadge domain="patient" locale={locale} />

              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {locale === "fr"
                    ? "Ville (Maroc)"
                    : locale === "ar"
                      ? "المدينة (المغرب)"
                      : "City (Morocco)"}
                </span>
                <div
                  id="booking-city-filter"
                  role="radiogroup"
                  aria-label={
                    locale === "fr"
                      ? "Filtrer par ville"
                      : locale === "ar"
                        ? "تصفية حسب المدينة"
                        : "Filter by city"
                  }
                  className="flex flex-wrap gap-1.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={cityFilter === ""}
                    onClick={() => onCityFilterChange("")}
                    className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                      cityFilter === ""
                        ? "border-[#0066CC] bg-[#0066CC] text-white"
                        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                    }`}
                  >
                    {locale === "fr"
                      ? "Toutes les villes"
                      : locale === "ar"
                        ? "كل المدن"
                        : "All cities"}
                  </button>
                  {MOROCCAN_CITIES.map((city) => {
                    const selected = cityFilter === city.name;
                    return (
                      <button
                        key={city.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onCityFilterChange(city.name)}
                        className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                          selected
                            ? "border-[#0066CC] bg-[#0066CC] text-white"
                            : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                        }`}
                      >
                        {city.labels[locale]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {availableInsurances.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {copy.insuranceLabel}
                  </span>
                  <div
                    id="booking-insurance-filter"
                    role="radiogroup"
                    aria-label={copy.filterInsuranceAria}
                    className="flex flex-wrap gap-1.5"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={insuranceFilter === ""}
                      onClick={() => onInsuranceFilterChange("")}
                      className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                        insuranceFilter === ""
                          ? "border-[#0066CC] bg-[#0066CC] text-white"
                          : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                      }`}
                    >
                      {copy.allInsurancesOption}
                    </button>
                    {availableInsurances.map((ins) => (
                      <button
                        key={ins}
                        type="button"
                        role="radio"
                        aria-checked={insuranceFilter === ins}
                        onClick={() => onInsuranceFilterChange(ins)}
                        className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                          insuranceFilter === ins
                            ? "border-[#0066CC] bg-[#0066CC] text-white"
                            : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                        }`}
                      >
                        {ins}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <UiSwitch
                  id="booking-include-booked"
                  checked={includeBooked}
                  onChange={onIncludeBookedChange}
                  label={copy.showTakenSlotsLabel}
                />
                {hasActiveFilter ? (
                  <button
                    type="button"
                    onClick={onResetAllFilters}
                    className="text-xs font-semibold text-teal-800 hover:underline"
                  >
                    {copy.resetLabel}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Tactile Practitioner Track Segmented Pill Toggle */}
        <TactilePillGroup
          ariaLabel={copy.practitionerTypeAria}
          size="xs"
          layout="segmented"
          value={providerFilter}
          onChange={(next) => {
            onProviderFilterChange(next);
            if (next === "NURSES") {
              onSpecialtyFilterChange("ALL");
            }
          }}
          options={[
            { value: "ALL", label: copy.allPractitionersOption },
            { value: "DOCTORS", label: copy.doctorsSpecialistsOption },
            { value: "NURSES", label: copy.nursesOption },
          ]}
        />

        {/* Doctor Specialty Dropdown */}
        <UiSelect
          aria-label={copy.specialtyAria}
          selectSize="sm"
          wrapperClassName="min-w-[155px] flex-1 sm:w-[215px] sm:flex-initial shrink-0"
          startIcon={
            <Stethoscope className="h-4 w-4 text-teal-800" aria-hidden="true" />
          }
          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 shadow-2xs hover:border-teal-300"
          value={specialtyFilter}
          onChange={(e) => {
            const next = e.target.value;
            onSpecialtyFilterChange(next);
            if (next !== "ALL") {
              onProviderFilterChange("DOCTORS");
            }
          }}
        >
          <option value="ALL">{copy.allSpecialtiesOption}</option>
          {specialtyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </UiSelect>

        {/* View Switcher: Open Slots vs My Visits */}
        <div
          role="tablist"
          aria-label={copy.viewsAria}
          className="grid h-10 w-full shrink-0 grid-cols-2 items-center rounded-xl bg-white p-1 shadow-2xs sm:ms-auto sm:inline-flex sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "PRACTITIONERS"}
            onClick={() => onSelectTab("PRACTITIONERS")}
            className={`inline-flex h-8 items-center justify-center rounded-full px-3.5 text-xs font-semibold transition ${
              activeTab === "PRACTITIONERS"
                ? "bg-[#0066CC] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            {copy.openSlotsTab} ({providerCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "APPOINTMENTS"}
            onClick={() => onSelectTab("APPOINTMENTS")}
            className={`inline-flex h-8 items-center justify-center rounded-full px-3.5 text-xs font-semibold transition ${
              activeTab === "APPOINTMENTS"
                ? "bg-[#0066CC] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            {copy.myVisitsTab}
            {totalSavedVisits > 0 ? ` (${totalSavedVisits})` : ""}
          </button>
        </div>
      </div>

      {/* Row 2: Direct Visit Format Chips + Rolling 5-Day Clinic Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { value: "ALL", label: copy.allVisitFormats, icon: null },
              {
                value: "IN_PERSON",
                label: copy.visitWorkplace,
                icon: Stethoscope,
              },
              { value: "TELEHEALTH", label: copy.videoCall, icon: Video },
              { value: "HOME_VISIT", label: copy.homeNurse, icon: Home },
            ] as const
          ).map((mode) => {
            const active = visitModeFilter === mode.value;
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onVisitModeChange(
                    mode.value === "ALL"
                      ? "ALL"
                      : VisitModeSchema.parse(mode.value),
                  )
                }
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-[#0066CC] text-white shadow-2xs"
                    : "bg-white text-slate-700 hover:bg-[#E1EBF2] hover:text-[#0066CC]"
                }`}
              >
                {Icon ? (
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? "text-white" : "text-[#0066CC]"}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rolling 5-Day Weekday Strip + Compact Date Input */}
        <div className="flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 sm:w-auto [scrollbar-width:none]">
          {rollingDates.map((preset) => {
            const active = selectedDate === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelectDate(preset.value);
                  onSelectTab("PRACTITIONERS");
                }}
                className={`flex shrink-0 flex-col items-center rounded-xl px-3.5 py-1.5 text-center transition active:scale-[0.98] ${
                  active
                    ? "bg-[#0066CC] text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-[#E1EBF2]"
                }`}
              >
                <span className="text-[11px] font-bold leading-tight">
                  {preset.label}
                </span>
                <span
                  className={`font-mono-tabular text-[10px] leading-tight ${
                    active ? "text-emerald-100" : "text-slate-500"
                  }`}
                >
                  {preset.sublabel}
                </span>
              </button>
            );
          })}

          <label className="relative inline-flex h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.07] hover:bg-emerald-50">
            <Calendar className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
            <input
              id="booking-date"
              aria-label={copy.preferredDateAria}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                  onSelectTab("PRACTITIONERS");
                }
              }}
              className="w-[104px] bg-transparent font-mono-tabular text-[11px] font-semibold text-slate-800 focus:outline-none"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
