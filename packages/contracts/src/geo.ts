import { z } from "zod";
import { FacilitySummarySchema } from "./facility.js";
import { FacilityKindSchema } from "./roles.js";

export const FacilityOpenStatusSchema = z.enum(["OPEN", "BUSY", "CLOSED"]);
export type FacilityOpenStatus = z.infer<typeof FacilityOpenStatusSchema>;

export const FacilityViewportQuerySchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2,4}$/),
    minLng: z.coerce.number().min(-180).max(180),
    minLat: z.coerce.number().min(-90).max(90),
    maxLng: z.coerce.number().min(-180).max(180),
    maxLat: z.coerce.number().min(-90).max(90),
    kind: FacilityKindSchema.optional(),
    openNow: z.coerce.boolean().optional(),
    acceptsEmergency: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((val) => val.minLng <= val.maxLng && val.minLat <= val.maxLat, {
    message: "Viewport min coordinates must not exceed max coordinates.",
  });

export type FacilityViewportQuery = z.infer<typeof FacilityViewportQuerySchema>;

export const ViewportFacilityItemSchema = FacilitySummarySchema.extend({
  openStatus: FacilityOpenStatusSchema,
  is24_7: z.boolean(),
  acceptsEmergency: z.boolean(),
  specialties: z.array(z.string()),
  phone: z.string().nullable(),
  distanceMeters: z.number().nonnegative().nullable(),
});

export type ViewportFacilityItem = z.infer<typeof ViewportFacilityItemSchema>;

export const FacilityViewportResponseSchema = z.object({
  facilities: z.array(ViewportFacilityItemSchema),
  queryMs: z.number().nonnegative(),
});

export type FacilityViewportResponse = z.infer<
  typeof FacilityViewportResponseSchema
>;

export const UpdateFacilityOperationalStatusSchema = z.object({
  openStatus: FacilityOpenStatusSchema,
  is24_7: z.boolean().optional(),
  acceptsEmergency: z.boolean().optional(),
  specialties: z.array(z.string().min(2).max(64)).max(15).optional(),
  phone: z.string().min(3).max(32).nullable().optional(),
});

export type UpdateFacilityOperationalStatusInput = z.infer<
  typeof UpdateFacilityOperationalStatusSchema
>;

export const DriverStatusSchema = z.enum([
  "AVAILABLE",
  "ASSIGNED",
  "EN_ROUTE",
  "OFF_DUTY",
]);
export type DriverStatus = z.infer<typeof DriverStatusSchema>;

export const DriverPingSchema = z.object({
  driverId: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  headingDeg: z.number().min(0).max(360).optional(),
  status: DriverStatusSchema,
  recordedAtIso: z.string().datetime(),
});

export type DriverPing = z.infer<typeof DriverPingSchema>;

export const DriverPingInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  headingDeg: z.number().min(0).max(360).optional(),
  status: DriverStatusSchema,
});

export type DriverPingInput = z.infer<typeof DriverPingInputSchema>;
