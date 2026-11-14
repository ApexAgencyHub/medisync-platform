import {
  DemoPersonasResponseSchema,
  DirectoryDoctorsResponseSchema,
  DirectoryDriversResponseSchema,
  DirectoryFacilitiesResponseSchema,
  DirectoryPatientsResponseSchema,
  type DemoPersonaSummary,
  type DirectoryDoctorSummary,
  type DirectoryDriverSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type FacilityKind,
} from "@medisync/contracts";

export async function checkBackendOnline(): Promise<boolean> {
  try {
    const res = await fetch("/api/backend-status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { online?: unknown };
    return data.online === true;
  } catch {
    return false;
  }
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
    const res = await fetch(`${apiBaseUrl}/v1/directory/doctors?${qs.toString()}`, {
      cache: "no-store",
    });
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
    const res = await fetch(`${apiBaseUrl}/v1/directory/facilities?${qs.toString()}`, {
      cache: "no-store",
    });
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
    const res = await fetch(`${apiBaseUrl}/v1/directory/drivers?${qs.toString()}`, {
      cache: "no-store",
    });
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
    const res = await fetch(`${apiBaseUrl}/v1/directory/demo-personas`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const parsed = DemoPersonasResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.personas : [];
  } catch {
    return [];
  }
}
