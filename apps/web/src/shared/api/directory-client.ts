import {
  DemoPersonasResponseSchema,
  DirectoryDoctorsResponseSchema,
  DirectoryDriversResponseSchema,
  DirectoryFacilitiesResponseSchema,
  DirectoryPatientsResponseSchema,
  MedicalServiceListResponseSchema,
  type DemoPersonaSummary,
  type DirectoryDoctorSummary,
  type DirectoryDriverSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type FacilityKind,
  type MedicalServiceCategory,
  type MedicalServiceSummary,
} from "@medisync/contracts";

let backendStatusCache: { online: boolean; expiresAtMs: number } | null = null;
let backendStatusInFlight: Promise<boolean> | null = null;

export async function checkBackendOnline(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && backendStatusCache && backendStatusCache.expiresAtMs > now) {
    return backendStatusCache.online;
  }
  if (!force && backendStatusInFlight) {
    return backendStatusInFlight;
  }
  const req = (async () => {
    try {
      const res = await fetch("/api/backend-status", { cache: "no-store" });
      if (!res.ok) {
        backendStatusCache = { online: false, expiresAtMs: Date.now() + 3_000 };
        return false;
      }
      const data = (await res.json()) as { online?: unknown };
      const online = data.online === true;
      backendStatusCache = {
        online,
        expiresAtMs: Date.now() + (online ? 15_000 : 3_000),
      };
      return online;
    } catch {
      backendStatusCache = { online: false, expiresAtMs: Date.now() + 3_000 };
      return false;
    }
  })().finally(() => {
    if (backendStatusInFlight === req) {
      backendStatusInFlight = null;
    }
  });
  backendStatusInFlight = req;
  return req;
}

export async function fetchDirectoryPatients(
  apiBaseUrl: string,
  token: string,
  params: { countryCode?: string; q?: string; limit?: number } = {},
): Promise<{ ok: true; patients: DirectoryPatientSummary[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));

  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/patients?${qs.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    const parsed = DirectoryPatientsResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: "INVALID_RESPONSE" };
    return { ok: true, patients: parsed.data.patients };
  } catch {
    return { ok: false, error: "API_UNREACHABLE" };
  }
}

export async function fetchDirectoryDoctors(
  apiBaseUrl: string,
  params: { countryCode?: string; q?: string; limit?: number } = {},
): Promise<{ ok: true; doctors: DirectoryDoctorSummary[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));

  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/doctors?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    const parsed = DirectoryDoctorsResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: "INVALID_RESPONSE" };
    return { ok: true, doctors: parsed.data.doctors };
  } catch {
    return { ok: false, error: "API_UNREACHABLE" };
  }
}

export async function fetchDirectoryFacilities(
  apiBaseUrl: string,
  params: { countryCode?: string; kind?: FacilityKind; q?: string; limit?: number } = {},
): Promise<{ ok: true; facilities: DirectoryFacilitySummary[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.kind) qs.set("kind", params.kind);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));

  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/facilities?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    const parsed = DirectoryFacilitiesResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: "INVALID_RESPONSE" };
    return { ok: true, facilities: parsed.data.facilities };
  } catch {
    return { ok: false, error: "API_UNREACHABLE" };
  }
}

export async function fetchDirectoryDrivers(
  apiBaseUrl: string,
  params: { countryCode?: string; q?: string; limit?: number } = {},
): Promise<{ ok: true; drivers: DirectoryDriverSummary[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));

  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/drivers?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    const parsed = DirectoryDriversResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: "INVALID_RESPONSE" };
    return { ok: true, drivers: parsed.data.drivers };
  } catch {
    return { ok: false, error: "API_UNREACHABLE" };
  }
}

export async function fetchDemoPersonas(
  apiBaseUrl: string,
): Promise<DemoPersonaSummary[]> {
  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/demo-personas`);
    if (!res.ok) return [];
    const parsed = DemoPersonasResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.personas : [];
  } catch {
    return [];
  }
}

export async function fetchMedicalServices(
  apiBaseUrl: string,
  params: {
    countryCode?: string;
    category?: MedicalServiceCategory;
    q?: string;
    limit?: number;
  } = {},
): Promise<{ ok: true; services: MedicalServiceSummary[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));

  try {
    const res = await fetch(`${apiBaseUrl}/v1/directory/services?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    const parsed = MedicalServiceListResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: "INVALID_RESPONSE" };
    return { ok: true, services: parsed.data.services };
  } catch {
    return { ok: false, error: "API_UNREACHABLE" };
  }
}
