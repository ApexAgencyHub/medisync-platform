import { z } from "zod";
import { DriverStatusSchema } from "./geo.js";
import { FacilityKindSchema, UserRoleSchema } from "./roles.js";
import { VerificationStatusSchema } from "./facility.js";

export const DirectorySearchQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  city: z.string().trim().max(64).optional(),
  q: z.string().trim().max(100).optional(),
  kind: FacilityKindSchema.optional(),
  specialty: z.string().trim().max(80).optional(),
  insurance: z.string().trim().max(48).optional(),
  language: z.string().trim().max(16).optional(),
  telehealthOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  homeVisitOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "true" || v === true ? true : undefined)),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

export type DirectorySearchQuery = z.infer<typeof DirectorySearchQuerySchema>;

export const DirectoryPatientSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable().optional(),
  role: z.enum(["PATIENT", "CAREGIVER"]),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  avatarUrl: z.string().url().nullable().default(null),
});

export type DirectoryPatientSummary = z.infer<
  typeof DirectoryPatientSummarySchema
>;

export const DirectoryPatientsResponseSchema = z.object({
  patients: z.array(DirectoryPatientSummarySchema),
});

export type DirectoryPatientsResponse = z.infer<
  typeof DirectoryPatientsResponseSchema
>;

export const DirectoryDoctorSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  role: z.enum(["DOCTOR", "NURSE"]).default("DOCTOR"),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  specialty: z.string(),
  facilityId: z.string().uuid().nullable(),
  facilityName: z.string().nullable(),
  facilityCity: z.string().nullable().optional(),
  consultationFeeMinor: z.number().int().nonnegative(),
  languagesSpoken: z.array(z.string()).default(["ar", "fr", "en"]),
  acceptedInsurances: z.array(z.string()).default(["AMO", "CNOPS", "CNSS"]),
  telehealthEnabled: z.boolean().default(true),
  homeVisitEnabled: z.boolean().default(false),
  credentialVerified: z.boolean().default(false),
  avatarUrl: z.string().url().nullable().default(null),
});

export type DirectoryDoctorSummary = z.infer<
  typeof DirectoryDoctorSummarySchema
>;

export const DirectoryDoctorsResponseSchema = z.object({
  doctors: z.array(DirectoryDoctorSummarySchema),
});

export type DirectoryDoctorsResponse = z.infer<
  typeof DirectoryDoctorsResponseSchema
>;

export const DirectoryFacilitySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: FacilityKindSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  licenseNumber: z.string(),
  verificationStatus: VerificationStatusSchema,
  openStatus: z.string(),
  city: z.string().nullable().optional(),
  address: z.string(),
  acceptedInsurances: z.array(z.string()).default(["AMO", "CNOPS", "CNSS"]),
  languagesSpoken: z.array(z.string()).default(["ar", "fr", "en"]),
  telehealthEnabled: z.boolean().default(true),
  homeVisitEnabled: z.boolean().default(false),
  lat: z.number(),
  lng: z.number(),
});

export type DirectoryFacilitySummary = z.infer<
  typeof DirectoryFacilitySummarySchema
>;

export const DirectoryFacilitiesResponseSchema = z.object({
  facilities: z.array(DirectoryFacilitySummarySchema),
});

export type DirectoryFacilitiesResponse = z.infer<
  typeof DirectoryFacilitiesResponseSchema
>;

export const DemoPersonaSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  demoPassword: z.string().min(1),
  fullName: z.string(),
  role: UserRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  headline: z.string(),
});

export type DemoPersonaSummary = z.infer<typeof DemoPersonaSummarySchema>;

export const DemoPersonasResponseSchema = z.object({
  personas: z.array(DemoPersonaSummarySchema),
});

export type DemoPersonasResponse = z.infer<typeof DemoPersonasResponseSchema>;

export const VehicleTypeSchema = z.enum(["AMBULANCE", "MEDICAL_SHUTTLE"]);
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

export const DirectoryDriverSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid().nullable(),
  facilityName: z.string().nullable(),
  facilityCity: z.string().nullable().optional(),
  vehicleType: VehicleTypeSchema,
  vehicleLabel: z.string(),
  serviceZone: z.string(),
  liveStatus: DriverStatusSchema.nullable(),
  avatarUrl: z.string().url().nullable().default(null),
});

export type DirectoryDriverSummary = z.infer<
  typeof DirectoryDriverSummarySchema
>;

export const DirectoryDriversResponseSchema = z.object({
  drivers: z.array(DirectoryDriverSummarySchema),
});

export type DirectoryDriversResponse = z.infer<
  typeof DirectoryDriversResponseSchema
>;
