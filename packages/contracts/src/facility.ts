import { z } from "zod";
import { FacilityKindSchema } from "./roles.js";

export const VerificationStatusSchema = z.enum([
  "PENDING_REVIEW",
  "VERIFIED",
  "SUSPENDED",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const CreateFacilitySchema = z.object({
  name: z.string().min(2).max(160),
  kind: FacilityKindSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  licenseNumber: z.string().min(4).max(64),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(4).max(280),
});

export type CreateFacilityInput = z.infer<typeof CreateFacilitySchema>;

export const FacilityListQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  kind: FacilityKindSchema.optional(),
  status: VerificationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FacilityListQuery = z.infer<typeof FacilityListQuerySchema>;

export const VerifyFacilitySchema = z.object({
  status: z.enum(["VERIFIED", "SUSPENDED"]),
  note: z.string().max(500).optional(),
});

export type VerifyFacilityInput = z.infer<typeof VerifyFacilitySchema>;

export const FacilitySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: FacilityKindSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  licenseNumber: z.string(),
  verificationStatus: VerificationStatusSchema,
  lat: z.number(),
  lng: z.number(),
  address: z.string(),
  ownerUserId: z.string().uuid(),
  createdAtIso: z.string().datetime(),
});

export type FacilitySummary = z.infer<typeof FacilitySummarySchema>;

export const FacilityResponseSchema = z.object({
  facility: FacilitySummarySchema,
});

export const FacilitiesListResponseSchema = z.object({
  facilities: z.array(FacilitySummarySchema),
});
