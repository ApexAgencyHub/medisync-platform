import {
  TelehealthPresenceResponseSchema,
  TelehealthRoomStateResponseSchema,
  TelehealthSignalResponseSchema,
  TelehealthStreamEventSchema,
  type TelehealthParticipantPresence,
  type TelehealthPresenceInput,
  type TelehealthRoomStateResponse,
  type TelehealthSignalEnvelope,
  type TelehealthSignalInput,
  type TelehealthStreamEvent,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export async function fetchTelehealthRoomState(
  apiBaseUrl: string,
  token: string,
  appointmentId: string,
  sinceSeq = 0,
): Promise<ApiResult<TelehealthRoomStateResponse>> {
  const qs = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
  return requestTyped(
    `${apiBaseUrl}/v1/telehealth/sessions/${encodeURIComponent(appointmentId)}${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    TelehealthRoomStateResponseSchema,
  );
}

export async function postTelehealthPresence(
  apiBaseUrl: string,
  token: string,
  appointmentId: string,
  input: TelehealthPresenceInput,
  keepalive = false,
): Promise<ApiResult<{ participant: TelehealthParticipantPresence }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/telehealth/sessions/${encodeURIComponent(appointmentId)}/presence`,
    {
      method: "POST",
      keepalive,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    TelehealthPresenceResponseSchema,
  );
}

export async function postTelehealthSignal(
  apiBaseUrl: string,
  token: string,
  appointmentId: string,
  input: TelehealthSignalInput,
): Promise<ApiResult<{ signal: TelehealthSignalEnvelope }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/telehealth/sessions/${encodeURIComponent(appointmentId)}/signal`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    TelehealthSignalResponseSchema,
  );
}

/**
 * Connects to authenticated Telehealth SSE stream using Authorization Bearer headers
 * so session JWTs never appear in query parameters or proxy logs.
 */
export async function subscribeTelehealthStream(
  apiBaseUrl: string,
  token: string,
  appointmentId: string,
  sinceSeq: number,
  signal: AbortSignal,
  handlers: {
    onOpen?: () => void;
    onEvent: (event: TelehealthStreamEvent) => void;
    onError?: (status?: number) => void;
  },
): Promise<void> {
  const qs = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl}/v1/telehealth/sessions/${encodeURIComponent(appointmentId)}/stream${qs}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "text/event-stream",
        },
        signal,
      },
    );
  } catch {
    if (!signal.aborted) {
      handlers.onError?.();
    }
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError?.(response.status);
    return;
  }

  handlers.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let delimiterIdx = buffer.indexOf("\n\n");
      while (delimiterIdx !== -1) {
        const rawBlock = buffer.slice(0, delimiterIdx);
        buffer = buffer.slice(delimiterIdx + 2);
        delimiterIdx = buffer.indexOf("\n\n");

        const dataLines = rawBlock
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart());
        if (dataLines.length === 0) continue;

        try {
          const parsed = TelehealthStreamEventSchema.safeParse(
            JSON.parse(dataLines.join("\n")),
          );
          if (parsed.success) {
            handlers.onEvent(parsed.data);
          }
        } catch {
          // Ignore partial or heartbeat frames cleanly
        }
      }
    }
  } catch {
    if (!signal.aborted) {
      handlers.onError?.();
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
