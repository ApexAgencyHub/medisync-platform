import {
  DriverPingInputSchema,
  MobileTelemetryHeartbeatSchema,
  PharmacyProductsResponseSchema,
  PresignUserMediaSchema,
  VerifyPrescriptionQrSchema,
  type DriverPingInput,
  type LiveDriverMarker,
  type MobileTelemetryHeartbeat,
  type PharmacyProductSummary,
  type UserMediaCategory,
} from "@medisync/contracts";

export interface MobileAdapterResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export function resolveMobileApiBaseUrl(): string {
  const maybeGlobal = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const envUrl = maybeGlobal.process?.env?.EXPO_PUBLIC_API_URL;
  return envUrl && envUrl.trim().length > 0
    ? envUrl.trim().replace(/\/$/, "")
    : "http://127.0.0.1:4200";
}

export async function verifyScannedQrPrescription(
  apiBaseUrl: string,
  token: string,
  qrToken: string,
): Promise<MobileAdapterResult<{ valid: boolean; rxId?: string }>> {
  const parsed = VerifyPrescriptionQrSchema.safeParse({ qrToken });
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid scanned QR payload." };
  }

  const res = await fetch(
    `${apiBaseUrl}/v1/clinical/prescriptions/verify-qr`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(parsed.data),
    },
  );
  const json = (await res.json()) as {
    valid?: boolean;
    prescription?: { id: string };
    error?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "QR verification failed",
    };
  }
  return {
    ok: true,
    status: res.status,
    data: {
      valid: Boolean(json.valid),
      ...(json.prescription?.id ? { rxId: json.prescription.id } : {}),
    },
  };
}

export async function uploadPickedBinaryMedia(
  apiBaseUrl: string,
  token: string,
  input: {
    category: UserMediaCategory;
    fileName: string;
    mimeType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
    bytes: Uint8Array;
  },
): Promise<MobileAdapterResult<{ mediaId: string; downloadUrl: string | null }>> {
  const parsed = PresignUserMediaSchema.safeParse({
    category: input.category,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
  });
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? "Invalid media selection.",
    };
  }

  const presignRes = await fetch(`${apiBaseUrl}/v1/users/me/media/presign-upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(parsed.data),
  });
  const presignJson = (await presignRes.json()) as {
    document?: { id: string };
    uploadUrl?: string;
    error?: string;
  };
  if (!presignRes.ok || !presignJson.uploadUrl || !presignJson.document?.id) {
    return {
      ok: false,
      status: presignRes.status,
      error: presignJson.error ?? "Could not presign mobile upload.",
    };
  }

  const binaryCopy = new Uint8Array(input.bytes.byteLength);
  binaryCopy.set(input.bytes);
  const putRes = await fetch(presignJson.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": input.mimeType,
    },
    body: new Blob([binaryCopy], { type: input.mimeType }),
  });
  if (!putRes.ok) {
    return {
      ok: false,
      status: putRes.status,
      error: `Object storage binary upload failed (${putRes.status}).`,
    };
  }

  const confirmRes = await fetch(
    `${apiBaseUrl}/v1/users/me/media/${encodeURIComponent(presignJson.document.id)}/confirm`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  const confirmJson = (await confirmRes.json()) as {
    document?: { id: string; downloadUrl?: string | null };
    error?: string;
  };
  if (!confirmRes.ok || !confirmJson.document) {
    return {
      ok: false,
      status: confirmRes.status,
      error: confirmJson.error ?? "Binary upload confirmation failed.",
    };
  }

  return {
    ok: true,
    status: confirmRes.status,
    data: {
      mediaId: confirmJson.document.id,
      downloadUrl: confirmJson.document.downloadUrl ?? null,
    },
  };
}

export async function transmitDriverGpsPing(
  apiBaseUrl: string,
  token: string,
  input: DriverPingInput,
): Promise<MobileAdapterResult<LiveDriverMarker>> {
  const parsed = DriverPingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid GPS coordinates." };
  }

  const res = await fetch(`${apiBaseUrl}/v1/dispatch/drivers/ping`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(parsed.data),
  });
  const json = (await res.json()) as { driver?: LiveDriverMarker; error?: string };
  if (!res.ok || !json.driver) {
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "Driver GPS ping rejected.",
    };
  }
  return { ok: true, status: res.status, data: json.driver };
}

export async function fetchMobilePharmacyCatalog(
  apiBaseUrl: string,
  countryCode: string,
): Promise<MobileAdapterResult<PharmacyProductSummary[]>> {
  const qs = new URLSearchParams({
    countryCode,
    inStockOnly: "true",
    limit: "25",
  });
  const res = await fetch(`${apiBaseUrl}/v1/pharmacy/products?${qs.toString()}`);
  const raw = await res.json();
  if (!res.ok) {
    return { ok: false, status: res.status, error: "Could not load pharmacy catalog." };
  }
  const parsed = PharmacyProductsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unexpected pharmacy catalog shape." };
  }
  return { ok: true, status: res.status, data: parsed.data.products };
}

export async function sendMobileTelemetryHeartbeat(
  apiBaseUrl: string,
  heartbeat: MobileTelemetryHeartbeat,
): Promise<MobileAdapterResult<{ accepted: boolean; receivedAt: string }>> {
  const parsed = MobileTelemetryHeartbeatSchema.safeParse(heartbeat);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid heartbeat payload." };
  }
  const res = await fetch(`${apiBaseUrl}/v1/telemetry/mobile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const json = (await res.json()) as {
    accepted?: boolean;
    receivedAt?: string;
    error?: string;
  };
  if (!res.ok || !json.accepted) {
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "Heartbeat rejected.",
    };
  }
  return {
    ok: true,
    status: res.status,
    data: {
      accepted: true,
      receivedAt: json.receivedAt ?? new Date().toISOString(),
    },
  };
}
