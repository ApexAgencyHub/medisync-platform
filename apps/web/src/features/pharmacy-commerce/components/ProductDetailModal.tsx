"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  FileCheck2,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  X,
} from "lucide-react";
import type {
  DirectoryFacilitySummary,
  PharmacyProductSummary,
} from "@medisync/contracts";
import { formatOpenStatus } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { ProductThumbnail } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton } from "@/shared/ui/primitives";
import { PHARMA_COPY } from "../pharmacy-i18n";
import { formatMinorMoney } from "./pharmacy-utils";

interface ProductDetailModalProps {
  product: PharmacyProductSummary | null;
  facility: DirectoryFacilitySummary | null;
  inCartQty: number;
  onClose: () => void;
  onAddQuantity: (product: PharmacyProductSummary, qty: number) => void;
}

/** Clinical monograph & safety inspection modal for pharmacy items. */
export function ProductDetailModal({
  product,
  facility,
  inCartQty,
  onClose,
  onAddQuantity,
}: ProductDetailModalProps) {
  const { locale, isRtl } = useLocale();
  const copy = PHARMA_COPY[locale];
  const [selectedQty, setSelectedQty] = useState(1);

  useEffect(() => {
    setSelectedQty(1);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, product]);

  if (!product) return null;

  const remainingAddable = Math.max(0, product.stockQty - inCartQty);
  const effectiveMax = Math.max(1, remainingAddable);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.modalProductDetailsAria} ${product.name}`}
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl border border-[#D7E4F2]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur-xs">
          <div className="min-w-0">
            <p className="font-mono-tabular text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {copy.categories[product.category]} · {product.sku}
            </p>
            <h3 className="truncate text-base font-bold text-slate-900">
              <bdi dir="auto">{product.name}</bdi>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.modalCloseAria}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 active:scale-95"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative">
            <ProductThumbnail
              name={product.name}
              category={product.category}
              imageUrl={product.imageUrl}
              fit="cover"
              className="h-52 w-full sm:h-60"
            />
            <div className="pointer-events-none absolute top-3 start-3 flex flex-wrap gap-1.5">
              <UiBadge tone={product.requiresPrescription ? "amber" : "teal"}>
                {product.requiresPrescription
                  ? copy.modalRxBadge
                  : copy.modalOtcBadge}
              </UiBadge>
              {product.category === "COLD_CHAIN" ? (
                <UiBadge tone="emerald">
                  <Snowflake className="me-1 inline h-3 w-3" />
                  {copy.modalColdChainBadge}
                </UiBadge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3.5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                {copy.modalActiveIngredient}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                <bdi dir="auto">{product.genericName ?? product.name}</bdi>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                {copy.modalFormStrength}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                {product.dosageForm} · {product.strength}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                {copy.modalAvailability}
              </p>
              <p className="mt-0.5 font-mono-tabular text-xs font-bold text-slate-900">
                {product.stockQty > 0
                  ? `${product.stockQty} ${copy.modalUnitsReadySuffix}`
                  : copy.outOfStock}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#E8F1FA] p-3.5 text-xs text-slate-900">
            <FileCheck2
              className="mt-0.5 h-4 w-4 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-semibold">
                {copy.modalDispensingGuidanceHeading}
              </p>
              <p className="text-slate-600">{copy.guidance[product.category]}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Building2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#0066CC]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold text-slate-900">
                    {product.facilityName}
                  </p>
                  {facility ? (
                    <p className="mt-0.5 text-slate-600">
                      {facility.address} · {copy.licensePrefix}{" "}
                      <span className="font-mono-tabular font-medium">
                        {facility.licenseNumber}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              {facility ? (
                <UiBadge tone="emerald">
                  <ShieldCheck className="me-1 inline h-3 w-3" />
                  {formatOpenStatus(facility.openStatus, locale)}
                </UiBadge>
              ) : null}
            </div>
            {facility && facility.acceptedInsurances.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                <span className="text-[11px] font-medium text-slate-500">
                  {copy.modalAcceptedCoverage}
                </span>
                {facility.acceptedInsurances.map((ins) => (
                  <span
                    key={ins}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-700"
                  >
                    {ins}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                {copy.modalUnitPriceLabel}
              </p>
              <p className="font-mono-tabular text-lg font-bold text-slate-900">
                {formatMinorMoney(product.priceMinor, product.currencyCode)}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {remainingAddable > 0 ? (
                <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    aria-label={copy.modalDecreaseQtyAria}
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-slate-700 hover:bg-white active:scale-95"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono-tabular text-xs font-bold text-slate-900">
                    {selectedQty}
                  </span>
                  <button
                    type="button"
                    aria-label={copy.modalIncreaseQtyAria}
                    onClick={() =>
                      setSelectedQty((q) => Math.min(effectiveMax, q + 1))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-slate-700 hover:bg-white active:scale-95"
                  >
                    +
                  </button>
                </div>
              ) : null}

              <UiButton
                size="md"
                disabled={remainingAddable === 0}
                onClick={() => {
                  onAddQuantity(product, selectedQty);
                  onClose();
                }}
                className="rounded-full active:scale-[0.98]"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>
                  {remainingAddable === 0
                    ? inCartQty > 0
                      ? copy.modalMaxInCart
                      : copy.outOfStock
                    : `${copy.modalAddPrefix} ${selectedQty} ${copy.modalToCartSuffix}`}
                </span>
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
