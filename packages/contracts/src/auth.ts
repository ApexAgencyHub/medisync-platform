import { z } from "zod";
import { UserRoleSchema } from "./roles.js";

export const PublicSelfRegisterRoleSchema = z.enum([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "PHARMACIST",
  "LAB_TECH",
]);

export type PublicSelfRegisterRole = z.infer<
  typeof PublicSelfRegisterRoleSchema
>;

export const RegisterUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  role: PublicSelfRegisterRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid().optional(),
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: UserRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid().nullable(),
  avatarUrl: z.string().url().nullable().default(null),
  createdAtIso: z.string().datetime(),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
  user: AuthenticatedUserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
