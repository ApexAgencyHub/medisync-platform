"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  LocateFixed,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import type {
  FulfillmentMode,
  PatientInsurancePolicy,
  PaymentMethod,
  PharmacyProductSummary,
  PrescriptionSummary,
} from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import { ProductThumbnail } from "@/shared/ui/EntityAvatar";
import {
  formatPractitionerDisplayName,
  UiBadge,
} from "@/shared/ui/primitives";
import { PHARMA_COPY } from "../pharmacy-i18n";
import { formatMinorMoney, type CartLine } from "./pharmacy-utils";

interface PharmacyCartSidebarProps {
  cart: readonly CartLine[];
  pendingSwitchProduct: PharmacyProductSummary | null;
  currencyCode: string;
  sessionToken: string | null;
  prescriptions: readonly PrescriptionSummary[];
  patientInsurances: readonly PatientInsurancePolicy[];
  selectedRxId: string;
  fulfillmentMode: FulfillmentMode;
  deliveryAddress: string;
  gpsPinnedCoords: { lat: number; lng: number } | null;
  locatingGps: boolean;
  paymentMethod: PaymentMethod;
  checkoutNotes: string;
  cartSubtotalMinor: number;
  courierQuoteMinor: number | null;
  deliveryFeeMinor: number;
  allowRxCourier?: boolean;
  pharmacyLawReference?: string | null;
  busy: boolean;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onClearCart: () => void;
  onConfirmFacilitySwitch: () => void;
  onDismissFacilitySwitch: () => void;
  onSelectRxId: (rxId: string) => void;
  onSelectFulfillmentMode: (mode: FulfillmentMode) => void;
  onDeliveryAddressChange: (addr: string) => void;
  onDetectGpsLocation: () => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCheckoutNotesChange: (note: string) => void;
  onSubmitCheckout: (e: FormEvent) => void;
}

