import { z } from "zod";

export const UserRoleSchema = z.enum([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/** Staff & provider roles that require administration credential verification before operating on the platform. */
export const STAFF_WORKER_ROLES = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "PHARMACIST",
  "LAB_TECH",
] as const satisfies readonly UserRole[];

export type StaffWorkerRole = (typeof STAFF_WORKER_ROLES)[number];

export function isStaffWorkerRole(role: UserRole): role is StaffWorkerRole {
  return (STAFF_WORKER_ROLES as readonly string[]).includes(role);
}

export const FacilityKindSchema = z.enum([
  "CLINIC",
  "HOSPITAL",
  "PHARMACY",
  "DIAGNOSTIC_LAB",
]);

export type FacilityKind = z.infer<typeof FacilityKindSchema>;

export const AccountStatusSchema = z.enum([
  "ACTIVE",
  "PENDING_APPROVAL",
  "SUSPENDED",
]);

export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const PlatformOperationalModeSchema = z.enum([
  "SINGLE_ADMIN",
  "OPEN_PUBLIC",
]);

export type PlatformOperationalMode = z.infer<
  typeof PlatformOperationalModeSchema
>;
