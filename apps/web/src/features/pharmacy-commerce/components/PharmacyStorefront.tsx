"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PharmacyProductCategorySchema,
  type CountryPack,
  type DirectoryFacilitySummary,
  type FulfillmentMode,
  type PaymentMethod,
  type PharmacyOrderSummary,
  type PharmacyProductCategory,
  type PharmacyProductSummary,
  type PrescriptionSummary,
} from "@medisync/contracts";
import {
  CheckCircle2,
  Package,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { checkBackendOnline, fetchDirectoryFacilities } from "@/shared/api/directory-client";
import { readStoredSession } from "@/shared/auth/session-storage";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { ProductThumbnail } from "@/shared/ui/EntityAvatar";
import {
  confirmPharmacyOrderPayment,
  createPharmacyOrder,
  createPharmacyProduct,
  listMyPrescriptionsForCheckout,
  listPharmacyOrders,
  listPharmacyProducts,
  updatePharmacyOrderStatus,
  updatePharmacyProductStock,
} from "../api-client";

interface PharmacyStorefrontProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

interface CartLine {
  product: PharmacyProductSummary;
  quantity: number;
}

const CATEGORY_LABELS: Record<PharmacyProductCategory, string> = {
  OTC_MEDICATION: "OTC Care",
  PRESCRIPTION_RX: "Prescription Rx",
  MEDICAL_DEVICE: "Devices",
  WELLNESS_SUPPLEMENT: "Supplements",
  PEDIATRIC_CARE: "Pediatric",
  COLD_CHAIN: "Cold Chain 2-8°C",
};

function formatMinorMoney(
  minor: number,
  currencyCode: string,
  divisor = 100,
): string {
  const major = (minor / divisor).toFixed(2);
  return `${major} ${currencyCode}`;
}

export function PharmacyStorefront({
  packs,
  apiBaseUrl,
}: PharmacyStorefrontProps) {
  const { t } = useLocale();
  const defaultCountry = packs[0]?.code ?? "INTL";

  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCountry);
  const [selectedCategory, setSelectedCategory] = useState<
    PharmacyProductCategory | "ALL"
  >("ALL");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [activeMode, setActiveMode] = useState<"store" | "orders" | "manage">(
    "store",
  );

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionCountry, setSessionCountry] = useState<string | null>(null);

  const [facilities, setFacilities] = useState<DirectoryFacilitySummary[]>([]);
  const [products, setProducts] = useState<PharmacyProductSummary[]>([]);
  const [orders, setOrders] = useState<PharmacyOrderSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillmentMode, setFulfillmentMode] =
    useState<FulfillmentMode>("PHARMACY_PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState(
    "240 Boulevard d'Anfa, Casablanca",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CARD_SIMULATED");
  const [selectedRxId, setSelectedRxId] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [printableOrder, setPrintableOrder] =
    useState<PharmacyOrderSummary | null>(null);

  // Pharmacist product creation state
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newGeneric, setNewGeneric] = useState("");
  const [newCategory, setNewCategory] =
    useState<PharmacyProductCategory>("OTC_MEDICATION");
  const [newPriceMajor, setNewPriceMajor] = useState("45.00");
  const [newStockQty, setNewStockQty] = useState("40");
  const [newRequiresRx, setNewRequiresRx] = useState(false);

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const activePack = useMemo(
    () => packs.find((p) => p.code === selectedCountry) ?? packs[0],
    [packs, selectedCountry],
  );

  const effectiveCountry = useMemo(() => {
    if (sessionCountry && sessionRole && sessionRole !== "OPS_ADMIN") {
      return sessionCountry;
    }
    return selectedCountry;
  }, [sessionCountry, sessionRole, selectedCountry]);

  const loadCatalogAndOrders = useCallback(
    async (
      countryCode: string,
      token: string | null,
      facilityFilter: string,
      categoryFilter: PharmacyProductCategory | "ALL",
      queryText: string,
    ) => {
      const online = await checkBackendOnline();
      if (!online) return;

      const [facRes, prodRes] = await Promise.all([
        fetchDirectoryFacilities(apiBaseUrl, {
          countryCode,
          kind: "PHARMACY",
        }),
        listPharmacyProducts(apiBaseUrl, {
          countryCode,
          ...(facilityFilter ? { facilityId: facilityFilter } : {}),
          ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
          ...(queryText.trim() ? { q: queryText.trim() } : {}),
        }),
      ]);

      if (facRes.ok) {
        setFacilities(facRes.facilities);
      }
      if (prodRes.ok) {
        setProducts(prodRes.data.products);
      }

      if (token) {
        const [ordRes, rxRes] = await Promise.all([
          listPharmacyOrders(apiBaseUrl, token, countryCode),
          listMyPrescriptionsForCheckout(apiBaseUrl, token, countryCode),
        ]);
        if (ordRes.ok) setOrders(ordRes.data.orders);
        if (rxRes.ok) setPrescriptions(rxRes.data.prescriptions);
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    const stored = readStoredSession();
    const initialToken = stored?.token ?? null;
    const initialCountry = stored?.user.countryCode ?? defaultCountry;
    setSessionToken(initialToken);
    setSessionRole(stored?.user.role ?? null);
    setSessionCountry(stored?.user.countryCode ?? null);
    if (stored?.user.countryCode) {
      setSelectedCountry(stored.user.countryCode);
    }

    void loadCatalogAndOrders(
      initialCountry,
      initialToken,
      "",
      "ALL",
      "",
    );
  }, [defaultCountry, loadCatalogAndOrders]);

  function addToCart(product: PharmacyProductSummary) {
    setCart((prev) => {
      if (
        prev.length > 0 &&
        prev[0]!.product.facilityId !== product.facilityId
      ) {
        setBanner({
          tone: "info",
          text: `Cart switched to ${product.facilityName} because each checkout targets one dispensing pharmacy.`,
        });
        return [{ product, quantity: 1 }];
      }
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const currentQty = prev[idx]!.quantity;
        if (currentQty >= product.stockQty) return prev;
        return prev.map((line, i) =>
          i === idx ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? {
                ...line,
                quantity: Math.min(
                  line.product.stockQty,
                  Math.max(0, line.quantity + delta),
                ),
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  const cartRequiresRx = useMemo(
    () => cart.some((line) => line.product.requiresPrescription),
    [cart],
  );

  const cartSubtotalMinor = useMemo(
    () =>
      cart.reduce(
        (acc, line) => acc + line.product.priceMinor * line.quantity,
        0,
      ),
    [cart],
  );

  const deliveryFeeMinor =
    cart.length === 0 || fulfillmentMode === "PHARMACY_PICKUP"
      ? 0
      : effectiveCountry === "MA"
        ? 2500
        : effectiveCountry === "FR"
          ? 590
          : effectiveCountry === "US"
            ? 699
            : 500;

  async function handleCheckoutAndPay(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) {
      setBanner({
        tone: "error",
        text: "Sign in via Portal (or use 1-Click Demo Personas) before placing an order.",
      });
      return;
    }
    if (cart.length === 0) return;
    if (cartRequiresRx && !selectedRxId) {
      setBanner({
        tone: "error",
        text: "Select an issued e-prescription to unlock Rx medications in your cart.",
      });
      return;
    }

    const facilityId = cart[0]!.product.facilityId;
    setBusy(true);
    setBanner(null);

    const createRes = await createPharmacyOrder(apiBaseUrl, sessionToken, {
      facilityId,
      items: cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
      })),
      fulfillmentMode,
      ...(fulfillmentMode === "COURIER_DELIVERY"
        ? { deliveryAddress }
        : {}),
      ...(cartRequiresRx && selectedRxId ? { prescriptionId: selectedRxId } : {}),
      ...(checkoutNotes.trim() ? { notes: checkoutNotes.trim() } : {}),
    });

    if (!createRes.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: `Order checkout failed: ${createRes.error}`,
      });
      return;
    }

    const payRes = await confirmPharmacyOrderPayment(
      apiBaseUrl,
      sessionToken,
      createRes.data.order.id,
      { paymentMethod },
    );
    setBusy(false);

    if (!payRes.ok) {
      setBanner({
        tone: "error",
        text: `Payment confirmation error: ${payRes.error}`,
      });
      return;
    }

    const paid = payRes.data.order;
    setCart([]);
    setPrintableOrder(paid);
    setActiveMode("orders");
    setBanner({
      tone: "success",
      text: `Order paid cleanly! Receipt ${paid.receiptNumber ?? paid.id.slice(0, 8)}${paid.dispatchRequestId ? " · Live courier dispatch created." : ""}`,
    });
    await loadCatalogAndOrders(
      effectiveCountry,
      sessionToken,
      selectedFacilityId,
      selectedCategory,
      searchText,
    );
  }

  async function handleAddCatalogProduct(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) {
      setBanner({ tone: "error", text: "Sign in as Pharmacist or Admin first." });
      return;
    }
    const targetFac = selectedFacilityId || facilities[0]?.id;
    if (!targetFac) {
      setBanner({
        tone: "error",
        text: "Select a verified pharmacy facility first.",
      });
      return;
    }
    const priceMinor = Math.round(Number(newPriceMajor) * 100);
    const stockQty = Number(newStockQty);
    if (!Number.isFinite(priceMinor) || priceMinor < 10) {
      setBanner({ tone: "error", text: "Enter a valid positive price." });
      return;
    }

    setBusy(true);
    const res = await createPharmacyProduct(apiBaseUrl, sessionToken, {
      facilityId: targetFac,
      sku: newSku,
      name: newName,
      ...(newGeneric.trim() ? { genericName: newGeneric.trim() } : {}),
      category: newCategory,
      dosageForm: "Box",
      strength: "Standard",
      requiresPrescription: newRequiresRx,
      priceMinor,
      stockQty: Number.isFinite(stockQty) ? stockQty : 20,
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Catalog error: ${res.error}` });
      return;
    }
    setNewSku("");
    setNewName("");
    setNewGeneric("");
    setBanner({
      tone: "success",
      text: `Added ${res.data.product.name} (${res.data.product.sku}) to catalog.`,
    });
    await loadCatalogAndOrders(
      effectiveCountry,
      sessionToken,
      selectedFacilityId,
      selectedCategory,
      searchText,
    );
  }

  async function handleRestock(product: PharmacyProductSummary, delta: number) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await updatePharmacyProductStock(
      apiBaseUrl,
      sessionToken,
      product.id,
      { stockQty: product.stockQty + delta },
    );
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: `Restock blocked: ${res.error}` });
      return;
    }
    setBanner({
      tone: "success",
      text: `${product.name} stock updated to ${res.data.product.stockQty}.`,
    });
    await loadCatalogAndOrders(
      effectiveCountry,
      sessionToken,
      selectedFacilityId,
      selectedCategory,
      searchText,
    );
  }

  async function handleAdvanceOrder(
    order: PharmacyOrderSummary,
    nextStatus: "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED",
  ) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await updatePharmacyOrderStatus(apiBaseUrl, sessionToken, order.id, {
      status: nextStatus,
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: `Order update blocked: ${res.error}` });
      return;
    }
    setBanner({
      tone: "success",
      text: `Order ${order.receiptNumber ?? order.id.slice(0, 8)} moved to ${nextStatus}.`,
    });
    await loadCatalogAndOrders(
      effectiveCountry,
      sessionToken,
      selectedFacilityId,
      selectedCategory,
      searchText,
    );
  }

  const currencyCode = activePack?.currencyCode ?? "USD";
  const canManageCatalog =
    sessionRole === "PHARMACIST" ||
    sessionRole === "HOSPITAL_ADMIN" ||
    sessionRole === "OPS_ADMIN";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              {t("pharma.eyebrow")} · {currencyCode}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {t("pharma.heading")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t("pharma.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {packs.map((pack) => {
              const active = pack.code === selectedCountry;
              const disabled =
                Boolean(sessionCountry) &&
                sessionRole !== "OPS_ADMIN" &&
                pack.code !== sessionCountry;
              return (
                <button
                  key={pack.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedCountry(pack.code);
                    setSelectedFacilityId("");
                    void loadCatalogAndOrders(
                      pack.code,
                      sessionToken,
                      "",
                      selectedCategory,
                      searchText,
                    );
                  }}
                  className={`min-h-[38px] rounded-xl px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                    active
                      ? "bg-teal-800 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-700 disabled:opacity-45"
                  }`}
                >
                  {pack.code} · {pack.currencyCode}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "store"}
              onClick={() => setActiveMode("store")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeMode === "store"
                  ? "bg-teal-800 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              <Pill className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Catalog & Checkout</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "orders"}
              onClick={() => setActiveMode("orders")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeMode === "orders"
                  ? "bg-teal-800 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Orders & Receipts ({orders.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "manage"}
              onClick={() => setActiveMode("manage")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeMode === "manage"
                  ? "bg-teal-800 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pharmacist Stock Manager</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={() =>
                void loadCatalogAndOrders(
                  effectiveCountry,
                  sessionToken,
                  selectedFacilityId,
                  selectedCategory,
                  searchText,
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:border-teal-700"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Refresh</span>
            </button>
            {!sessionToken ? (
              <Link
                href="/portal"
                className="inline-flex min-h-[36px] items-center rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Sign In to Checkout →
              </Link>
            ) : (
              <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900">
                {formatRoleLabel(sessionRole)} · {effectiveCountry}
              </span>
            )}
          </div>
        </div>
      </section>

      {banner ? (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            banner.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : banner.tone === "success"
                ? "border-teal-200 bg-teal-50 text-teal-900"
                : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {banner.tone === "error" ? (
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{banner.text}</span>
        </div>
      ) : null}

      {activeMode === "store" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="pharma-search"
                    type="search"
                    value={searchText}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSearchText(next);
                      void loadCatalogAndOrders(
                        effectiveCountry,
                        sessionToken,
                        selectedFacilityId,
                        selectedCategory,
                        next,
                      );
                    }}
                    placeholder={t("pharma.searchPlaceholder")}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <select
                  id="pharma-facility-filter"
                  aria-label="Dispensing Pharmacy Filter"
                  value={selectedFacilityId}
                  onChange={(e) => {
                    const nextFac = e.target.value;
                    setSelectedFacilityId(nextFac);
                    void loadCatalogAndOrders(
                      effectiveCountry,
                      sessionToken,
                      nextFac,
                      selectedCategory,
                      searchText,
                    );
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="">All Pharmacies ({facilities.length})</option>
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.licenseNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("ALL");
                    void loadCatalogAndOrders(
                      effectiveCountry,
                      sessionToken,
                      selectedFacilityId,
                      "ALL",
                      searchText,
                    );
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    selectedCategory === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Categories
                </button>
                {PharmacyProductCategorySchema.options.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      void loadCatalogAndOrders(
                        effectiveCountry,
                        sessionToken,
                        selectedFacilityId,
                        cat,
                        searchText,
                      );
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      selectedCategory === cat
                        ? "bg-teal-800 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No pharmacy items loaded yet for {effectiveCountry}. Ensure the
                API daemon is running with seeded data or add items in the
                Pharmacist Stock Manager tab.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                  >
                    <div>
                      <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                        <ProductThumbnail
                          name={product.name}
                          category={product.category}
                          imageUrl={product.imageUrl}
                          className="h-36 w-full border-0"
                        />
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shadow-xs ${
                            product.requiresPrescription
                              ? "border border-amber-300 bg-amber-50 text-amber-900"
                              : "border border-teal-200 bg-white/95 text-teal-900"
                          }`}
                        >
                          {product.requiresPrescription ? "Rx Required" : "OTC"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900">
                          {product.name}
                        </h2>
                        <span className="shrink-0 font-mono-tabular text-[11px] font-medium text-slate-500">
                          {product.sku}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {product.genericName ?? product.dosageForm} ·{" "}
                        {product.strength}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                        {product.facilityName}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <p className="font-mono-tabular text-base font-bold text-slate-900">
                          {formatMinorMoney(
                            product.priceMinor,
                            product.currencyCode,
                          )}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-500">
                          Stock: {product.stockQty} units
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={product.stockQty === 0}
                        onClick={() => addToCart(product)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900 disabled:opacity-45"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t("pharma.addToCart")}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 lg:col-span-4">
            <form
              onSubmit={(e) => void handleCheckoutAndPay(e)}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <ShoppingCart className="h-4 w-4 text-teal-800" aria-hidden="true" />
                  <span>{t("pharma.cartTitle")}</span>
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono-tabular text-xs font-bold text-slate-700">
                  {cart.reduce((sum, l) => sum + l.quantity, 0)} items
                </span>
              </div>

              {cart.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  {t("pharma.emptyCart")}
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {cart.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProductThumbnail
                          name={line.product.name}
                          category={line.product.category}
                          imageUrl={line.product.imageUrl}
                          className="h-10 w-10 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {line.product.name}
                          </p>
                        <p className="font-mono-tabular text-[11px] text-slate-600">
                          {formatMinorMoney(
                            line.product.priceMinor * line.quantity,
                            line.product.currencyCode,
                          )}
                        </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(line.product.id, -1)}
                          className="h-7 w-7 rounded-md border border-slate-300 bg-white text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-mono-tabular text-xs font-bold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(line.product.id, 1)}
                          className="h-7 w-7 rounded-md border border-slate-300 bg-white text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() =>
                            updateCartQty(line.product.id, -line.quantity)
                          }
                          className="p-1 text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {cartRequiresRx ? (
                <div>
                  <label
                    htmlFor="checkout-rx-select"
                    className="block text-xs font-semibold uppercase tracking-wider text-amber-900"
                  >
                    Attach Issued E-Prescription (Rx Required)
                  </label>
                  <select
                    id="checkout-rx-select"
                    value={selectedRxId}
                    onChange={(e) => setSelectedRxId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-slate-900"
                  >
                    <option value="">-- Select patient prescription --</option>
                    {prescriptions.map((rx) => (
                      <option key={rx.id} value={rx.id}>
                        {rx.medications[0]?.name ?? "Rx"} · Dr. {rx.doctorName} (
                        {rx.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentMode("PHARMACY_PICKUP")}
                  className={`min-h-[38px] rounded-xl border px-2 py-1.5 text-xs font-semibold ${
                    fulfillmentMode === "PHARMACY_PICKUP"
                      ? "border-teal-800 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Pharmacy Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentMode("COURIER_DELIVERY")}
                  className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-semibold ${
                    fulfillmentMode === "COURIER_DELIVERY"
                      ? "border-teal-800 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Courier Dispatch</span>
                </button>
              </div>

              {fulfillmentMode === "COURIER_DELIVERY" ? (
                <div>
                  <label
                    htmlFor="checkout-address"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Courier Delivery Address
                  </label>
                  <input
                    id="checkout-address"
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="checkout-payment"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Payment Channel
                </label>
                <select
                  id="checkout-payment"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                >
                  <option value="CARD_SIMULATED">Online Card / Instant Receipt</option>
                  <option value="INSURANCE_COPAY">Insurance Co-Pay Mutual</option>
                  <option value="CASH_ON_DELIVERY">Cash / Counter Pickup</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="checkout-notes"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Pharmacist Note (Optional)
                </label>
                <input
                  id="checkout-notes"
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Allergy or doorstep instructions"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3 font-mono-tabular text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>
                    {formatMinorMoney(
                      cartSubtotalMinor,
                      cart[0]?.product.currencyCode ?? currencyCode,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Courier Fee</span>
                  <span>
                    {formatMinorMoney(
                      deliveryFeeMinor,
                      cart[0]?.product.currencyCode ?? currencyCode,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900">
                  <span>Total</span>
                  <span>
                    {formatMinorMoney(
                      cartSubtotalMinor + deliveryFeeMinor,
                      cart[0]?.product.currencyCode ?? currencyCode,
                    )}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || cart.length === 0}
                className="min-h-[44px] w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 disabled:opacity-50"
              >
                {busy ? "Processing Checkout..." : t("pharma.placeOrder")}
              </button>
            </form>
          </aside>
        </div>
      ) : null}

      {activeMode === "orders" ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900">
            {t("pharma.ordersTitle")}
          </h2>

          {printableOrder ? (
            <div className="rounded-xl border-2 border-teal-700 bg-teal-50/40 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono-tabular text-xs font-bold text-teal-900">
                  OFFICIAL PHARMACY RECEIPT ·{" "}
                  {printableOrder.receiptNumber ?? printableOrder.id}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Print Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintableOrder(null)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-700">
                Patient: <strong>{printableOrder.patientName}</strong> · Pharmacy:{" "}
                <strong>{printableOrder.facilityName}</strong> · Method:{" "}
                {printableOrder.paymentMethod ?? "PENDING"}
              </p>
              <ul className="divide-y divide-teal-200/60 text-xs">
                {printableOrder.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-1">
                    <span>
                      {item.quantity}x {item.productName} ({item.sku})
                    </span>
                    <span className="font-mono-tabular font-semibold">
                      {formatMinorMoney(
                        item.lineTotalMinor,
                        printableOrder.currencyCode,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="font-mono-tabular text-sm font-bold text-slate-900">
                Total Paid:{" "}
                {formatMinorMoney(
                  printableOrder.totalMinor,
                  printableOrder.currencyCode,
                )}
              </p>
            </div>
          ) : null}

          {orders.length === 0 ? (
            <p className="text-sm text-slate-600">
              No orders in this jurisdiction scope yet.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {order.facilityName} · {order.receiptNumber ?? "Unpaid"}
                      </p>
                      <p className="font-mono-tabular text-xs text-slate-600">
                        {order.fulfillmentMode} ·{" "}
                        {formatMinorMoney(order.totalMinor, order.currencyCode)}
                        {order.dispatchRequestId
                          ? ` · Dispatch ${order.dispatchRequestId.slice(0, 8)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-teal-900">
                        {order.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrintableOrder(order)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-teal-700"
                      >
                        Receipt
                      </button>
                      {canManageCatalog && order.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleAdvanceOrder(order, "PREPARING")
                          }
                          className="rounded-lg bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Prepare
                        </button>
                      ) : null}
                      {canManageCatalog && order.status === "PREPARING" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleAdvanceOrder(order, "DELIVERED")
                          }
                          className="rounded-lg bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Mark Delivered
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeMode === "manage" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={(e) => void handleAddCatalogProduct(e)}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5"
          >
            <h2 className="text-base font-bold text-slate-900">
              Add Pharmacy Medication ({effectiveCountry})
            </h2>
            {!canManageCatalog ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Sign in with a Pharmacist, Hospital Coordinator, or Operations account
                on the Portal to add or restock medications.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="Product Code (e.g. MA-AZITH-500)"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as PharmacyProductCategory)
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {PharmacyProductCategorySchema.options.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              required
              placeholder="Medication / Product Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="Generic Active Ingredient (optional)"
              value={newGeneric}
              onChange={(e) => setNewGeneric(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                required
                placeholder={`Price (${currencyCode})`}
                value={newPriceMajor}
                onChange={(e) => setNewPriceMajor(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
              />
              <input
                type="number"
                required
                placeholder="Initial Stock Qty"
                value={newStockQty}
                onChange={(e) => setNewStockQty(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={newRequiresRx}
                onChange={(e) => setNewRequiresRx(e.target.checked)}
              />
              <span>Requires verified Doctor E-Prescription (Rx)</span>
            </label>
            <button
              type="submit"
              disabled={busy || !canManageCatalog}
              className="min-h-[42px] w-full rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add to Pharmacy Catalog
            </button>
          </form>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
            <h2 className="text-base font-bold text-slate-900">
              Live Inventory Controls
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProductThumbnail
                      name={prod.name}
                      category={prod.category}
                      imageUrl={prod.imageUrl}
                      className="h-10 w-10 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{prod.name}</p>
                      <p className="font-mono-tabular text-[11px] text-slate-600">
                        {prod.sku} · {prod.facilityName} · Stock:{" "}
                        <strong>{prod.stockQty}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !canManageCatalog}
                    onClick={() => void handleRestock(prod, 10)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-teal-800 hover:border-teal-700 disabled:opacity-45"
                  >
                    +10 Units
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