/** Sticky cart, Rx verification gate, courier GPS pin & payment checkout sidebar + mobile quick bar. */
export function PharmacyCartSidebar({
  cart,
  pendingSwitchProduct,
  currencyCode,
  sessionToken,
  prescriptions,
  patientInsurances,
  selectedRxId,
  fulfillmentMode,
  deliveryAddress,
  gpsPinnedCoords,
  locatingGps,
  paymentMethod,
  checkoutNotes,
  cartSubtotalMinor,
  courierQuoteMinor,
  deliveryFeeMinor,
  allowRxCourier = false,
  pharmacyLawReference = null,
  busy,
  onUpdateCartQty,
  onClearCart,
  onConfirmFacilitySwitch,
  onDismissFacilitySwitch,
  onSelectRxId,
  onSelectFulfillmentMode,
  onDeliveryAddressChange,
  onDetectGpsLocation,
  onPaymentMethodChange,
  onCheckoutNotesChange,
  onSubmitCheckout,
}: PharmacyCartSidebarProps) {
  const { locale, t } = useLocale();
  const copy = PHARMA_COPY[locale];

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const cartRequiresRx = cart.some((line) => line.product.requiresPrescription);
  const rxPickupOnly = cartRequiresRx && !allowRxCourier;
  const activeCurrency = cart[0]?.product.currencyCode ?? currencyCode;
  const activeFacilityName = cart[0]?.product.facilityName ?? null;
  const eligibleRxList = prescriptions.filter((rx) => rx.status === "ISSUED");

  return (
    <>
      <aside
        id="pharma-checkout-panel"
        className="min-w-0 md:sticky md:top-20 md:col-span-5 lg:col-span-4"
      >
        <form
          onSubmit={onSubmitCheckout}
          className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <ShoppingCart className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
              <span>{t("pharma.cartTitle")}</span>
            </h2>
            <div className="flex items-center gap-1.5">
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline"
                >
                  {copy.clearBagBtn}
                </button>
              ) : null}
              <span className="rounded-xl bg-white px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-slate-700 shadow-2xs">
                {totalItems} {totalItems === 1 ? copy.itemWord : copy.itemsWord}
              </span>
            </div>
          </div>

          {/* Pending Single-Pharmacy Cart Switch Confirmation */}
          {pendingSwitchProduct ? (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">
                {copy.switchCartPrefix} {pendingSwitchProduct.facilityName}?
              </p>
              <p className="text-[11px] text-amber-900">
                {copy.switchCartBodyPrefix}{" "}
                <strong>{pendingSwitchProduct.name}</strong>.
              </p>
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onConfirmFacilitySwitch}
                  className="rounded-xl bg-[#0066CC] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0052A3]"
                >
                  {copy.switchAndAddBtn}
                </button>
                <button
                  type="button"
                  onClick={onDismissFacilitySwitch}
                  className="rounded-xl bg-white px-3 py-1 text-[11px] font-semibold text-amber-950 shadow-2xs"
                >
                  {copy.keepBagBtn}
                </button>
              </div>
            </div>
          ) : null}

          {activeFacilityName ? (
            <div className="flex items-center gap-1.5 rounded-xl bg-[#E8F1FA] px-3 py-2 text-[11px] font-semibold text-emerald-800">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {copy.fulfillingViaPrefix} {activeFacilityName}
              </span>
            </div>
          ) : null}

          {cart.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-xs text-slate-600 ">
              <p className="font-medium text-slate-700">{t("pharma.emptyCart")}</p>
              <div className="space-y-1.5 pt-1 text-[11px] text-slate-500">
                <p>{copy.bagHintPickup}</p>
                <p>{copy.bagHintCourier}</p>
                <p>{copy.bagHintRx}</p>
              </div>
            </div>
          ) : (
            <>
              <ul className="max-h-60 space-y-2 overflow-y-auto pe-0.5 [scrollbar-width:thin]">
                {cart.map((line) => (
                  <li
                    key={line.product.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-2.5 "
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ProductThumbnail
                        name={line.product.name}
                        category={line.product.category}
                        subtitle={line.product.facilityName}
                        imageUrl={line.product.imageUrl}
                        fit="cover"
                        className="h-11 w-11 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          <bdi dir="auto">{line.product.name}</bdi>
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tabular text-[11px] font-semibold text-slate-700">
                            {formatMinorMoney(
                              line.product.priceMinor * line.quantity,
                              line.product.currencyCode,
                            )}
                          </span>
                          {line.product.requiresPrescription ? (
                            <UiBadge tone="amber">Rx</UiBadge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`${copy.decreasePrefix} ${line.product.name}`}
                        onClick={() => onUpdateCartQty(line.product.id, -1)}
                        className="h-7 w-7 rounded-md border border-slate-300 bg-white text-xs font-bold hover:bg-slate-100 active:scale-95"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono-tabular text-xs font-bold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`${copy.increasePrefix} ${line.product.name}`}
                        disabled={line.quantity >= line.product.stockQty}
                        onClick={() => onUpdateCartQty(line.product.id, 1)}
                        className="h-7 w-7 rounded-md border border-slate-300 bg-white text-xs font-bold hover:bg-slate-100 disabled:opacity-40 active:scale-95"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={copy.removeItemAria}
                        onClick={() =>
                          onUpdateCartQty(line.product.id, -line.quantity)
                        }
                        className="p-1 text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {cartRequiresRx ? (
                <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/75 p-2.5">
                  <p
                    id="checkout-rx-label"
                    className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-900"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{copy.attachRxHeading}</span>
                  </p>
                  {!sessionToken ? (
                    <p className="text-xs text-amber-900">
                      <Link href="/portal" className="font-semibold underline">
                        {copy.signInWord}
                      </Link>{" "}
                      {copy.toAttachRxSuffix}
                    </p>
                  ) : eligibleRxList.length === 0 ? (
                    <p className="text-xs text-amber-900">
                      {copy.noActiveRxPrefix}{" "}
                      <Link href="/booking" className="font-semibold underline">
                        {copy.bookConsultLink}
                      </Link>{" "}
                      {copy.toReceiveRxSuffix}
                    </p>
                  ) : (
                    <div
                      id="checkout-rx-select"
                      role="radiogroup"
                      aria-label={copy.attachRxHeading}
                      className="space-y-1.5"
                    >
                      {eligibleRxList.map((rx) => {
                        const selected = selectedRxId === rx.id;
                        return (
                          <button
                            key={rx.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onSelectRxId(selected ? "" : rx.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs transition active:scale-[0.99] ${
                              selected
                                ? "border-[#0066CC] bg-[#EBF4FF] text-[#0F243E] ring-1 ring-[#0066CC]"
                                : "border-amber-200 bg-white text-[#2F4661] hover:border-amber-400"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#0F243E]">
                                {rx.medications[0]?.name ?? "Rx"}
                              </p>
                              <p className="truncate text-[11px] text-[#556E89]">
                                {formatPractitionerDisplayName(rx.doctorName)}
                              </p>
                            </div>
                            {selected ? (
                              <Check className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectFulfillmentMode("PHARMACY_PICKUP")}
                  className={`flex flex-col items-start rounded-xl p-2.5 text-start transition active:scale-[0.98] ${
                    fulfillmentMode === "PHARMACY_PICKUP"
                      ? "bg-emerald-50 text-emerald-950 ring-2 ring-emerald-700"
                      : "bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-bold">
                    {copy.pharmacyPickupTitle}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {copy.freeCounterSub}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={rxPickupOnly}
                  onClick={() => onSelectFulfillmentMode("COURIER_DELIVERY")}
                  className={`flex flex-col items-start rounded-xl p-2.5 text-start transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${
                    fulfillmentMode === "COURIER_DELIVERY"
                      ? "bg-emerald-50 text-emerald-950 ring-2 ring-emerald-700"
                      : "bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
                  }`}
                >
                  <span className="inline-flex items-center gap-1 text-xs font-bold">
                    <Truck className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                    <span>{copy.courierDispatchTitle}</span>
                  </span>
                  <span className="font-mono-tabular text-[11px] text-slate-500">
                    {rxPickupOnly
                      ? copy.pickupOnlyRxSub
                      : courierQuoteMinor !== null
                        ? `+${formatMinorMoney(courierQuoteMinor, activeCurrency)}`
                        : copy.calculatedAtCheckout}
                  </span>
                </button>
              </div>

              {rxPickupOnly ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] leading-snug text-amber-950">
                  <strong>
                    {pharmacyLawReference ?? copy.defaultRegulationTitle}:
                  </strong>{" "}
                  {copy.rxPickupNotice}
                </p>
              ) : null}

              {fulfillmentMode === "COURIER_DELIVERY" ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="checkout-address"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                    >
                      {copy.deliveryAddressLabel}
                    </label>
                    <button
                      type="button"
                      disabled={locatingGps}
                      onClick={onDetectGpsLocation}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <LocateFixed className="h-3 w-3" aria-hidden="true" />
                      <span>
                        {locatingGps ? copy.detectingGps : copy.autoGpsPin}
                      </span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="checkout-address"
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => onDeliveryAddressChange(e.target.value)}
                      placeholder={copy.addressPlaceholder}
                      className="w-full rounded-xl border border-transparent bg-white px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  {gpsPinnedCoords ? (
                    <p className="flex items-center gap-1 font-mono-tabular text-[11px] font-medium text-[#0066CC]">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>
                        {copy.gpsLockedPrefix} ({gpsPinnedCoords.lat.toFixed(4)},{" "}
                        {gpsPinnedCoords.lng.toFixed(4)}) {copy.gpsLockedSuffix}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {copy.paymentChannelLabel}
                </span>
                <div
                  id="checkout-payment"
                  role="radiogroup"
                  aria-label={copy.paymentChannelLabel}
                  className="grid grid-cols-1 gap-1.5"
                >
                  {(
                    [
                      {
                        id: "CARD_SIMULATED" as const,
                        label: copy.paymentMethods.CARD_SIMULATED,
                        icon: CreditCard,
                      },
                      {
                        id: "INSURANCE_COPAY" as const,
                        label: copy.paymentMethods.INSURANCE_COPAY,
                        icon: ShieldCheck,
                      },
                      {
                        id: "CASH_ON_DELIVERY" as const,
                        label: copy.paymentMethods.CASH_ON_DELIVERY,
                        icon: Banknote,
                      },
                    ] as const
                  ).map((pm) => {
                    const Icon = pm.icon;
                    const active = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onPaymentMethodChange(pm.id)}
                        className={`flex min-h-[38px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs font-semibold transition active:scale-[0.99] ${
                          active
                            ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3] ring-1 ring-[#0066CC]/30"
                            : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 truncate">
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{pm.label}</span>
                        </span>
                        {active ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {paymentMethod === "INSURANCE_COPAY" ? (
                  <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
                    {patientInsurances.length > 0 ? (
                      <span>
                        {copy.activePolicyLabel}{" "}
                        <strong className="text-teal-900">
                          {patientInsurances[0]!.providerName}
                        </strong>{" "}
                        <span className="font-mono-tabular text-slate-500">
                          ({patientInsurances[0]!.policyNumber})
                        </span>
                      </span>
                    ) : (
                      <span>
                        {copy.noInsurancePrefix}{" "}
                        <Link href="/patient" className="font-semibold underline">
                          {copy.myCareLink}
                        </Link>
                        .
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="checkout-notes"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                >
                  {copy.pharmacistNoteLabel}
                </label>
                <div className="flex flex-wrap gap-1">
                  {(locale === "fr"
                    ? ["Substitution générique DCI (Loi 17-04)", "Feuille de soins CNSS / CNOPS"]
                    : locale === "ar"
                      ? ["البديل الجنيس مقبول (قانون 17-04)", "ورقة العلاج CNSS / CNOPS"]
                      : ["Generic DCI substitution OK (Law 17-04)", "CNSS / CNOPS Reimbursement Sheet"]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onCheckoutNotesChange(preset)}
                      className="rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0052A3] transition hover:border-[#0066CC] hover:bg-white"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  id="checkout-notes"
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => onCheckoutNotesChange(e.target.value)}
                  placeholder={copy.pharmacistNotePlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0066CC] focus:outline-none"
                />
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-2.5 font-mono-tabular text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{copy.subtotalLabel}</span>
                  <span>
                    {formatMinorMoney(cartSubtotalMinor, activeCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{copy.courierFeeLabel}</span>
                  <span>
                    {fulfillmentMode === "PHARMACY_PICKUP"
                      ? copy.freeWord
                      : courierQuoteMinor !== null
                        ? formatMinorMoney(deliveryFeeMinor, activeCurrency)
                        : copy.quotedByServer}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-bold text-slate-900">
                  <span>{copy.totalLabel}</span>
                  <span>
                    {formatMinorMoney(
                      cartSubtotalMinor + deliveryFeeMinor,
                      activeCurrency,
                    )}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || cart.length === 0}
                className="h-10 w-full rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? copy.processingCheckout : t("pharma.placeOrder")}
              </button>
            </>
          )}
        </form>
      </aside>

      {/* Mobile Sticky Quick Cart Action Bar */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 md:hidden">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("pharma-checkout-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#0066CC] px-5 py-3 text-white shadow-xl active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <ShoppingCart className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              <span>
                {totalItems} {totalItems === 1 ? copy.itemWord : copy.itemsWord}{" "}
                {copy.inBagWord}
              </span>
            </span>
            <span className="font-mono-tabular text-xs font-bold text-emerald-100">
              {formatMinorMoney(cartSubtotalMinor + deliveryFeeMinor, activeCurrency)}{" "}
              · {copy.reviewCheckout}
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}
