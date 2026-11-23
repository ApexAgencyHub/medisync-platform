import { z } from "zod";
import {
  AccountStatusSchema,
  isStaffWorkerRole,
  UserRoleSchema,
} from "./roles.js";

export const PHONE_NUMBER_REGEX = /^\+?[0-9][0-9\s().-]{5,24}[0-9]$/;

export function normalizePhoneIdentifier(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export const AuthProviderSchema = z.enum(["LOCAL", "PHONE", "GOOGLE"]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const PublicSelfRegisterRoleSchema = z.enum([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "PHARMACIST",
  "LAB_TECH",
]);

export type PublicSelfRegisterRole = z.infer<
  typeof PublicSelfRegisterRoleSchema
>;

export const RegisterUserSchema = z
  .object({
    email: z.string().email().max(254).optional(),
    phone: z.string().trim().min(7).max(32).regex(PHONE_NUMBER_REGEX).optional(),
    password: z.string().min(8).max(128),
    fullName: z.string().min(2).max(120),
    role: PublicSelfRegisterRoleSchema,
    countryCode: z.string().regex(/^[A-Z]{2,4}$/),
    facilityId: z.string().uuid().optional(),
    acceptedTerms: z.boolean().optional(),
    consentVersion: z.string().trim().min(1).max(32).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.email && !val.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide an email address or a phone number.",
      });
    }
    if (isStaffWorkerRole(val.role) && !val.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message:
          "Healthcare staff registration requires an email address for verification.",
      });
    }
  });

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

export const LoginSchema = z
  .object({
    email: z.string().email().max(254).optional(),
    identifier: z.string().trim().min(3).max(254).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    password: z.string().min(1).max(128),
    portalTrack: z.enum(["PATIENT", "STAFF"]).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.identifier && !val.email && !val.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifier"],
        message: "Email or phone number is required.",
      });
    }
  });

export type LoginInput = z.infer<typeof LoginSchema>;

export const PatientEasyRoleSchema = z.enum(["PATIENT", "CAREGIVER"]);
export type PatientEasyRole = z.infer<typeof PatientEasyRoleSchema>;

export const RequestPhoneOtpLoginSchema = z.object({
  phone: z.string().trim().min(7).max(32).regex(PHONE_NUMBER_REGEX),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).default("MA"),
});
export type RequestPhoneOtpLoginInput = z.infer<
  typeof RequestPhoneOtpLoginSchema
>;

export const RequestPhoneOtpLoginResponseSchema = z.object({
  sent: z.boolean(),
  expiresInMinutes: z.number().int().positive(),
  normalizedPhone: z.string().min(6),
  devPreviewCode: z.string().optional(),
});
export type RequestPhoneOtpLoginResponse = z.infer<
  typeof RequestPhoneOtpLoginResponseSchema
>;

export const VerifyPhoneOtpLoginSchema = z.object({
  phone: z.string().trim().min(7).max(32).regex(PHONE_NUMBER_REGEX),
  code: z.string().trim().regex(/^\d{6}$/),
  fullName: z.string().trim().min(2).max(120).optional(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).default("MA"),
  role: PatientEasyRoleSchema.default("PATIENT"),
});
export type VerifyPhoneOtpLoginInput = z.infer<
  typeof VerifyPhoneOtpLoginSchema
>;

export const GoogleAuthSchema = z.object({
  idToken: z.string().trim().min(20).max(4096),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).default("MA"),
  role: PatientEasyRoleSchema.default("PATIENT"),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

export const AuthenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  fullName: z.string(),
  role: UserRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid().nullable(),
  avatarUrl: z.string().url().nullable().default(null),
  emailVerified: z.boolean().default(false),
  phone: z.string().nullable().default(null),
  phoneVerified: z.boolean().default(false),
  authProvider: AuthProviderSchema.default("LOCAL"),
  accountStatus: AccountStatusSchema.default("ACTIVE"),
  credentialVerified: z.boolean().default(false),
  lastLoginAtIso: z.string().datetime().nullable().optional(),
  createdAtIso: z.string().datetime(),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
  user: AuthenticatedUserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const LogoutResponseSchema = z.object({
  revoked: z.boolean(),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

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

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const RevokeSessionsResponseSchema = z.object({
  revoked: z.literal(true),
  token: z.string().min(1),
});
export type RevokeSessionsResponse = z.infer<
  typeof RevokeSessionsResponseSchema
>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(32).nullable().optional(),
  facilityId: z.string().uuid().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
