import { z } from "zod";
import { FacilityKindSchema } from "./roles.js";

export const FacilityViewportQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  kind: FacilityKindSchema.optional(),
  openNow: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type FacilityViewportQuery = z.infer<typeof FacilityViewportQuerySchema>;

export const DriverPingSchema = z.object({
  driverId: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  headingDeg: z.number().min(0).max(360).optional(),
  status: z.enum(["AVAILABLE", "ASSIGNED", "EN_ROUTE", "OFF_DUTY"]),
  recordedAtIso: z.string().datetime(),
});

export type DriverPing = z.infer<typeof DriverPingSchema>;
