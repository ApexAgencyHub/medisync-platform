import { z } from "zod";

export const LocaleCodeSchema = z.enum(["en", "fr", "ar"]);
export type LocaleCode = z.infer<typeof LocaleCodeSchema>;

export const PharmacyProductCategorySchema = z.enum([
  "OTC_MEDICATION",
  "PRESCRIPTION_RX",
  "MEDICAL_DEVICE",
  "WELLNESS_SUPPLEMENT",
  "PEDIATRIC_CARE",
  "COLD_CHAIN",
]);
export type PharmacyProductCategory = z.infer<
  typeof PharmacyProductCategorySchema
>;

export const CreatePharmacyProductSchema = z.object({
  facilityId: z.string().uuid().optional(),
  sku: z.string().trim().min(2).max(48),
  name: z.string().trim().min(2).max(160),
  genericName: z.string().trim().max(160).optional(),
  category: PharmacyProductCategorySchema,
  dosageForm: z.string().trim().min(1).max(80).default("Tablet"),
  strength: z.string().trim().min(1).max(64).default("500mg"),
  requiresPrescription: z.boolean().default(false),
  priceMinor: z.coerce.number().int().min(10).max(100_000_000),
  stockQty: z.coerce.number().int().min(0).max(100_000),
  imageObjectKey: z.string().trim().max(320).optional(),
});
export type CreatePharmacyProductInput = z.infer<
  typeof CreatePharmacyProductSchema
>;

export const UpdatePharmacyProductSchema = z.object({
  sku: z.string().trim().min(2).max(48).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  genericName: z.string().trim().max(160).nullable().optional(),
  category: PharmacyProductCategorySchema.optional(),
  dosageForm: z.string().trim().min(1).max(80).optional(),
  strength: z.string().trim().min(1).max(64).optional(),
  requiresPrescription: z.boolean().optional(),
  priceMinor: z.coerce.number().int().min(10).max(100_000_000).optional(),
  stockQty: z.coerce.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePharmacyProductInput = z.infer<
  typeof UpdatePharmacyProductSchema
>;

export const PharmacyProductSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  facilityCity: z.string().nullable().optional(),
  sku: z.string(),
  name: z.string(),
  genericName: z.string().nullable(),
  category: PharmacyProductCategorySchema,
  dosageForm: z.string(),
  strength: z.string(),
  requiresPrescription: z.boolean(),
  priceMinor: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  stockQty: z.number().int().nonnegative(),
  isActive: z.boolean(),
  imageUrl: z.string().url().nullable().default(null),
  createdAtIso: z.string().datetime(),
});
export type PharmacyProductSummary = z.infer<
  typeof PharmacyProductSummarySchema
>;

export const ListPharmacyProductsQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  city: z.string().trim().max(64).optional(),
  facilityId: z.string().uuid().optional(),
  category: PharmacyProductCategorySchema.optional(),
  q: z.string().trim().max(120).optional(),
  inStockOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  includeInactive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  limit: z.coerce.number().int().min(1).max(250).default(100),
});
export type ListPharmacyProductsQuery = z.infer<
  typeof ListPharmacyProductsQuerySchema
>;

export const PharmacyProductsResponseSchema = z.object({
  products: z.array(PharmacyProductSummarySchema),
  deliveryFeeMinor: z.number().int().nonnegative().optional(),
});
export type PharmacyProductsResponse = z.infer<
  typeof PharmacyProductsResponseSchema
>;

export const PharmacyProductResponseSchema = z.object({
  product: PharmacyProductSummarySchema,
});
export type PharmacyProductResponse = z.infer<
  typeof PharmacyProductResponseSchema
>;

export const FulfillmentModeSchema = z.enum([
  "PHARMACY_PICKUP",
  "COURIER_DELIVERY",
]);
export type FulfillmentMode = z.infer<typeof FulfillmentModeSchema>;

export const PharmacyOrderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
export type PharmacyOrderStatus = z.infer<typeof PharmacyOrderStatusSchema>;

export const PaymentMethodSchema = z.enum([
  "CARD_SIMULATED",
  "CASH_ON_DELIVERY",
  "INSURANCE_COPAY",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const CreatePharmacyOrderSchema = z.object({
  facilityId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
  fulfillmentMode: FulfillmentModeSchema.default("PHARMACY_PICKUP"),
  deliveryAddress: z.string().trim().max(280).optional(),
  deliveryLat: z.coerce.number().min(-90).max(90).optional(),
  deliveryLng: z.coerce.number().min(-180).max(180).optional(),
  prescriptionId: z.string().uuid().optional(),
  notes: z.string().trim().max(400).optional(),
});
export type CreatePharmacyOrderInput = z.infer<
  typeof CreatePharmacyOrderSchema
>;

export const ConfirmOrderPaymentSchema = z.object({
  paymentMethod: PaymentMethodSchema.default("CARD_SIMULATED"),
  paymentReference: z.string().trim().max(120).optional(),
});
export type ConfirmOrderPaymentInput = z.infer<
  typeof ConfirmOrderPaymentSchema
>;

export const UpdatePharmacyOrderStatusSchema = z.object({
  status: z.enum(["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
});
export type UpdatePharmacyOrderStatusInput = z.infer<
  typeof UpdatePharmacyOrderStatusSchema
>;

export const PharmacyOrderItemSummarySchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  requiresPrescription: z.boolean(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().positive(),
  lineTotalMinor: z.number().int().positive(),
});
export type PharmacyOrderItemSummary = z.infer<
  typeof PharmacyOrderItemSummarySchema
>;

export const PharmacyOrderSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  prescriptionId: z.string().uuid().nullable(),
  fulfillmentMode: FulfillmentModeSchema,
  deliveryAddress: z.string().nullable(),
  dispatchRequestId: z.string().uuid().nullable(),
  status: PharmacyOrderStatusSchema,
  currencyCode: z.string().length(3),
  subtotalMinor: z.number().int().nonnegative(),
  deliveryFeeMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  paymentMethod: PaymentMethodSchema.nullable(),
  paymentReference: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  notes: z.string().nullable(),
  paidAtIso: z.string().datetime().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
  items: z.array(PharmacyOrderItemSummarySchema),
});
export type PharmacyOrderSummary = z.infer<typeof PharmacyOrderSummarySchema>;

export const PharmacyOrderResponseSchema = z.object({
  order: PharmacyOrderSummarySchema,
});
export type PharmacyOrderResponse = z.infer<typeof PharmacyOrderResponseSchema>;

export const PharmacyOrdersResponseSchema = z.object({
  orders: z.array(PharmacyOrderSummarySchema),
});
export type PharmacyOrdersResponse = z.infer<
  typeof PharmacyOrdersResponseSchema
>;
