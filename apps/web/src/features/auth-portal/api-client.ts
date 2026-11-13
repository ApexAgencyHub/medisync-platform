import {
  ApiErrorSchema,
  AuthResponseSchema,
  FacilitiesListResponseSchema,
  FacilityResponseSchema,
  type AuthResponse,
  type CreateFacilityInput,
  type FacilitySummary,
  type LoginInput,
  type RegisterUserInput,
} from "@medisync/contracts";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number | null };

interface SafeParseSchema<T> {
  safeParse: (
    data: unknown,
  ) => { success: true; data: T } | { success: false };
}

async function requestTyped<T>(
  url: string,
  init: RequestInit,
  schema: SafeParseSchema<T>,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsedErr = ApiErrorSchema.safeParse(json);
      return {
        ok: false,
        error: parsedErr.success
          ? parsedErr.data.error
          : `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        error: "UNEXPECTED_RESPONSE_SHAPE",
        status: response.status,
      };
    }

    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      error: "API_UNREACHABLE",
      status: null,
    };
  }
}

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
