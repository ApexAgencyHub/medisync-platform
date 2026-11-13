import {
  AuthenticatedUserSchema,
  AuthResponseSchema,
  FacilitiesListResponseSchema,
  FacilityResponseSchema,
  RequestVerificationCodeResponseSchema,
  type AuthenticatedUser,
  type AuthResponse,
  type CreateFacilityInput,
  type FacilitySummary,
  type LoginInput,
  type RegisterUserInput,
  type RequestVerificationCodeInput,
  type RequestVerificationCodeResponse,
  type ResetPasswordWithCodeInput,
  type UpdateProfileInput,
  type VerifyAccountCodeInput,
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
