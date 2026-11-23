"use client";

import {
  Building2,
  Eye,
  Info,
  Search,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  X,
} from "lucide-react";
import {
  PharmacyProductCategorySchema,
  type DirectoryFacilitySummary,
  type PharmacyProductCategory,
  type PharmacyProductSummary,
} from "@medisync/contracts";
import {
  formatCountryDisplayName,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { ProductThumbnail } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton, UiSelect } from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import { PHARMA_COPY } from "../pharmacy-i18n";
import {
  formatMinorMoney,
  type CatalogSafetyFilter,
  type CatalogSortOption,
} from "./pharmacy-utils";

interface PharmacyCatalogGridProps {
  products: readonly PharmacyProductSummary[];
  facilities: readonly DirectoryFacilitySummary[];
  effectiveCountry: string;
  loadingCatalog: boolean;
  searchText: string;
  selectedFacilityId: string;
  selectedCategory: PharmacyProductCategory | "ALL";
  safetyFilter: CatalogSafetyFilter;
  inStockOnly: boolean;
  sortBy: CatalogSortOption;
  cartQuantities: ReadonlyMap<string, number>;
  onSearchChange: (next: string) => void;
  onFacilityChange: (nextFacilityId: string) => void;
  onCategoryChange: (nextCategory: PharmacyProductCategory | "ALL") => void;
  onSafetyFilterChange: (next: CatalogSafetyFilter) => void;
  onInStockOnlyChange: (next: boolean) => void;
  onSortChange: (next: CatalogSortOption) => void;
  onAddToCart: (product: PharmacyProductSummary) => void;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onInspectProduct: (product: PharmacyProductSummary) => void;
}

