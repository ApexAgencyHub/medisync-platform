"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  GripVertical,
  Kanban,
  List,
  MapPin,
  Package,
  Printer,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import type {
  LocaleCode,
  PharmacyOrderStatus,
  PharmacyOrderSummary,
} from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiBadge } from "@/shared/ui/primitives";
import { PHARMA_COPY } from "../pharmacy-i18n";
import { formatMinorMoney } from "./pharmacy-utils";

const ORDERS_EXTRA_COPY: Record<
  LocaleCode,
  {
    kpiRevenue: string;
    kpiActiveQueue: string;
    kpiDelivered: string;
    kpiCourierDrops: string;
    searchPlaceholder: string;
  }
> = {
  en: {
    kpiRevenue: "Settled Sales",
    kpiActiveQueue: "Active Queue",
    kpiDelivered: "Delivered",
    kpiCourierDrops: "Courier Runs",
    searchPlaceholder: "Search receipt, patient, or medicine...",
  },
  fr: {
    kpiRevenue: "Chiffre Encaissé",
    kpiActiveQueue: "En Préparation",
    kpiDelivered: "Livrées",
    kpiCourierDrops: "Coursiers",
    searchPlaceholder: "Rechercher reçu, patient ou produit...",
  },
  ar: {
    kpiRevenue: "المبيعات المحصلة",
    kpiActiveQueue: "طلبات قيد التجهيز",
    kpiDelivered: "المسلمة",
    kpiCourierDrops: "رحلات التوصيل",
    searchPlaceholder: "بحث برقم الوصل، المريض أو الدواء...",
  },
};

interface PharmacyOrdersViewProps {
  orders: readonly PharmacyOrderSummary[];
  printableOrder: PharmacyOrderSummary | null;
  canManageStock: boolean;
  busy: boolean;
  onSelectPrintableOrder: (order: PharmacyOrderSummary | null) => void;
  onAdvanceOrder: (
    order: PharmacyOrderSummary,
    nextStatus: "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED",
  ) => void;
}

type OrderFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";
type CounterKanbanLane = "PAID" | "PREPARING" | "DISPATCHED";

function getStepIndex(order: PharmacyOrderSummary): number {
  const courier = order.fulfillmentMode === "COURIER_DELIVERY";
  if (order.status === "PENDING_PAYMENT" || order.status === "PAID") return 0;
  if (order.status === "PREPARING") return 1;
  if (order.status === "OUT_FOR_DELIVERY") return 2;
  if (order.status === "DELIVERED") return courier ? 3 : 2;
  return -1;
}

