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
  emailVerified: z.boolean().default(false),
  phone: z.string().nullable().default(null),
  phoneVerified: z.boolean().default(false),
  createdAtIso: z.string().datetime(),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
  user: AuthenticatedUserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RecoveryPurposeSchema = z.enum([
  "VERIFY_EMAIL",
  "VERIFY_PHONE",
  "RESET_PASSWORD",
]);
export type RecoveryPurpose = z.infer<typeof RecoveryPurposeSchema>;

export const RequestVerificationCodeSchema = z.object({
  email: z.string().email().max(254),
  purpose: RecoveryPurposeSchema,
  phone: z.string().trim().min(6).max(32).optional(),
});
export type RequestVerificationCodeInput = z.infer<
  typeof RequestVerificationCodeSchema
>;

export const RequestVerificationCodeResponseSchema = z.object({
  sent: z.boolean(),
  expiresInMinutes: z.number().int().positive(),
  deliveryChannel: z.enum(["EMAIL", "SMS"]),
  devPreviewCode: z.string().optional(),
});
export type RequestVerificationCodeResponse = z.infer<
  typeof RequestVerificationCodeResponseSchema
>;

export const VerifyAccountCodeSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
  purpose: z.enum(["VERIFY_EMAIL", "VERIFY_PHONE"]),
  phone: z.string().trim().min(6).max(32).optional(),
});
export type VerifyAccountCodeInput = z.infer<typeof VerifyAccountCodeSchema>;

export const ResetPasswordWithCodeSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordWithCodeInput = z.infer<
  typeof ResetPasswordWithCodeSchema
>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(32).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
