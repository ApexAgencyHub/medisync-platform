import {
  DeclineDispatchResponseSchema,
  DispatchListResponseSchema,
  DispatchResponseSchema,
  DriverResponseSchema,
  FacilityOperationalStatusResponseSchema,
  FacilityViewportResponseSchema,
  NearbyDriversResponseSchema,
  type CreateDispatchRequestInput,
  type DeclineDispatchResponse,
  type DispatchListResponse,
  type DispatchRequestSummary,
  type DispatchStatus,
  type DriverPingInput,
  type FacilityKind,
  type FacilityViewportResponse,
  type LiveDriverMarker,
  type NearbyDriversResponse,
  type UpdateFacilityOperationalStatusInput,
  type ViewportFacilityItem,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";
import type { ViewportBox } from "./presets";

export async function queryViewportFacilities(
  apiBaseUrl: string,
  countryCode: string,
  box: ViewportBox,
  options: { kind?: FacilityKind; openNow?: boolean },
): Promise<ApiResult<FacilityViewportResponse>> {
  const params = new URLSearchParams({
    countryCode,
    minLng: String(box.minLng),
    minLat: String(box.minLat),
    maxLng: String(box.maxLng),
    maxLat: String(box.maxLat),
    limit: "80",
  });
  if (options.kind) params.set("kind", options.kind);
  if (options.openNow) params.set("openNow", "true");

  return requestTyped(
    `${apiBaseUrl}/v1/maps/facilities/viewport?${params.toString()}`,
    { method: "GET" },
    FacilityViewportResponseSchema,
  );
}

export async function queryNearbyDrivers(
  apiBaseUrl: string,
  token: string,
  paramsInput: { countryCode: string; lat: number; lng: number; radiusKm: number },
): Promise<ApiResult<NearbyDriversResponse>> {
  const params = new URLSearchParams({
    countryCode: paramsInput.countryCode,
    lat: String(paramsInput.lat),
    lng: String(paramsInput.lng),
    radiusKm: String(paramsInput.radiusKm),
    limit: "50",
  });
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/drivers/nearby?${params.toString()}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    NearbyDriversResponseSchema,
  );
}

export async function sendDriverLocationPing(
  apiBaseUrl: string,
  token: string,
  input: DriverPingInput,
): Promise<ApiResult<{ driver: LiveDriverMarker }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/drivers/ping`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DriverResponseSchema,
  );
}

export async function listDispatchRequests(
  apiBaseUrl: string,
  token: string,
  countryCode?: string,
): Promise<ApiResult<DispatchListResponse>> {
  const qs = new URLSearchParams({ limit: "25" });
  if (countryCode) {
    qs.set("countryCode", countryCode);
  }
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/requests?${qs.toString()}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    DispatchListResponseSchema,
  );
}

export async function createDispatchRequest(
  apiBaseUrl: string,
  token: string,
  input: CreateDispatchRequestInput,
): Promise<ApiResult<{ dispatch: DispatchRequestSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/requests`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DispatchResponseSchema,
  );
}

export async function updateDispatchStatus(
  apiBaseUrl: string,
  token: string,
  dispatchId: string,
  status: DispatchStatus,
): Promise<ApiResult<{ dispatch: DispatchRequestSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/requests/${encodeURIComponent(dispatchId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    },
    DispatchResponseSchema,
  );
}

export async function declineDispatchRequest(
  apiBaseUrl: string,
  token: string,
  dispatchId: string,
  reason?: string,
): Promise<ApiResult<DeclineDispatchResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/dispatch/requests/${encodeURIComponent(dispatchId)}/decline`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reason ? { reason } : {}),
    },
    DeclineDispatchResponseSchema,
  );
}

export async function updateFacilityOperationalStatus(
  apiBaseUrl: string,
  token: string,
  facilityId: string,
  input: UpdateFacilityOperationalStatusInput,
): Promise<ApiResult<{ facility: ViewportFacilityItem }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/maps/facilities/${encodeURIComponent(facilityId)}/operational-status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    FacilityOperationalStatusResponseSchema,
  );
}
