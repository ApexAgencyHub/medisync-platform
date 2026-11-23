import {
  AuthenticatedUserSchema,
  AuthResponseSchema,
  DeleteAccountResponseSchema,
  FacilitiesListResponseSchema,
  FacilityResponseSchema,
  LegalConsentRecordSchema,
  RequestPhoneOtpLoginResponseSchema,
  RequestVerificationCodeResponseSchema,
  UserConsentsResponseSchema,
  UserDataExportResponseSchema,
  type AuthenticatedUser,
  type AuthResponse,
  type ChangePasswordInput,
  type CreateFacilityInput,
  type DeleteAccountResponse,
  type FacilitySummary,
  type GoogleAuthInput,
  type LegalConsentRecord,
  type LoginInput,
  type RecordConsentInput,
  type RegisterUserInput,
  type RequestPhoneOtpLoginInput,
  type RequestPhoneOtpLoginResponse,
  type RequestVerificationCodeInput,
  type RequestVerificationCodeResponse,
  type ResetPasswordWithCodeInput,
  type RevokeSessionsResponse,
  RevokeSessionsResponseSchema,
  type UpdateProfileInput,
  type UserConsentsResponse,
  type UserDataExportResponse,
  type VerifyAccountCodeInput,
  type VerifyPhoneOtpLoginInput,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export type { ApiResult };

export async function registerUser(
  apiBaseUrl: string,
  input: RegisterUserInput,
): Promise<ApiResult<AuthResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    AuthResponseSchema,
  );
}

export async function loginUser(
  apiBaseUrl: string,
  input: LoginInput,
): Promise<ApiResult<AuthResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/login`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    AuthResponseSchema,
  );
}

export async function listFacilities(
  apiBaseUrl: string,
  token: string,
  countryCode?: string,
): Promise<ApiResult<{ facilities: FacilitySummary[] }>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}&limit=20`
    : "?limit=20";
  return requestTyped(
    `${apiBaseUrl}/v1/facilities${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    FacilitiesListResponseSchema,
  );
}

export async function createFacility(
  apiBaseUrl: string,
  token: string,
  input: CreateFacilityInput,
): Promise<ApiResult<{ facility: FacilitySummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/facilities`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    FacilityResponseSchema,
  );
}

export async function verifyFacilityStatus(
  apiBaseUrl: string,
  token: string,
  facilityId: string,
  status: "VERIFIED" | "SUSPENDED",
): Promise<ApiResult<{ facility: FacilitySummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/facilities/${encodeURIComponent(facilityId)}/verify`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    },
    FacilityResponseSchema,
  );
}

const UserWrappedSchema = AuthenticatedUserSchema.transform((user) => ({ user }));
const UserWrapperResponseSchema = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null || !("user" in data)) {
      return { success: false as const };
    }
    const inner = AuthenticatedUserSchema.safeParse(
      (data as { user: unknown }).user,
    );
    return inner.success
      ? { success: true as const, data: { user: inner.data } }
      : { success: false as const };
  },
};
void UserWrappedSchema;

const ResetDoneResponseSchema = {
  safeParse(data: unknown) {
    if (
      typeof data === "object" &&
      data !== null &&
      "reset" in data &&
      (data as { reset: unknown }).reset === true
    ) {
      return { success: true as const, data: { reset: true } };
    }
    return { success: false as const };
  },
};

export async function requestVerificationCode(
  apiBaseUrl: string,
  input: RequestVerificationCodeInput,
): Promise<ApiResult<RequestVerificationCodeResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/verification/request`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    RequestVerificationCodeResponseSchema,
  );
}

export async function confirmVerificationCode(
  apiBaseUrl: string,
  input: VerifyAccountCodeInput,
): Promise<ApiResult<{ user: AuthenticatedUser }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/verification/confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    UserWrapperResponseSchema,
  );
}

export async function resetPasswordWithCode(
  apiBaseUrl: string,
  input: ResetPasswordWithCodeInput,
): Promise<ApiResult<{ reset: boolean }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/password-reset`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    ResetDoneResponseSchema,
  );
}

export async function updateUserProfile(
  apiBaseUrl: string,
  token: string,
  input: UpdateProfileInput,
): Promise<ApiResult<{ user: AuthenticatedUser }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/profile`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    UserWrapperResponseSchema,
  );
}

export async function requestPhoneOtpLogin(
  apiBaseUrl: string,
  input: RequestPhoneOtpLoginInput,
): Promise<ApiResult<RequestPhoneOtpLoginResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/phone/request-otp`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    RequestPhoneOtpLoginResponseSchema,
  );
}

export async function verifyPhoneOtpLogin(
  apiBaseUrl: string,
  input: VerifyPhoneOtpLoginInput,
): Promise<ApiResult<AuthResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/phone/verify-otp`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    AuthResponseSchema,
  );
}

export async function fetchMe(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<{ user: AuthenticatedUser }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/me`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
    UserWrapperResponseSchema,
  );
}

export async function authenticateWithGoogle(
  apiBaseUrl: string,
  input: GoogleAuthInput,
): Promise<ApiResult<AuthResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/google`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    AuthResponseSchema,
  );
}

export async function changeUserPassword(
  apiBaseUrl: string,
  token: string,
  input: ChangePasswordInput,
): Promise<ApiResult<AuthResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/change-password`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    AuthResponseSchema,
  );
}

export async function revokeAllOtherSessions(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<RevokeSessionsResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/revoke-sessions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    RevokeSessionsResponseSchema,
  );
}

const ConsentResponseParser = {
  safeParse(
    data: unknown,
  ): { success: true; data: { consent: LegalConsentRecord } } | { success: false } {
    if (typeof data !== "object" || data === null || !("consent" in data)) {
      return { success: false };
    }
    const parsed = LegalConsentRecordSchema.safeParse(
      (data as { consent: unknown }).consent,
    );
    return parsed.success
      ? { success: true, data: { consent: parsed.data } }
      : { success: false };
  },
};

export async function fetchMyConsents(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<UserConsentsResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/consents`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    UserConsentsResponseSchema,
  );
}

export async function updateMyConsent(
  apiBaseUrl: string,
  token: string,
  input: RecordConsentInput,
): Promise<ApiResult<{ consent: LegalConsentRecord }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/consents`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    ConsentResponseParser,
  );
}

export async function exportMyPersonalData(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<UserDataExportResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/data-export`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    UserDataExportResponseSchema,
  );
}

export async function deleteMyAccount(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<DeleteAccountResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/account`,
    {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
    },
    DeleteAccountResponseSchema,
  );
}