/** Industry-grade pharmacy storefront search, filter bar, verified partner strip & catalog cards. */
export function PharmacyCatalogGrid({
  products,
  facilities,
  effectiveCountry,
  loadingCatalog,
  searchText,
  selectedFacilityId,
  selectedCategory,
  safetyFilter,
  inStockOnly,
  sortBy,
  cartQuantities,
  onSearchChange,
  onFacilityChange,
  onCategoryChange,
  onSafetyFilterChange,
  onInStockOnlyChange,
  onSortChange,
  onAddToCart,
  onUpdateCartQty,
  onInspectProduct,
}: PharmacyCatalogGridProps) {
  const { locale, t } = useLocale();
  const copy = PHARMA_COPY[locale];

  const selectedFacility = selectedFacilityId
    ? (facilities.find((fac) => fac.id === selectedFacilityId) ?? null)
    : facilities.length === 1
      ? facilities[0]!
      : null;

  const visibleProducts = products
    .filter((product) => {
      if (safetyFilter === "OTC_ONLY" && product.requiresPrescription) {
        return false;
      }
      if (safetyFilter === "RX_ONLY" && !product.requiresPrescription) {
        return false;
      }
      if (inStockOnly && product.stockQty <= 0) {
        return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.priceMinor - b.priceMinor;
      if (sortBy === "price_desc") return b.priceMinor - a.priceMinor;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="min-w-0 w-full space-y-3 md:col-span-7 lg:col-span-8">
      {/* Dispensing Pharmacy Verification Banner */}
      {selectedFacility ? (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2.5 overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066CC] text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs font-bold text-slate-950">
                  <bdi dir="auto">{selectedFacility.name}</bdi>
                </p>
                <UiBadge tone="emerald">
                  {formatOpenStatus(selectedFacility.openStatus, locale)}
                </UiBadge>
              </div>
              <p className="text-[11px] leading-snug text-slate-600">
                {selectedFacility.address} · {copy.licensePrefix}{" "}
                <span className="font-mono-tabular font-medium">
                  {selectedFacility.licenseNumber}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <MoroccanComplianceBadge domain="pharmacy" locale={locale} />
            {selectedFacility.acceptedInsurances.slice(0, 3).map((ins) => (
              <span
                key={ins}
                className="rounded-xl bg-white px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-slate-700 shadow-2xs"
              >
                {ins}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Unified Search, Facility, Rx Filter & Categories Bar */}
      <div className="w-full min-w-0 space-y-2.5 overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <div className="flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 shadow-2xs transition-colors focus-within:ring-2 focus-within:ring-emerald-600/20 sm:col-span-7">
            <Search
              className="h-4 w-4 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <input
              id="pharma-search"
              type="search"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("pharma.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {searchText ? (
              <button
                type="button"
                aria-label={copy.clearSearchAria}
                onClick={() => onSearchChange("")}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="sm:col-span-5">
            <UiSelect
              id="pharma-facility-filter"
              aria-label={copy.facilityFilterAria}
              selectSize="sm"
              className="h-10 rounded-xl border-transparent bg-white shadow-2xs"
              value={selectedFacilityId}
              onChange={(e) => onFacilityChange(e.target.value)}
            >
              <option value="">
                {copy.allPharmaciesOption} ({facilities.length})
              </option>
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.licenseNumber})
                </option>
              ))}
            </UiSelect>
          </div>
        </div>

        {/* Categories Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => onCategoryChange("ALL")}
            className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-[0.98] ${
              selectedCategory === "ALL"
                ? "bg-[#0066CC] text-white shadow-2xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-[#0066CC]"
            }`}
          >
            {copy.allCategoriesBtn}
          </button>
          {PharmacyProductCategorySchema.options.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                selectedCategory === cat
                  ? "bg-[#0066CC] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-[#0066CC]"
              }`}
            >
              {copy.categories[cat]}
            </button>
          ))}
        </div>

        {/* Clinical Filter Chips & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: copy.allTypesChip },
                { id: "OTC_ONLY", label: copy.otcReadyChip },
                { id: "RX_ONLY", label: copy.rxOnlyChip },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSafetyFilterChange(opt.id)}
                className={`h-7 rounded-full px-3 text-[11px] font-semibold transition ${
                  safetyFilter === opt.id
                    ? "bg-[#0066CC] text-white"
                    : "bg-white text-slate-600 shadow-2xs hover:text-[#0066CC]"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <button
              type="button"
              aria-pressed={inStockOnly}
              onClick={() => onInStockOnlyChange(!inStockOnly)}
              className={`h-7 rounded-full px-3 text-[11px] font-semibold transition ${
                inStockOnly
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/30"
                  : "bg-white text-slate-600 shadow-2xs hover:text-[#0066CC]"
              }`}
            >
              {copy.inStockOnlyChip}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono-tabular text-[11px] font-medium text-slate-500">
              {visibleProducts.length} {copy.itemsWord}
            </span>
            <div
              role="radiogroup"
              aria-label={copy.sortAria}
              className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#D7E4F2] bg-[#F3F8FD] p-0.5"
            >
              {(
                [
                  { id: "recommended" as const, label: copy.sortRecommended },
                  { id: "price_asc" as const, label: copy.sortPriceAsc },
                  { id: "price_desc" as const, label: copy.sortPriceDesc },
                  { id: "name_asc" as const, label: copy.sortNameAsc },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={sortBy === s.id}
                  onClick={() => onSortChange(s.id)}
                  className={`h-7 rounded-full px-2.5 text-[11px] font-semibold transition ${
                    sortBy === s.id
                      ? "bg-[#0066CC] text-white shadow-2xs"
                      : "text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {loadingCatalog && products.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            />
          ))}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">
            {copy.emptyFilterPrefix}{" "}
            {formatCountryDisplayName(effectiveCountry, effectiveCountry, locale)}.
          </p>
          <p className="text-xs text-slate-500">{copy.emptyFilterHint}</p>
          <UiButton
            variant="secondary"
            size="sm"
            onClick={() => {
              onSearchChange("");
              onCategoryChange("ALL");
              onSafetyFilterChange("ALL");
              onInStockOnlyChange(false);
            }}
            className="mt-1 rounded-full"
          >
            {copy.resetCatalogBtn}
          </UiButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleProducts.map((product) => {
            const cartQty = cartQuantities.get(product.id) ?? 0;
            const lowStock = product.stockQty > 0 && product.stockQty <= 10;

            return (
              <article
                key={product.id}
                className="group flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white p-4 transition-all hover:bg-[#E1EBF2]"
              >
                <div className="min-w-0">
                  <div className="relative mb-3">
                    <button
                      type="button"
                      onClick={() => onInspectProduct(product)}
                      className="block w-full cursor-pointer rounded-xl text-start focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <ProductThumbnail
                        name={product.name}
                        category={product.category}
                        imageUrl={product.imageUrl}
                        fit="cover"
                        className="h-44 w-full"
                      />
                    </button>

                    <div className="pointer-events-none absolute top-2.5 start-2.5 flex flex-wrap gap-1">
                      <UiBadge
                        tone={product.requiresPrescription ? "amber" : "teal"}
                        className="uppercase shadow-xs"
                      >
                        {product.requiresPrescription
                          ? copy.rxRequiredBadge
                          : copy.otcShortBadge}
                      </UiBadge>
                      {product.category === "COLD_CHAIN" ? (
                        <UiBadge tone="emerald" className="shadow-xs">
                          <Snowflake className="me-1 inline h-3 w-3" />
                          2-8°C
                        </UiBadge>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectProduct(product)}
                      aria-label={`${copy.detailsForAriaPrefix} ${product.name}`}
                      className="absolute end-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs backdrop-blur-xs transition hover:text-[#0066CC] active:scale-95"
                    >
                      <Eye className="h-3 w-3 text-[#0066CC]" aria-hidden="true" />
                      <span>{copy.detailsBtn}</span>
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#0066CC]">
                      {copy.categories[product.category]}
                    </span>
                    <span className="shrink-0 font-mono-tabular text-[11px] font-medium text-slate-400">
                      {product.sku}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectProduct(product)}
                    className="mt-0.5 block w-full min-w-0 text-start hover:text-emerald-800"
                  >
                    <h2 className="truncate text-sm font-bold text-slate-950">
                      <bdi dir="auto">{product.name}</bdi>
                    </h2>
                  </button>

                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {product.genericName ?? product.dosageForm} ·{" "}
                    {product.strength} · {product.dosageForm}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-700">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Building2
                        className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium">
                        {product.facilityName}
                      </span>
                    </span>
                    {product.requiresPrescription ? (
                      <span
                        title={copy.qrRxTooltip}
                        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-amber-800"
                      >
                        <Info className="h-3 w-3" aria-hidden="true" />
                        <span>{copy.qrRxShort}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <p className="font-mono-tabular text-sm font-bold text-slate-900">
                      {formatMinorMoney(
                        product.priceMinor,
                        product.currencyCode,
                      )}
                    </p>
                    <p
                      className={`font-mono-tabular text-[11px] font-medium ${
                        product.stockQty === 0
                          ? "text-rose-600"
                          : lowStock
                            ? "text-amber-700"
                            : "text-slate-500"
                      }`}
                    >
                      {product.stockQty === 0
                        ? copy.outOfStock
                        : lowStock
                          ? `${copy.onlyLeftPrefix} ${product.stockQty} ${copy.onlyLeftSuffix}`
                          : `${product.stockQty} ${copy.inStockSuffix}`}
                    </p>
                  </div>

                  {cartQty > 0 ? (
                    <div className="inline-flex h-9 items-center rounded-full bg-emerald-50 p-0.5 shadow-2xs ring-1 ring-emerald-600/30">
                      <button
                        type="button"
                        aria-label={`${copy.decreasePrefix} ${product.name} ${copy.inCartSuffix}`}
                        onClick={() => onUpdateCartQty(product.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 active:scale-95"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-mono-tabular text-xs font-bold text-emerald-950">
                        {cartQty}
                      </span>
                      <button
                        type="button"
                        aria-label={`${copy.increasePrefix} ${product.name} ${copy.inCartSuffix}`}
                        disabled={cartQty >= product.stockQty}
                        onClick={() => onUpdateCartQty(product.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0066CC] text-xs font-bold text-white shadow-2xs hover:bg-[#0052A3] disabled:opacity-40 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <UiButton
                      size="sm"
                      disabled={product.stockQty === 0}
                      onClick={() => onAddToCart(product)}
                      className="rounded-full active:scale-[0.98]"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t("pharma.addToCart")}</span>
                    </UiButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
