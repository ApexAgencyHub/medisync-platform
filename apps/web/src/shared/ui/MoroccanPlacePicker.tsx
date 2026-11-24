"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Navigation, Search, X } from "lucide-react";
import {
  MOROCCAN_CITIES_CATALOG,
  MOROCCAN_REGIONS,
  findMoroccanCity,
  searchMoroccanLocations,
  type MoroccanLocationMatch,
  type MoroccanRegionCode,
} from "@medisync/country-packs";
import { useLocale } from "../i18n/locale-store";

export interface MoroccanPlacePickerProps {
  /** Selected city name (e.g. "Casablanca" / "Fès") or city ID (e.g. "casablanca"), or "" for all cities */
  value: string;
  /** Optional custom label shown on trigger when a neighborhood/place is active */
  displayLabel?: string | undefined;
  /** Whether an "All Morocco" option is available (for directory/booking/pharmacy filters) */
  allowAll?: boolean;
  /** Whether clicking also surfaces Moroccan neighborhoods/places alongside cities */
  includePlaces?: boolean;
  /** Callback when a city or place is selected (null when "All Morocco" is chosen) */
  onSelect: (match: MoroccanLocationMatch | null) => void;
  /** Accessible label for the trigger button */
  ariaLabel?: string;
  /** Popover alignment relative to trigger */
  align?: "start" | "end";
  /** Compact pill style for floating map bars vs standard toolbar button */
  variant?: "toolbar" | "pill";
  className?: string;
}

function cityToMatch(cityId: string): MoroccanLocationMatch | null {
  const city = findMoroccanCity(cityId);
  if (!city) return null;
  return {
    id: city.id,
    kind: "CITY",
    cityId: city.id,
    cityName: city.name,
    cityLabels: city.labels,
    name: city.name,
    labels: city.labels,
    regionCode: city.regionCode,
    region: city.region,
    districtLabel: city.districtLabel,
    lat: city.lat,
    lng: city.lng,
    bbox: city.bbox,
  };
}

