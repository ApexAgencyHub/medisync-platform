"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  FlaskConical,
  Pill,
  QrCode,
  Search,
} from "lucide-react";
import type {
  AppointmentSummary,
  LabOrderSummary,
  LocaleCode,
  PharmacyOrderSummary,
  PrescriptionSummary,
} from "@medisync/contracts";
import { formatUrgencyLabel, formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiBadge } from "@/shared/ui/primitives";

const TRACKER_COPY: Record<
  LocaleCode,
  {
    heading: string;
    subtitle: string;
    tabPharmacy: (n: number) => string;
    tabVisits: (n: number) => string;
    tabRx: (n: number) => string;
    tabLabs: (n: number) => string;
    searchPlaceholder: string;
    settledRevenue: string;
    activeOrders: string;
    emptyText: string;
    rxIssuedBadge: string;
    rxDispensedBadge: string;
  }
> = {
  en: {
    heading: "Cross-Platform Operations & Revenue Tracker",
    subtitle:
      "Monitor live pharmacy sales, doctor & home-nurse consultations, E-Prescription QR dispensing, and diagnostic lab throughput.",
    tabPharmacy: (n) => `Pharmacy Sales (${n})`,
    tabVisits: (n) => `Doctor & Nurse Visits (${n})`,
    tabRx: (n) => `E-Rx QR (${n})`,
    tabLabs: (n) => `Diagnostic Labs (${n})`,
    searchPlaceholder: "Filter by patient, doctor, nurse, pharmacy, or receipt...",
    settledRevenue: "Settled Pharmacy Volume",
    activeOrders: "Active Fulfillment",
    emptyText: "No operational records found in this view.",
    rxIssuedBadge: "QR Active",
    rxDispensedBadge: "Dispensed",
  },
  fr: {
    heading: "Suivi Complet des Opérations & Revenus",
    subtitle:
      "Surveillez les ventes officine, consultations médecins & infirmiers, ordonnances QR et bilans de laboratoire.",
    tabPharmacy: (n) => `Ventes Pharmacie (${n})`,
    tabVisits: (n) => `Consultations & Soins (${n})`,
    tabRx: (n) => `Ordonnances QR (${n})`,
    tabLabs: (n) => `Analyses Labo (${n})`,
    searchPlaceholder: "Filtrer par patient, médecin, infirmier ou pharmacie...",
    settledRevenue: "Volume Ventes Officine",
    activeOrders: "Commandes en cours",
    emptyText: "Aucun enregistrement trouvé dans cette vue.",
    rxIssuedBadge: "QR Actif",
    rxDispensedBadge: "Délivrée",
  },
  ar: {
    heading: "المتابعة الشاملة للعمليات والمبيعات الطبية",
    subtitle:
      "مراقبة مبيعات الصيدليات، مواعيد الأطباء والممرضين، وصفات QR، وتحاليل المختبرات في الوقت الفعلي.",
    tabPharmacy: (n) => `مبيعات الصيدليات (${n})`,
    tabVisits: (n) => `زيارات الأطباء والتمريض (${n})`,
    tabRx: (n) => `وصفات QR (${n})`,
    tabLabs: (n) => `المختبرات (${n})`,
    searchPlaceholder: "ابحث بالمريض، الطبيب، الممرض، الصيدلية أو رقم الوصل...",
    settledRevenue: "حجم مبيعات الصيدلية",
    activeOrders: "طلبات قيد التجهيز",
    emptyText: "لا توجد عمليات مسجلة في هذا القسم.",
    rxIssuedBadge: "رمز QR نشط",
    rxDispensedBadge: "تم الصرف",
  },
};

