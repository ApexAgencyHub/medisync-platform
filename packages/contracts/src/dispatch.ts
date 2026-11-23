import { z } from "zod";
import { DriverStatusSchema } from "./geo.js";

export const NearbyDriversQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(100).default(15),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type NearbyDriversQuery = z.infer<typeof NearbyDriversQuerySchema>;

export const LiveDriverMarkerSchema = z.object({
  driverId: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  headingDeg: z.number().min(0).max(360).nullable(),
  status: DriverStatusSchema,
  distanceKm: z.number().nonnegative(),
  recordedAtIso: z.string().datetime(),
});

export type LiveDriverMarker = z.infer<typeof LiveDriverMarkerSchema>;

export const NearbyDriversResponseSchema = z.object({
  drivers: z.array(LiveDriverMarkerSchema),
  queryMs: z.number().nonnegative(),
});

export type NearbyDriversResponse = z.infer<typeof NearbyDriversResponseSchema>;

export const DispatchUrgencySchema = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);
export type DispatchUrgency = z.infer<typeof DispatchUrgencySchema>;

export const DispatchStatusSchema = z.enum([
  "REQUESTED",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
]);
export type DispatchStatus = z.infer<typeof DispatchStatusSchema>;

export const CreateDispatchRequestSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupAddress: z.string().min(4).max(280),
  targetFacilityId: z.string().uuid().optional(),
  urgency: DispatchUrgencySchema.default("URGENT"),
  notes: z.string().max(500).optional(),
});

export type CreateDispatchRequestInput = z.infer<
  typeof CreateDispatchRequestSchema
>;

export const TransitionDispatchStatusSchema = z.object({
  status: DispatchStatusSchema,
  driverUserId: z.string().uuid().optional(),
});

export type TransitionDispatchStatusInput = z.infer<
  typeof TransitionDispatchStatusSchema
>;

export const DispatchListQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  status: DispatchStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export type DispatchListQuery = z.infer<typeof DispatchListQuerySchema>;

export const DRIVER_OFFER_WINDOW_SECONDS = 60;

export const DispatchRequestSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  driverUserId: z.string().uuid().nullable(),
  targetFacilityId: z.string().uuid().nullable(),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupAddress: z.string(),
  urgency: DispatchUrgencySchema,
  status: DispatchStatusSchema,
  notes: z.string().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
  offerExpiresAtIso: z.string().datetime().optional(),
  offerWindowSeconds: z.number().int().positive().optional(),
  offerRemainingMs: z.number().int().nonnegative().optional(),
});

export type DispatchRequestSummary = z.infer<
  typeof DispatchRequestSummarySchema
>;

export const DispatchListResponseSchema = z.object({
  dispatches: z.array(DispatchRequestSummarySchema),
  driverDutyStatus: DriverStatusSchema.optional(),
});

export type DispatchListResponse = z.infer<typeof DispatchListResponseSchema>;

export const DispatchResponseSchema = z.object({
  dispatch: DispatchRequestSummarySchema,
});

export const DeclineDispatchRequestSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type DeclineDispatchRequestInput = z.infer<
  typeof DeclineDispatchRequestSchema
>;

export const DeclineDispatchResponseSchema = z.object({
  declined: z.literal(true),
  dispatchId: z.string().uuid(),
  releasedToQueue: z.boolean(),
  dispatch: DispatchRequestSummarySchema.optional(),
});

export type DeclineDispatchResponse = z.infer<
  typeof DeclineDispatchResponseSchema
>;

export const DriverResponseSchema = z.object({
  driver: LiveDriverMarkerSchema,
});

export const DispatchStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    countryCode: z.string().regex(/^[A-Z]{2,4}$/),
    timestampIso: z.string().datetime(),
  }),
  z.object({
    type: z.literal("driver.location"),
    driver: LiveDriverMarkerSchema.omit({ distanceKm: true }).extend({
      distanceKm: z.number().nonnegative().default(0),
    }),
  }),
  z.object({
    type: z.literal("dispatch.updated"),
    dispatch: DispatchRequestSummarySchema,
  }),
  z.object({
    type: z.literal("dispatch.offer_expired"),
    dispatchId: z.string().uuid(),
    reason: z.string(),
    expiredAtIso: z.string().datetime(),
  }),
]);

export type DispatchStreamEvent = z.infer<typeof DispatchStreamEventSchema>;
