import { z } from "zod";

export const BloodTypeSchema = z.enum([
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "UNKNOWN",
]);
export type BloodType = z.infer<typeof BloodTypeSchema>;

export const BiologicalSexSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
  "UNSPECIFIED",
]);
export type BiologicalSex = z.infer<typeof BiologicalSexSchema>;

export const AllergySeveritySchema = z.enum([
  "MILD",
  "MODERATE",
  "SEVERE",
  "LIFE_THREATENING",
]);
export type AllergySeverity = z.infer<typeof AllergySeveritySchema>;

export const PatientAllergyItemSchema = z.object({
  allergen: z.string().trim().min(1).max(120),
  severity: AllergySeveritySchema.default("MODERATE"),
  reaction: z.string().trim().max(200).optional(),
});
export type PatientAllergyItem = z.infer<typeof PatientAllergyItemSchema>;

export const UpsertPatientMedicalProfileSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
    .nullable()
    .optional(),
  biologicalSex: BiologicalSexSchema.default("UNSPECIFIED"),
  bloodType: BloodTypeSchema.default("UNKNOWN"),
  nationalHealthId: z.string().trim().max(64).nullable().optional(),
  emergencyContactName: z.string().trim().max(120).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(32).nullable().optional(),
  heightCm: z.coerce.number().min(30).max(260).nullable().optional(),
  weightKg: z.coerce.number().min(1).max(400).nullable().optional(),
  allergies: z.array(PatientAllergyItemSchema).max(50).default([]),
  chronicConditions: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  currentMedications: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  primaryDoctorUserId: z.string().uuid().nullable().optional(),
  preferredFacilityId: z.string().uuid().nullable().optional(),
  dataSharingConsent: z.boolean().default(true),
  telehealthConsent: z.boolean().default(true),
});
export type UpsertPatientMedicalProfileInput = z.infer<
  typeof UpsertPatientMedicalProfileSchema
>;

export const PatientMedicalProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  dateOfBirth: z.string().nullable(),
  biologicalSex: BiologicalSexSchema,
  bloodType: BloodTypeSchema,
  nationalHealthId: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  allergies: z.array(PatientAllergyItemSchema),
  chronicConditions: z.array(z.string()),
  currentMedications: z.array(z.string()),
  primaryDoctorUserId: z.string().uuid().nullable(),
  preferredFacilityId: z.string().uuid().nullable(),
  dataSharingConsent: z.boolean(),
  telehealthConsent: z.boolean(),
  updatedAtIso: z.string().datetime(),
});
export type PatientMedicalProfile = z.infer<typeof PatientMedicalProfileSchema>;

export const PatientMedicalProfileResponseSchema = z.object({
  profile: PatientMedicalProfileSchema,
});

export type PatientMedicalProfileResponse = z.infer<
  typeof PatientMedicalProfileResponseSchema
>;

export const CreatePatientInsuranceSchema = z.object({
  providerName: z.string().trim().min(2).max(120),
  policyNumber: z.string().trim().min(3).max(80),
  memberId: z.string().trim().min(2).max(80),
  coveragePlan: z.string().trim().min(2).max(80).default("STANDARD"),
  coveragePercent: z.coerce.number().int().min(0).max(100).default(70),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
    .nullable()
    .optional(),
  isPrimary: z.boolean().default(false),
  cardMediaId: z.string().uuid().nullable().optional(),
});
export type CreatePatientInsuranceInput = z.infer<
  typeof CreatePatientInsuranceSchema
>;

export const PatientInsurancePolicySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  providerName: z.string(),
  policyNumber: z.string(),
  memberId: z.string(),
  coveragePlan: z.string(),
  coveragePercent: z.number().int().min(0).max(100),
  validUntil: z.string().nullable(),
  isPrimary: z.boolean(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "EXPIRED", "REJECTED"]),
  cardMediaId: z.string().uuid().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});
export type PatientInsurancePolicy = z.infer<
  typeof PatientInsurancePolicySchema
>;

export const PatientInsuranceResponseSchema = z.object({
  policy: PatientInsurancePolicySchema,
});

export type PatientInsuranceResponse = z.infer<
  typeof PatientInsuranceResponseSchema
>;

export const PatientInsuranceListResponseSchema = z.object({
  policies: z.array(PatientInsurancePolicySchema),
});

export type PatientInsuranceListResponse = z.infer<
  typeof PatientInsuranceListResponseSchema