/** Order history & fulfillment tracker with live courier deep links, visual stepper & printable clinical receipt. */
export function PharmacyOrdersView({
  orders,
  printableOrder,
  canManageStock,
  busy,
  onSelectPrintableOrder,
  onAdvanceOrder,
}: PharmacyOrdersViewProps) {
  const { locale, t } = useLocale();
  const copy = PHARMA_COPY[locale];
  const ec = ORDERS_EXTRA_COPY[locale];
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">(() =>
    canManageStock ? "board" : "list",
  );
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<CounterKanbanLane | null>(
    null,
  );

  useEffect(() => {
    if (!canManageStock) {
      setViewMode("list");
      return;
    }
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("list");
    }
  }, [canManageStock]);

  function handleKanbanDrop(targetLane: CounterKanbanLane) {
    const draggedId = draggingOrderId;
    setDraggingOrderId(null);
    setDragOverLane(null);
    if (!draggedId || !canManageStock || busy) return;
    const ord = orders.find((o) => o.id === draggedId);
    if (!ord) return;
    if (ord.status === "PAID" && targetLane === "PREPARING") {
      onAdvanceOrder(ord, "PREPARING");
    } else if (ord.status === "PREPARING" && targetLane === "DISPATCHED") {
      onAdvanceOrder(
        ord,
        ord.fulfillmentMode === "PHARMACY_PICKUP"
          ? "DELIVERED"
          : "OUT_FOR_DELIVERY",
      );
    }
  }

  const settledRevenueMinor = orders
    .filter(
      (o) => o.status !== "CANCELLED" && o.status !== "PENDING_PAYMENT",
    )
    .reduce((sum, o) => sum + o.totalMinor, 0);
  const activeCount = orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED",
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;
  const courierCount = orders.filter(
    (o) => o.fulfillmentMode === "COURIER_DELIVERY",
  ).length;
  const primaryCurrency = orders[0]?.currencyCode ?? "MAD";

  const filteredOrders = orders.filter((ord) => {
    if (filter === "ACTIVE") {
      if (ord.status === "DELIVERED" || ord.status === "CANCELLED") return false;
    } else if (filter === "COMPLETED" && ord.status !== "DELIVERED") {
      return false;
    } else if (filter === "CANCELLED" && ord.status !== "CANCELLED") {
      return false;
    }
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      const itemsText = ord.items.map((it) => it.productName).join(" ");
      const haystack = `${ord.receiptNumber ?? ord.id} ${ord.patientName} ${ord.facilityName} ${itemsText}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <section className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
      {canManageStock ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#B2E5DC] bg-[#E6F7F4]/80 px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#0A6E5E] uppercase">
              {ec.kpiRevenue}
            </p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#0F243E]">
              {formatMinorMoney(settledRevenueMinor, primaryCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5">
            <p className="text-[11px] font-semibold text-amber-900 uppercase">
              {ec.kpiActiveQueue}
            </p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-amber-950">
              {activeCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#D7E4F2] bg-white px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#556E89] uppercase">
              {ec.kpiDelivered}
            </p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#0F243E]">
              {deliveredCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#BFDBFE] bg-[#EBF4FF]/80 px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#0052A3] uppercase">
              {ec.kpiCourierDrops}
            </p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#0F243E]">
              {courierCount}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F1FA] pb-3">
        <h2 className="font-editorial text-base font-bold text-[#0F243E]">
          {t("pharma.ordersTitle")}
        </h2>

        {orders.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-3 focus-within:border-[#0066CC] focus-within:bg-white">
              <Search className="h-3.5 w-3.5 text-[#556E89]" aria-hidden="true" />
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={ec.searchPlaceholder}
                className="w-40 bg-transparent text-xs text-[#0F243E] placeholder:text-[#7D95B0] focus:outline-none sm:w-52"
              />
            </div>

            {canManageStock ? (
              <div
                role="group"
                aria-label="Order fulfillment view switcher"
                className="inline-flex rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("board");
                    setFilter("ALL");
                  }}
                  className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition ${
                    viewMode === "board"
                      ? "bg-[#0066CC] text-white shadow-2xs"
                      : "text-[#4A627D] hover:text-[#0F243E]"
                  }`}
                >
                  <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {locale === "fr"
                      ? "Tableau"
                      : locale === "ar"
                        ? "لوحة"
                        : "Board"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition ${
                    viewMode === "list"
                      ? "bg-[#0066CC] text-white shadow-2xs"
                      : "text-[#4A627D] hover:text-[#0F243E]"
                  }`}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {locale === "fr"
                      ? "Liste"
                      : locale === "ar"
                        ? "قائمة"
                        : "List"}
                  </span>
                </button>
              </div>
            ) : null}

            {viewMode === "list" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: `${copy.filterAllPrefix} (${orders.length})` },
                    { id: "ACTIVE", label: copy.filterActive },
                    { id: "COMPLETED", label: copy.filterDelivered },
                    { id: "CANCELLED", label: copy.filterCancelled },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilter(opt.id)}
                    className={`h-8 rounded-full border px-3 text-xs font-semibold transition ${
                      filter === opt.id
                        ? "border-[#0052A3] bg-[#0066CC] text-white"
                        : "border-[#CBDDF0] bg-[#F8FBFE] text-[#4A627D] hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Official Clinical Printable Receipt Card */}
      {printableOrder ? (
        <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-5 ring-2 ring-emerald-600/30">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div>
              <p className="font-mono-tabular text-xs font-bold text-emerald-800 uppercase">
                {copy.officialReceiptPrefix} ·{" "}
                {printableOrder.receiptNumber ?? printableOrder.id.slice(0, 8)}
              </p>
              <p className="text-[11px] text-slate-600">
                {copy.issuedPrefix}{" "}
                {new Date(
                  printableOrder.paidAtIso ?? printableOrder.createdAtIso,
                ).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3]"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.printReceiptBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectPrintableOrder(null)}
                className="h-8 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                {copy.closeBtn}
              </button>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <p>
              {copy.patientLabel} <strong>{printableOrder.patientName}</strong>
            </p>
            <p>
              {copy.pharmacyLabel} <strong>{printableOrder.facilityName}</strong>
            </p>
            <p>
              {copy.channelLabel}{" "}
              <strong>
                {printableOrder.paymentMethod
                  ? copy.paymentMethods[printableOrder.paymentMethod]
                  : copy.pendingWord}
              </strong>
            </p>
          </div>

          {printableOrder.items.length > 0 ? (
            <ul className="divide-y divide-teal-200/60 rounded-xl border border-teal-200/70 bg-white/80 px-3 text-xs">
              {printableOrder.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <span>
                    <strong>{item.quantity}x</strong> {item.productName}{" "}
                    <span className="font-mono-tabular text-[11px] text-slate-500">
                      ({item.sku})
                    </span>
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatMinorMoney(
                      item.lineTotalMinor,
                      printableOrder.currencyCode,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono-tabular text-xs">
            <span className="text-slate-600">
              {copy.subtotalLabel}:{" "}
              {formatMinorMoney(
                printableOrder.subtotalMinor,
                printableOrder.currencyCode,
              )}{" "}
              · {copy.courierShortLabel}{" "}
              {formatMinorMoney(
                printableOrder.deliveryFeeMinor,
                printableOrder.currencyCode,
              )}
            </span>
            <p className="text-sm font-bold text-slate-950">
              {copy.totalPaidLabel}{" "}
              {formatMinorMoney(
                printableOrder.totalMinor,
                printableOrder.currencyCode,
              )}
            </p>
          </div>
        </div>
      ) : null}

      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBDDF0] bg-[#F8FBFE] p-6 text-center text-sm text-slate-600">
          {orders.length === 0 ? copy.noOrdersYet : copy.noMatchingOrders}
        </div>
      ) : canManageStock && viewMode === "board" ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {(
            [
              {
                lane: "PAID" as const,
                title: copy.stepPaid,
                accent: "border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3]",
                items: filteredOrders.filter(
                  (o) => o.status === "PAID" || o.status === "PENDING_PAYMENT",
                ),
              },
              {
                lane: "PREPARING" as const,
                title: copy.stepPreparing,
                accent: "border-amber-200 bg-amber-50 text-amber-900",
                items: filteredOrders.filter((o) => o.status === "PREPARING"),
              },
              {
                lane: "DISPATCHED" as const,
                title: `${copy.stepEnRoute} / ${copy.stepDelivered}`,
                accent: "border-[#B2E5DC] bg-[#E6F7F4] text-[#0A6E5E]",
                items: filteredOrders.filter(
                  (o) =>
                    o.status === "OUT_FOR_DELIVERY" ||
                    o.status === "DELIVERED" ||
                    o.status === "CANCELLED",
                ),
              },
            ] as const
          ).map((col) => {
            const isOver = dragOverLane === col.lane;
            return (
              <div
                key={col.lane}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverLane !== col.lane) setDragOverLane(col.lane);
                }}
                onDragLeave={() => {
                  if (dragOverLane === col.lane) setDragOverLane(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleKanbanDrop(col.lane);
                }}
                className={`flex min-h-[240px] flex-col rounded-2xl border p-3 transition ${
                  isOver
                    ? "border-[#0066CC] bg-[#EBF4FF]/70 ring-2 ring-[#0066CC]/25"
                    : "border-[#D7E4F2] bg-[#F8FBFE]"
                }`}
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${col.accent}`}
                  >
                    {col.title}
                  </span>
                  <span className="font-mono-tabular text-xs font-bold text-[#556E89]">
                    {col.items.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5">
                  {col.items.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#CBDDF0] text-[11px] text-[#7D95B0]">
                      —
                    </div>
                  ) : (
                    col.items.map((order) => {
                      const canDrag =
                        order.status === "PAID" || order.status === "PREPARING";
                      const statusMeta =
                        copy.orderStatus[order.status as PharmacyOrderStatus] ??
                        copy.orderStatus.PAID;
                      return (
                        <article
                          key={order.id}
                          draggable={canDrag}
                          onDragStart={() => setDraggingOrderId(order.id)}
                          onDragEnd={() => {
                            setDraggingOrderId(null);
                            setDragOverLane(null);
                          }}
                          className={`space-y-2 rounded-xl border bg-white p-3 text-xs shadow-2xs transition ${
                            draggingOrderId === order.id
                              ? "opacity-55 border-[#0066CC]"
                              : "border-[#D7E4F2] hover:border-[#93C5FD]"
                          } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex min-w-0 items-center gap-1">
                              {canDrag ? (
                                <GripVertical
                                  className="h-3.5 w-3.5 shrink-0 text-[#9CB4CE]"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span className="truncate font-bold text-[#0F243E]">
                                <bdi dir="auto">{order.patientName}</bdi>
                              </span>
                            </div>
                            <span className="shrink-0 font-mono-tabular font-bold text-[#0F243E]">
                              {formatMinorMoney(order.totalMinor, order.currencyCode)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono-tabular text-[10.5px] font-semibold text-[#556E89]">
                              {order.receiptNumber ??
                                `${copy.orderNumberPrefix}${order.id.slice(0, 8)}`}
                            </span>
                            <UiBadge tone={statusMeta.tone}>
                              {statusMeta.label}
                            </UiBadge>
                            {order.prescriptionId ? (
                              <UiBadge tone="teal">{copy.qrRxLinkedBadge}</UiBadge>
                            ) : null}
                          </div>

                          <p className="text-[11px] text-[#556E89]">
                            {copy.fulfillment[order.fulfillmentMode]}
                            {order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}
                          </p>

                          {order.items.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {order.items.map((item) => (
                                <span
                                  key={item.id}
                                  className="rounded-lg border border-[#E2ECF7] bg-[#F8FBFE] px-2 py-0.5 text-[10.5px] font-medium text-[#2F4661]"
                                >
                                  <strong>{item.quantity}x</strong> {item.productName}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-1.5 border-t border-[#EDF4FB] pt-2">
                            {order.status === "PAID" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onAdvanceOrder(order, "PREPARING")}
                                className="h-8 flex-1 rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                              >
                                {copy.prepareBtn}
                              </button>
                            ) : null}

                            {order.status === "PREPARING" ? (
                              <>
                                {order.fulfillmentMode !== "PHARMACY_PICKUP" ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void onAdvanceOrder(order, "OUT_FOR_DELIVERY")
                                    }
                                    className="h-8 flex-1 rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 text-xs font-semibold text-[#0052A3] hover:bg-[#0066CC] hover:text-white disabled:opacity-50"
                                  >
                                    {copy.dispatchCourierBtn}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void onAdvanceOrder(order, "DELIVERED")}
                                  className="h-8 flex-1 rounded-xl bg-[#0F9D88] px-2.5 text-xs font-semibold text-white hover:bg-[#0A7D6B] disabled:opacity-50"
                                >
                                  {copy.markDeliveredBtn}
                                </button>
                              </>
                            ) : null}

                            {order.status === "OUT_FOR_DELIVERY" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onAdvanceOrder(order, "DELIVERED")}
                                className="h-8 flex-1 rounded-xl bg-[#0F9D88] px-3 text-xs font-semibold text-white hover:bg-[#0A7D6B] disabled:opacity-50"
                              >
                                {copy.markDeliveredBtn}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => onSelectPrintableOrder(order)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#D7E4F2] bg-white px-2.5 text-[11px] font-semibold text-[#2F4661] hover:border-[#0066CC] hover:text-[#0066CC]"
                            >
                              <Printer className="h-3 w-3" aria-hidden="true" />
                              <span>{copy.receiptBtn}</span>
                            </button>

                            {order.status !== "DELIVERED" &&
                            order.status !== "CANCELLED" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onAdvanceOrder(order, "CANCELLED")}
                                aria-label={`${copy.cancelBtn} ${order.receiptNumber ?? order.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusMeta =
              copy.orderStatus[order.status as PharmacyOrderStatus] ??
              copy.orderStatus.PAID;
            const steps =
              order.fulfillmentMode === "COURIER_DELIVERY"
                ? [
                    copy.stepPaid,
                    copy.stepPreparing,
                    copy.stepEnRoute,
                    copy.stepDelivered,
                  ]
                : [copy.stepPaid, copy.stepPreparing, copy.stepCompleted];
            const currentStep = getStepIndex(order);

            return (
              <article
                key={order.id}
                className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 transition hover:bg-[#E1EBF2]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        <bdi dir="auto">{order.facilityName}</bdi>
                      </p>
                      <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                        {order.receiptNumber ??
                          `${copy.orderNumberPrefix}${order.id.slice(0, 8)}`}
                      </span>
                      <UiBadge tone={statusMeta.tone}>{statusMeta.label}</UiBadge>
                      {order.prescriptionId ? (
                        <UiBadge tone="teal">{copy.qrRxLinkedBadge}</UiBadge>
                      ) : null}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">
                        {copy.fulfillment[order.fulfillmentMode]}
                      </span>
                      <span>·</span>
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {formatMinorMoney(order.totalMinor, order.currencyCode)}
                      </span>
                      {order.deliveryAddress ? (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-teal-800" />
                            <span>{order.deliveryAddress}</span>
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {order.dispatchRequestId ? (
                      <Link
                        href="/map"
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{copy.trackCourierBtn}</span>
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onSelectPrintableOrder(order)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:text-[#0066CC]"
                    >
                      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.receiptBtn}</span>
                    </button>

                    {canManageStock && order.status === "PAID" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onAdvanceOrder(order, "PREPARING")}
                        className="h-8 rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                      >
                        {copy.prepareBtn}
                      </button>
                    ) : null}

                    {canManageStock && order.status === "PREPARING" ? (
                      <>
                        {order.fulfillmentMode !== "PHARMACY_PICKUP" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onAdvanceOrder(order, "OUT_FOR_DELIVERY")
                            }
                            className="h-8 rounded-xl bg-white px-3 text-xs font-semibold text-[#0066CC] shadow-2xs hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {copy.dispatchCourierBtn}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onAdvanceOrder(order, "DELIVERED")}
                          className="h-8 rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                        >
                          {copy.markDeliveredBtn}
                        </button>
                      </>
                    ) : null}

                    {canManageStock && order.status === "OUT_FOR_DELIVERY" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onAdvanceOrder(order, "DELIVERED")}
                        className="h-8 rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                      >
                        {copy.markDeliveredBtn}
                      </button>
                    ) : null}

                    {canManageStock &&
                    order.status !== "DELIVERED" &&
                    order.status !== "CANCELLED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onAdvanceOrder(order, "CANCELLED")}
                        aria-label={`${copy.cancelBtn} ${order.receiptNumber ?? order.id}`}
                        className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{copy.cancelBtn}</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Progress Stepper (when active / completed) */}
                {currentStep >= 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2 sm:grid-cols-4">
                    {steps.map((stepLabel, idx) => {
                      const done = idx <= currentStep;
                      return (
                        <div
                          key={stepLabel}
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            done
                              ? "bg-emerald-50 text-emerald-900"
                              : "text-slate-400"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                              aria-hidden="true"
                            />
                          ) : (
                            <Package
                              className="h-3.5 w-3.5 shrink-0 text-slate-300"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{stepLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {order.items.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {order.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
                      >
                        <strong>{item.quantity}x</strong> {item.productName}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
