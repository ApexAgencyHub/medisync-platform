import { z } from "zod";
import { AuthenticatedUserSchema } from "./auth.js";

export const LegalConsentTypeSchema = z.enum([
  "TERMS_PRIVACY",
  "TELEHEALTH_CONSENT",
  "DATA_SHARING",
  "MARKETING_OPT_IN",
]);
export type LegalConsentType = z.infer<typeof LegalConsentTypeSchema>;

export const ConsentSourcePortalSchema = z.enum([
  "PATIENT",
  "STAFF",
  "PROFILE",
]);
export type ConsentSourcePortal = z.infer<typeof ConsentSourcePortalSchema>;

export const LegalConsentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  consentType: LegalConsentTypeSchema,
  consentVersion: z.string(),
  granted: z.boolean(),
  sourcePortal: ConsentSourcePortalSchema,
  grantedAtIso: z.string().datetime(),
  revokedAtIso: z.string().datetime().nullable(),
});
export type LegalConsentRecord = z.infer<typeof LegalConsentRecordSchema>;

export const RecordConsentInputSchema = z.object({
  consentType: LegalConsentTypeSchema,
  consentVersion: z.string().trim().min(1).max(32).default("2026-11"),
  granted: z.boolean(),
  sourcePortal: ConsentSourcePortalSchema.default("PROFILE"),
});
export type RecordConsentInput = z.infer<typeof RecordConsentInputSchema>;

export const UserConsentsResponseSchema = z.object({
  consents: z.array(LegalConsentRecordSchema),
});
export type UserConsentsResponse = z.infer<typeof UserConsentsResponseSchema>;

export const AllergyWarningSchema = z.object({
  allergen: z.string(),
  severity: z.string(),
  matchedMedication: z.string(),
  message: z.string(),
});
export type AllergyWarning = z.infer<typeof AllergyWarningSchema>;

export const UserDataExportResponseSchema = z.object({
  exportedAtIso: z.string().datetime(),
  standard: z.literal("CNDP-09-08/GDPR-ART20"),
  user: AuthenticatedUserSchema,
  consents: z.array(LegalConsentRecordSchema),
  medicalProfile: z.record(z.string(), z.unknown()).nullable(),
  insurances: z.array(z.record(z.string(), z.unknown())),
  appointments: z.array(z.record(z.string(), z.unknown())),
  prescriptions: z.array(z.record(z.string(), z.unknown())),
  labOrders: z.array(z.record(z.string(), z.unknown())),
  pharmacyOrders: z.array(z.record(z.string(), z.unknown())),
  dispatches: z.array(z.record(z.string(), z.unknown())),
});
export type UserDataExportResponse = z.infer<typeof UserDataExportResponseSchema>;

export const DeleteAccountInputSchema = z.object({
  confirmation: z.literal("DELETE_MY_ACCOUNT"),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

export const DeleteAccountResponseSchema = z.object({
  deleted: z.boolean(),
  anonymizedUserId: z.string().uuid(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

export const PaymentWebhookProviderSchema = z.enum([
  "STRIPE",
  "CMI_MAROC",
  "MANUAL_BANK",
]);
export type PaymentWebhookProvider = z.infer<
  typeof PaymentWebhookProviderSchema
>;

export const PaymentWebhookEventSchema = z.object({
  eventId: z.string().trim().min(4).max(128),
  provider: PaymentWebhookProviderSchema,
  resourceType: z.enum(["PHARMACY_ORDER", "MEDICAL_INVOICE"]),
  resourceId: z.string().uuid(),
  amountMinor: z.coerce.number().int().positive(),
  currencyCode: z.string().length(3),
  paymentReference: z.string().trim().min(3).max(120),
  status: z.enum(["SUCCEEDED", "FAILED"]),
});
export type PaymentWebhookEvent = z.infer<typeof PaymentWebhookEventSchema>;
