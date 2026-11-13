import { z } from "zod";

export const HealthCheckProbeSchema = z.object({
  status: z.enum(["OK", "DEGRADED"]),
  latencyMs: z.number().nonnegative(),
});

export type HealthCheckProbe = z.infer<typeof HealthCheckProbeSchema>;

export const PlatformEntityCountsSchema = z.object({
  users: z.number().int().nonnegative(),
  verifiedFacilities: z.number().int().nonnegative(),
  activeDispatches: z.number().int().nonnegative(),
  pharmacyOrders: z.number().int().nonnegative(),
  clinicalMediaObjects: z.number().int().nonnegative(),
});

export type PlatformEntityCounts = z.infer<typeof PlatformEntityCountsSchema>;

export const PlatformMetricsResponseSchema = z.object({
  service: z.literal("medisync-api"),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  dependencies: z.object({
    postgres: HealthCheckProbeSchema,
    redis: HealthCheckProbeSchema,
  }),
  counts: PlatformEntityCountsSchema,
});

export type PlatformMetricsResponse = z.infer<
  typeof PlatformMetricsResponseSchema
>;

export const MobileTelemetryHeartbeatSchema = z.object({
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().min(1).max(32),
  countryCode: z.string().min(2).max(12),
  capabilities: z.object({
    cameraQr: z.boolean(),
    backgroundLocation: z.boolean(),
    binaryMediaPicker: z.boolean(),
  }),
});

export type MobileTelemetryHeartbeat = z.infer<
  typeof MobileTelemetryHeartbeatSchema
>;