export function MoroccanPlacePicker({
  value,
  displayLabel,
  allowAll = true,
  includePlaces = true,
  onSelect,
  ariaLabel,
  align = "end",
  variant = "toolbar",
  className = "",
}: MoroccanPlacePickerProps) {
  const { locale, isRtl } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<
    MoroccanRegionCode | "ALL"
  >("ALL");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const copy =
    locale === "ar"
      ? {
          allMorocco: "كل مدن المغرب",
          allRegions: "كل الجهات (12)",
          searchPlaceholder: "ابحث عن مدينة أو حي (الدار البيضاء، وجدة، المعاريف...)",
          placeTag: "حي / منطقة",
          cityTag: "مدينة",
          noResults: "لا توجد مدينة أو منطقة مطابقة.",
          citiesCount: `${MOROCCAN_CITIES_CATALOG.length} مدينة`,
          defaultAria: "اختيار المدينة أو المنطقة في المغرب",
        }
      : locale === "fr"
        ? {
            allMorocco: "Tout le Maroc",
            allRegions: "12 régions",
            searchPlaceholder: "Ville ou quartier (Oujda, Maarif, Dakhla, Tétouan...)",
            placeTag: "Quartier",
            cityTag: "Ville",
            noResults: "Aucune ville ou lieu trouvé.",
            citiesCount: `${MOROCCAN_CITIES_CATALOG.length} villes`,
            defaultAria: "Choisir une ville ou un lieu au Maroc",
          }
        : {
            allMorocco: "All Morocco",
            allRegions: "All 12 Regions",
            searchPlaceholder: "City or place (Oujda, Maarif, Dakhla, Tetouan...)",
            placeTag: "District",
            cityTag: "City",
            noResults: "No matching Moroccan city or place.",
            citiesCount: `${MOROCCAN_CITIES_CATALOG.length} cities`,
            defaultAria: "Select Moroccan city or place",
          };

  const activeCity = useMemo(
    () => (value ? findMoroccanCity(value) : undefined),
    [value],
  );

  const triggerText =
    displayLabel ||
    (activeCity ? activeCity.labels[locale] : value || copy.allMorocco);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      const matches = searchMoroccanLocations(trimmed, 24);
      return includePlaces
        ? matches
        : matches.filter((item) => item.kind === "CITY");
    }

    const cities =
      selectedRegion === "ALL"
        ? MOROCCAN_CITIES_CATALOG
        : MOROCCAN_CITIES_CATALOG.filter((c) => c.regionCode === selectedRegion);

    return cities
      .map((c) => cityToMatch(c.id))
      .filter((m): m is MoroccanLocationMatch => m !== null);
  }, [query, selectedRegion, includePlaces]);

  const activeRegionCitiesPlaces = useMemo(() => {
    if (!includePlaces || query.trim().length > 0 || !activeCity) return [];
    return activeCity.places.map<MoroccanLocationMatch>((p) => ({
      id: p.id,
      kind: "PLACE",
      cityId: activeCity.id,
      cityName: activeCity.name,
      cityLabels: activeCity.labels,
      name: p.name,
      labels: p.labels,
      regionCode: activeCity.regionCode,
      region: activeCity.region,
      districtLabel: `${p.name}, ${activeCity.name}`,
      lat: p.lat,
      lng: p.lng,
      bbox: {
        minLng: Number((p.lng - 0.022).toFixed(4)),
        minLat: Number((p.lat - 0.015).toFixed(4)),
        maxLng: Number((p.lng + 0.022).toFixed(4)),
        maxLat: Number((p.lat + 0.015).toFixed(4)),
      },
    }));
  }, [includePlaces, query, activeCity]);

  const isSelected = Boolean(value);

  const triggerBase =
    variant === "pill"
      ? `inline-flex h-8 shrink-0 items-center justify-between gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors active:scale-[0.98] ${
          isSelected
            ? "border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3]"
            : "border-[#D7E4F2] bg-[#F3F8FD] text-[#0F243E] hover:border-[#0066CC]"
        }`
      : `inline-flex h-9 shrink-0 items-center justify-between gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-[0.98] ${
          isSelected
            ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
            : "border-[#D7E4F2] bg-white text-[#0F243E] hover:border-[#0066CC]"
        }`;

  return (
    <div
      ref={containerRef}
      dir={isRtl ? "rtl" : "ltr"}
      className={`relative shrink-0 ${className}`}
    >
      <button
        type="button"
        aria-label={ariaLabel ?? copy.defaultAria}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={`${triggerBase} max-w-[190px]`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
        <span className="truncate">{triggerText}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#6B829D] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel ?? copy.defaultAria}
          className={`absolute top-full z-[60] mt-1.5 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#CBDDF0] bg-white text-[#0F243E] shadow-[0_20px_48px_-14px_rgba(15,36,62,0.24)] ${
            align === "start" ? "start-0" : "end-0"
          }`}
        >
          {/* Search Input */}
          <div className="border-b border-[#E8F1FA] bg-[#F8FBFE] p-2.5">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-[#0066CC]"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-9 w-full rounded-xl border border-[#CBDDF0] bg-white ps-8 pe-8 text-xs font-medium text-[#0F243E] placeholder:text-[#7D96B2] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/15"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute end-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6B829D] hover:bg-[#E8F1FA] hover:text-[#0F243E]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* Region Filter Chips (only when not actively typing a search) */}
            {!query.trim() ? (
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                <button
                  type="button"
                  onClick={() => setSelectedRegion("ALL")}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    selectedRegion === "ALL"
                      ? "bg-[#0066CC] text-white"
                      : "bg-white text-[#4A627D] ring-1 ring-[#D7E4F2] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
                  }`}
                >
                  {copy.allRegions}
                </button>
                {MOROCCAN_REGIONS.map((reg) => {
                  const active = selectedRegion === reg.code;
                  return (
                    <button
                      key={reg.code}
                      type="button"
                      onClick={() => setSelectedRegion(reg.code)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? "bg-[#0066CC] text-white"
                          : "bg-white text-[#4A627D] ring-1 ring-[#D7E4F2] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
                      }`}
                    >
                      {reg.labels[locale]}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Active City Neighborhoods Quick Strip */}
          {activeRegionCitiesPlaces.length > 0 ? (
            <div className="border-b border-[#E8F1FA] bg-[#F3F8FD]/70 px-2.5 py-2">
              <p className="mb-1.5 text-[10.5px] font-semibold text-[#556E89]">
                {activeCity?.labels[locale]} — {copy.placeTag}
              </p>
              <div className="flex flex-wrap gap-1">
                {activeRegionCitiesPlaces.slice(0, 8).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => {
                      onSelect(place);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[#CBDDF0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#0F243E] hover:border-[#0066CC] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
                  >
                    <Navigation className="h-2.5 w-2.5 text-[#0066CC]" aria-hidden="true" />
                    <span>{place.labels[locale]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Results List */}
          <div className="max-h-[268px] overflow-y-auto p-1.5 [scrollbar-width:thin]">
            {allowAll && !query.trim() ? (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                  setQuery("");
                }}
                className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-xs font-semibold transition-colors ${
                  !value
                    ? "bg-[#EBF4FF] text-[#0052A3]"
                    : "text-[#0F243E] hover:bg-[#F3F8FD]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                  <span>{copy.allMorocco}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#6B829D]">
                  <span>{copy.citiesCount}</span>
                  {!value ? (
                    <Check className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            ) : null}

            {searchResults.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-[#6B829D]">
                {copy.noResults}
              </p>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((item) => {
                  const selected =
                    item.kind === "CITY" &&
                    activeCity?.id === item.cityId &&
                    !displayLabel;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-start transition-colors ${
                        selected
                          ? "bg-[#EBF4FF] text-[#0052A3]"
                          : "text-[#0F243E] hover:bg-[#F3F8FD]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">
                          <bdi dir="auto">{item.labels[locale]}</bdi>
                        </span>
                        <span className="block truncate text-[10.5px] text-[#6B829D]">
                          {item.kind === "PLACE"
                            ? `${item.cityLabels[locale]} · ${item.region}`
                            : item.region}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            item.kind === "PLACE"
                              ? "bg-[#E6F7F4] text-[#0B6B5C]"
                              : "bg-[#F3F8FD] text-[#556E89]"
                          }`}
                        >
                          {item.kind === "PLACE" ? copy.placeTag : copy.cityTag}
                        </span>
                        {selected ? (
                          <Check className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