>;

export const MedicalServiceCategorySchema = z.enum([
  "CONSULTATION",
  "LAB_TEST",
  "IMAGING",
  "HOME_CARE",
  "SURGERY",
  "PHARMACY_SERVICE",
  "AMBULANCE",
  "VACCINATION",
  "TELEHEALTH",
]);
export type MedicalServiceCategory = z.infer<
  typeof MedicalServiceCategorySchema
>;

export const CreateMedicalServiceSchema = z.object({
  facilityId: z.string().uuid(),
  category: MedicalServiceCategorySchema,
  serviceCode: z.string().trim().min(2).max(48),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(600).optional(),
  specialty: z.string().trim().max(120).optional(),
  priceMinor: z.coerce.number().int().min(0).max(100_000_000),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  homeServiceAvailable: z.boolean().default(false),
  telehealthAvailable: z.boolean().default(false),
  requiresReferral: z.boolean().default(false),
});
export type CreateMedicalServiceInput = z.infer<
  typeof CreateMedicalServiceSchema
>;

export const MedicalServiceSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  category: MedicalServiceCategorySchema,
  serviceCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  specialty: z.string().nullable(),
  priceMinor: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  durationMinutes: z.number().int().positive(),
  homeServiceAvailable: z.boolean(),
  telehealthAvailable: z.boolean(),
  requiresReferral: z.boolean(),
  isActive: z.boolean(),
  createdAtIso: z.string().datetime(),
});
export type MedicalServiceSummary = z.infer<typeof MedicalServiceSummarySchema>;

export const MedicalServiceListResponseSchema = z.object({
  services: z.array(MedicalServiceSummarySchema),
});

export const ListMedicalServicesQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  facilityId: z.string().uuid().optional(),
  category: MedicalServiceCategorySchema.optional(),
  q: z.string().trim().max(120).optional(),
  homeServiceOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  telehealthOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMedicalServicesQuery = z.infer<
  typeof ListMedicalServicesQuerySchema
>;

export const InvoiceSourceTypeSchema = z.enum([
  "APPOINTMENT",
  "LAB_ORDER",
  "DISPATCH",
  "PHARMACY_ORDER",
  "SERVICE",
]);
export type InvoiceSourceType = z.infer<typeof InvoiceSourceTypeSchema>;

export const InvoiceStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "PAID",
  "PARTIALLY_COVERED",
  "VOID",
  "REFUNDED",
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const CreateMedicalInvoiceSchema = z.object({
  patientUserId: z.string().uuid(),
  facilityId: z.string().uuid(),
  sourceType: InvoiceSourceTypeSchema,
  sourceId: z.string().uuid().optional(),
  description: z.string().trim().min(2).max(240),
  subtotalMinor: z.coerce.number().int().min(1).max(100_000_000),
  insurancePolicyId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(4).max(128).optional(),
});
export type CreateMedicalInvoiceInput = z.infer<
  typeof CreateMedicalInvoiceSchema
>;

export const PayMedicalInvoiceSchema = z.object({
  paymentMethod: z
    .enum(["CARD", "CASH_ON_VISIT", "INSURANCE_DIRECT", "MOBILE_WALLET"])
    .default("CARD"),
  paymentReference: z.string().trim().min(2).max(120).optional(),
});
export type PayMedicalInvoiceInput = z.infer<typeof PayMedicalInvoiceSchema>;

export const MedicalInvoiceSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  invoiceNumber: z.string(),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  sourceType: InvoiceSourceTypeSchema,
  sourceId: z.string().uuid().nullable(),
  description: z.string(),
  currencyCode: z.string().length(3),
  subtotalMinor: z.number().int().positive(),
  insuranceCoveredMinor: z.number().int().nonnegative(),
  patientPayableMinor: z.number().int().nonnegative(),
  status: InvoiceStatusSchema,
  paymentMethod: z.string().nullable(),
  paymentReference: z.string().nullable(),
  insurancePolicyId: z.string().uuid().nullable(),
  paidAtIso: z.string().datetime().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});
export type MedicalInvoiceSummary = z.infer<typeof MedicalInvoiceSummarySchema>;

export const ListMedicalInvoicesQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  patientUserId: z.string().uuid().optional(),
  status: InvoiceStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMedicalInvoicesQuery = z.infer<
  typeof ListMedicalInvoicesQuerySchema
>;
