import { ApiErrorSchema } from "@medisync/contracts";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number | null };

export interface SafeParseSchema<T> {
  safeParse: (
    data: unknown,
  ) => { success: true; data: T } | { success: false };
}

export async function requestTyped<T>(
  url: string,
  init: RequestInit,
  schema: SafeParseSchema<T>,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
    });
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