function formatMoneyMinor(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function formatFulfillmentLabel(mode: string, locale: LocaleCode): string {
  if (mode === "PHARMACY_PICKUP") {
    return locale === "fr"
      ? "Retrait officine"
      : locale === "ar"
        ? "استلام بالصيدلية"
        : "Pharmacy Pickup";
  }
  return locale === "fr"
    ? "Livraison parapharma"
    : locale === "ar"
      ? "توصيل شبه الصيدلية"
      : "OTC Courier Delivery";
}

function formatTrackerStatus(status: string, locale: LocaleCode): string {
  const map: Record<string, Record<LocaleCode, string>> = {
    PENDING_PAYMENT: { en: "Pending Payment", fr: "Paiement en attente", ar: "بانتظار الدفع" },
    PAID: { en: "Paid", fr: "Payée", ar: "مدفوعة" },
    PREPARING: { en: "Preparing", fr: "En préparation", ar: "قيد التحضير" },
    READY_FOR_PICKUP: { en: "Ready for Pickup", fr: "Prête au comptoir", ar: "جاهزة للاستلام" },
    OUT_FOR_DELIVERY: { en: "Out for Delivery", fr: "En livraison", ar: "في طريق التوصيل" },
    DELIVERED: { en: "Delivered", fr: "Livrée", ar: "تم التسليم" },
    CANCELLED: { en: "Cancelled", fr: "Annulée", ar: "ملغاة" },
    BOOKED: { en: "Booked", fr: "Réservé", ar: "محجوز" },
    CONFIRMED: { en: "Confirmed", fr: "Confirmé", ar: "مؤكد" },
    CHECKED_IN: { en: "Checked In", fr: "Arrivé", ar: "حضر" },
    IN_PROGRESS: { en: "In Progress", fr: "En cours", ar: "قيد الفحص" },
    COMPLETED: { en: "Completed", fr: "Terminé", ar: "مكتمل" },
    NO_SHOW: { en: "No Show", fr: "Absent", ar: "لم يحضر" },
    ORDERED: { en: "Ordered", fr: "Prescrit", ar: "مطلوب" },
    SAMPLE_COLLECTED: { en: "Sample Collected", fr: "Prélèvement effectué", ar: "تم أخذ العينة" },
  };
  return map[status]?.[locale] ?? status;
}

function formatItemCount(count: number, locale: LocaleCode): string {
  if (locale === "fr") return `${count} ${count > 1 ? "articles" : "article"}`;
  if (locale === "ar") return `${count} منتجات`;
  return `${count} ${count === 1 ? "item" : "items"}`;
}

interface AdminOperationsTrackerPanelProps {
  pharmacyOrders: readonly PharmacyOrderSummary[];
  appointments: readonly AppointmentSummary[];
  prescriptions: readonly PrescriptionSummary[];
  labOrders: readonly LabOrderSummary[];
  currencyCode: string;
}

/** Real-time cross-domain operations tracker inside `/admin`. */
export function AdminOperationsTrackerPanel({
  pharmacyOrders,
  appointments,
  prescriptions,
  labOrders,
  currencyCode,
}: AdminOperationsTrackerPanelProps) {
  const { locale } = useLocale();
  const c = TRACKER_COPY[locale];
  const [section, setSection] = useState<"pharmacy" | "visits" | "rx" | "labs">(
    "pharmacy",
  );
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const settledRevenueMinor = useMemo(
    () =>
      pharmacyOrders
        .filter((o) => o.status !== "CANCELLED" && o.status !== "PENDING_PAYMENT")
        .reduce((sum, o) => sum + o.totalMinor, 0),
    [pharmacyOrders],
  );

  const activeOrderCount = useMemo(
    () =>
      pharmacyOrders.filter(
        (o) =>
          o.status === "PAID" ||
          o.status === "PREPARING" ||
          o.status === "OUT_FOR_DELIVERY",
      ).length,
    [pharmacyOrders],
  );

  const filteredOrders = useMemo(
    () =>
      pharmacyOrders.filter((o) =>
        q
          ? `${o.facilityName} ${o.patientName} ${o.receiptNumber ?? ""} ${o.status}`
              .toLowerCase()
              .includes(q)
          : true,
      ),
    [pharmacyOrders, q],
  );

  const filteredVisits = useMemo(
    () =>
      appointments.filter((a) =>
        q
          ? `${a.doctorName} ${a.patientName} ${a.facilityName} ${a.specialty}`
              .toLowerCase()
              .includes(q)
          : true,
      ),
    [appointments, q],
  );

  const filteredRx = useMemo(
    () =>
      prescriptions.filter((rx) =>
        q
          ? `${rx.patientName} ${rx.doctorName} ${rx.status} ${rx.medications.map((m) => m.name).join(" ")}`
              .toLowerCase()
              .includes(q)
          : true,
      ),
    [prescriptions, q],
  );

  const filteredLabs = useMemo(
    () =>
      labOrders.filter((l) =>
        q
          ? `${l.panelName} ${l.patientName} ${l.facilityName} ${l.status}`
              .toLowerCase()
              .includes(q)
          : true,
      ),
    [labOrders, q],
  );

  return (
    <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E4F2] pb-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-[#0F243E]">
            <Activity className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
            <span>{c.heading}</span>
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {c.settledRevenue}
            </p>
            <p className="font-mono-tabular text-sm font-bold text-[#0066CC]">
              {formatMoneyMinor(
                settledRevenueMinor,
                pharmacyOrders[0]?.currencyCode ?? currencyCode,
              )}
            </p>
          </div>
          <div className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {c.activeOrders}
            </p>
            <p className="font-mono-tabular text-sm font-bold text-[#0F243E]">
              {activeOrderCount}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-[#D7E4F2] bg-[#E8F1FA] p-1">
          {(
            [
              {
                id: "pharmacy",
                label: c.tabPharmacy(pharmacyOrders.length),
                icon: Pill,
              },
              {
                id: "visits",
                label: c.tabVisits(appointments.length),
                icon: CalendarClock,
              },
              {
                id: "rx",
                label: c.tabRx(prescriptions.length),
                icon: QrCode,
              },
              {
                id: "labs",
                label: c.tabLabs(labOrders.length),
                icon: FlaskConical,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                  section === item.id
                    ? "bg-[#0F243E] text-white"
                    : "text-slate-700 hover:bg-white hover:text-[#0F243E]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-[#D8DFDC] bg-[#F3F8FD] px-3 focus-within:border-[#0066CC] focus-within:bg-white">
          <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-xs text-[#0F243E] focus:outline-none"
          />
        </div>
      </div>

      {section === "pharmacy" ? (
        filteredOrders.length === 0 ? (
          <p className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-xs text-slate-500">
            {c.emptyText}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((ord) => (
              <article
                key={ord.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-950">
                      {ord.facilityName}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-slate-500">
                      {ord.receiptNumber ?? ord.id.slice(0, 8)}
                    </span>
                    <UiBadge
                      tone={
                        ord.status === "DELIVERED"
                          ? "emerald"
                          : ord.status === "CANCELLED"
                            ? "red"
                            : "teal"
                      }
                    >
                      {formatTrackerStatus(ord.status, locale)}
                    </UiBadge>
                  </div>
                  <p className="text-slate-600">
                    {ord.patientName} ·{" "}
                    {formatFulfillmentLabel(ord.fulfillmentMode, locale)} ·{" "}
                    {formatItemCount(ord.items.length, locale)}
                  </p>
                </div>
                <p className="font-mono-tabular text-sm font-bold text-slate-950">
                  {formatMoneyMinor(ord.totalMinor, ord.currencyCode)}
                </p>
              </article>
            ))}
          </div>
        )
      ) : null}

      {section === "visits" ? (
        filteredVisits.length === 0 ? (
          <p className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-xs text-slate-500 ">
            {c.emptyText}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredVisits.map((appt) => (
              <article
                key={appt.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs "
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-950">
                    {appt.doctorName} ·{" "}
                    <span className="font-normal text-slate-600">
                      {appt.specialty}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    {appt.patientName} · {appt.facilityName} ·{" "}
                    {formatVisitMode(appt.visitMode, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-[11px] text-slate-500">
                    {appt.slotStartIso.slice(0, 16).replace("T", " ")}
                  </span>
                  <UiBadge
                    tone={
                      appt.status === "COMPLETED"
                        ? "emerald"
                        : appt.status === "CANCELLED"
                          ? "red"
                          : "teal"
                    }
                  >
                    {formatTrackerStatus(appt.status, locale)}
                  </UiBadge>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {section === "rx" ? (
        filteredRx.length === 0 ? (
          <p className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-xs text-slate-500 ">
            {c.emptyText}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredRx.map((rx) => (
              <article
                key={rx.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs "
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-950">
                    {rx.patientName} · {rx.doctorName}
                  </p>
                  <p className="text-slate-600">
                    {rx.medications
                      .map((m) => `${m.name} (${m.dosage})`)
                      .join(", ")}
                  </p>
                </div>
                <UiBadge tone={rx.status === "DISPENSED" ? "emerald" : "teal"}>
                  {rx.status === "DISPENSED"
                    ? c.rxDispensedBadge
                    : c.rxIssuedBadge}
                </UiBadge>
              </article>
            ))}
          </div>
        )
      ) : null}

      {section === "labs" ? (
        filteredLabs.length === 0 ? (
          <p className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-xs text-slate-500 ">
            {c.emptyText}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredLabs.map((lab) => (
              <article
                key={lab.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs "
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-950">
                    {lab.panelName} · {lab.patientName}
                  </p>
                  <p className="text-slate-600">
                    {lab.facilityName} · {formatUrgencyLabel(lab.urgency, locale)}
                  </p>
                </div>
                <UiBadge tone={lab.status === "COMPLETED" ? "emerald" : "amber"}>
                  {formatTrackerStatus(lab.status, locale)}
                </UiBadge>
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
