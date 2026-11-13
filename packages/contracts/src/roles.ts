import { z } from "zod";

export const UserRoleSchema = z.enum([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const FacilityKindSchema = z.enum([
  "CLINIC",
  "HOSPITAL",
  "PHARMACY",
  "DIAGNOSTIC_LAB",
]);

export type FacilityKind = z.infer<typeof FacilityKindSchema>;
