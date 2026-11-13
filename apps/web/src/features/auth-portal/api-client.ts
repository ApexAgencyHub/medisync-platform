import {
  AuthResponseSchema,
  FacilitiesListResponseSchema,
  FacilityResponseSchema,
  type AuthResponse,
  type CreateFacilityInput,
  type FacilitySummary,
  type LoginInput,
  type RegisterUserInput,
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
