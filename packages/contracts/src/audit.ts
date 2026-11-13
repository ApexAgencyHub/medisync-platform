import { z } from "zod";
import { UserRoleSchema } from "./roles.js";

export const AuditEventSchema = z.object({
  eventId: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  actorId: z.string().min(1),
  actorRole: UserRoleSchema,
  action: z.string().min(2),
  resourceType: z.string().min(2),
  resourceId: z.string().min(1),
  occurredAtIso: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
