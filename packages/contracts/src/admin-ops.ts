import { z } from "zod";
import { AuditEventSchema } from "./audit.js";
import { AuthenticatedUserSchema } from "./auth.js";
import { DispatchStatusSchema } from "./dispatch.js";
import { UserRoleSchema } from "./roles.js";

export const DisputeCategorySchema = z.enum([
  "BOOKING_NO_SHOW",
  "DISPATCH_DELAY",
  "PRESCRIPTION_ISSUE",
  "FACILITY_COMPLIANCE",
  "OTHER",
]);
export type DisputeCategory = z.infer<typeof DisputeCategorySchema>;

export const DisputeStatusSchema = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
]);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const CreateDisputeSchema = z.object({
  category: DisputeCategorySchema,
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(1500),
  targetResourceId: z.string().trim().max(128).optional(),
});
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>;

export const ResolveDisputeSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().trim().min(2).max(1000),
});
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

export const DisputeSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  reporterUserId: z.string().uuid(),
  reporterName: z.string(),
  reporterRole: UserRoleSchema,
  category: DisputeCategorySchema,
  subject: z.string(),
  description: z.string(),
  targetResourceId: z.string().nullable(),
  status: DisputeStatusSchema,
  resolutionNote: z.string().nullable(),
  resolvedByUserId: z.string().uuid().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});
export type DisputeSummary = z.infer<typeof DisputeSummarySchema>;

export const UpdateUserRoleSchema = z.object({
  role: UserRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  reason: z.string().trim().max(300).optional(),
});
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;

export const AdminUsersQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  role: UserRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const AdminOverrideDispatchSchema = z.object({
  status: DispatchStatusSchema,
  driverUserId: z.string().uuid().optional(),
  note: z.string().trim().min(3).max(400),
});
export type AdminOverrideDispatchInput = z.infer<
  typeof AdminOverrideDispatchSchema
>;

export const AdminAuditQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  action: z.string().trim().max(64).optional(),
  resourceType: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

export const AdminOverviewQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
});
export type AdminOverviewQuery = z.infer<typeof AdminOverviewQuerySchema>;

export const AdminOverviewMetricsSchema = z.object({
  countryCode: z.string().nullable(),
  totalUsers: z.number().int().min(0),
  totalFacilities: z.number().int().min(0),
  pendingVerificationFacilities: z.number().int().min(0),
  activeDispatches: z.number().int().min(0),
  activeAppointments: z.number().int().min(0),
  openPrescriptions: z.number().int().min(0),
  pendingLabOrders: z.number().int().min(0),
  openDisputes: z.number().int().min(0),
  recentAuditLogs: z.array(AuditEventSchema),
});
export type AdminOverviewMetrics = z.infer<typeof AdminOverviewMetricsSchema>;

export const AdminOverviewResponseSchema = z.object({
  overview: AdminOverviewMetricsSchema,
});
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;

export const AdminUsersListResponseSchema = z.object({
  users: z.array(AuthenticatedUserSchema),
});
export type AdminUsersListResponse = z.infer<
  typeof AdminUsersListResponseSchema
>;

export const AdminUserResponseSchema = z.object({
  user: AuthenticatedUserSchema,
});
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

export const DisputeResponseSchema = z.object({
  dispute: DisputeSummarySchema,
});
export type DisputeResponse = z.infer<typeof DisputeResponseSchema>;

export const DisputesListResponseSchema = z.object({
  disputes: z.array(DisputeSummarySchema),
});
export type DisputesListResponse = z.infer<typeof DisputesListResponseSchema>;

export const AdminAuditListResponseSchema = z.object({
  logs: z.array(AuditEventSchema),
});
export type AdminAuditListResponse = z.infer<
  typeof AdminAuditListResponseSchema
>;
