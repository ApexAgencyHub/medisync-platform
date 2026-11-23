import type {
  FulfillmentMode,
  PaymentMethod,
  PharmacyOrderStatus,
  PharmacyProductCategory,
} from "@medisync/contracts";

export interface CartLine {
  product: import("@medisync/contracts").PharmacyProductSummary;
  quantity: number;
}

export type CatalogSortOption =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "name_asc";

export type CatalogSafetyFilter = "ALL" | "OTC_ONLY" | "RX_ONLY";

export const CATEGORY_LABELS: Record<PharmacyProductCategory, string> = {
  OTC_MEDICATION: "OTC Care",
  PRESCRIPTION_RX: "Prescription Rx",
  MEDICAL_DEVICE: "Devices",
  WELLNESS_SUPPLEMENT: "Supplements",
  PEDIATRIC_CARE: "Pediatric",
  COLD_CHAIN: "Cold Chain 2-8°C",
};

export const CLINICAL_CATEGORY_GUIDANCE: Record<
  PharmacyProductCategory,
  string
> = {
  OTC_MEDICATION:
    "Over-the-counter formulation verified by licensed pharmacists.",
  PRESCRIPTION_RX:
    "Dispensing requires a signed physician QR E-Prescription at checkout.",
  MEDICAL_DEVICE:
    "Calibrated medical hardware inspected for home or clinical monitoring.",
  WELLNESS_SUPPLEMENT:
    "Pharmaceutical-grade nutritional or supportive care formulation.",
  PEDIATRIC_CARE:
    "Formulated for pediatric hydration or child care; confirm weight dosing.",
  COLD_CHAIN:
    "Temperature-sensitive 2-8°C biologic. Dispatched in insulated cold packs.",
};

export function formatMinorMoney(
  minor: number,
  currencyCode: string,
  divisor = 100,
): string {
  const major = (minor / divisor).toFixed(2);
  return `${major} ${currencyCode}`;
}

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  PHARMACY_PICKUP: "Pharmacy Counter Pickup",
  COURIER_DELIVERY: "Express Medical Courier",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD_SIMULATED: "Online Card / Instant Receipt",
  INSURANCE_COPAY: "Insurance / Mutuelle Co-Pay",
  CASH_ON_DELIVERY: "Cash / Counter Payment",
};

export const ORDER_STATUS_META: Record<
  PharmacyOrderStatus,
  { label: string; tone: "amber" | "teal" | "slate" | "emerald" | "red" }
> = {
  PENDING_PAYMENT: { label: "Awaiting Payment", tone: "amber" },
  PAID: { label: "Paid · Sent to Pharmacy", tone: "teal" },
  PREPARING: { label: "Preparing Medication", tone: "amber" },
  OUT_FOR_DELIVERY: { label: "Courier En Route", tone: "teal" },
  DELIVERED: { label: "Delivered / Completed", tone: "emerald" },
  CANCELLED: { label: "Cancelled · Restocked", tone: "red" },
};
