import { ApiErrorSchema } from "@medisync/contracts";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number | null };

export interface SafeParseSchema<T> {
  safeParse: (
    data: unknown,
  ) => { success: true; data: T } | { success: false };
}

export interface RequestTypedOptions {
  /** Override default request timeout in milliseconds (0 disables timeout). */
  timeoutMs?: number;
}

export async function requestTyped<T>(
  url: string,
  init: RequestInit,
  schema: SafeParseSchema<T>,
  options?: RequestTypedOptions,
): Promise<ApiResult<T>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      return {
        ok: false,
        error: "REQUEST_ABORTED",
        status: null,
      };
    }
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const json: unknown =
      response.status === 204 || response.status === 205
        ? null
        : await response.json().catch(() => null);

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
    if (timedOut) {
      return {
        ok: false,
        error: "REQUEST_TIMEOUT",
        status: null,
      };
    }
    if (callerSignal?.aborted) {
      return {
        ok: false,
        error: "REQUEST_ABORTED",
        status: null,
      };
    }
    return {
      ok: false,
      error: "API_UNREACHABLE",
      status: null,
    };
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}
