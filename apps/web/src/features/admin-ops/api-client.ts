import {
  AdminAuditListResponseSchema,
  AdminOverviewResponseSchema,
  AdminUserResponseSchema,
  AdminUsersListResponseSchema,
  DispatchResponseSchema,
  DisputeResponseSchema,
  DisputesListResponseSchema,
  type AdminAuditListResponse,
  type AdminOverviewResponse,
  type AdminOverrideDispatchInput,
  type AdminUserResponse,
  type AdminUsersListResponse,
  type CreateDisputeInput,
  type DispatchRequestSummary,
  type DisputeResponse,
  type DisputesListResponse,
  type ResolveDisputeInput,
  type UpdateUserRoleInput,
  type UserRole,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export async function fetchAdminOverview(
  apiBaseUrl: string,
  token: string,
  countryCode?: string | undefined,
): Promise<ApiResult<AdminOverviewResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/admin/overview${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    AdminOverviewResponseSchema,
  );
}

export async function fetchAdminUsers(
  apiBaseUrl: string,
  token: string,
  options?: {
    countryCode?: string | undefined;
    role?: UserRole | undefined;
    limit?: number | undefined;
  },
): Promise<ApiResult<AdminUsersListResponse>> {
  const params = new URLSearchParams();
  if (options?.countryCode) params.set("countryCode", options.countryCode);
  if (options?.role) params.set("role", options.role);
  params.set("limit", String(options?.limit ?? 50));

  return requestTyped(
    `${apiBaseUrl}/v1/admin/users?${params.toString()}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    AdminUsersListResponseSchema,
  );
}

export async function updateAdminUserRole(
  apiBaseUrl: string,
  token: string,
  userId: string,
  input: UpdateUserRoleInput,
): Promise<ApiResult<AdminUserResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/users/${encodeURIComponent(userId)}/role`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    AdminUserResponseSchema,
  );
}

export async function overrideDispatchRequest(
  apiBaseUrl: string,
  token: string,
  dispatchId: string,
  input: AdminOverrideDispatchInput,
): Promise<ApiResult<{ dispatch: DispatchRequestSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/dispatches/${encodeURIComponent(dispatchId)}/override`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DispatchResponseSchema,
  );
}

export async function submitDisputeTicket(
  apiBaseUrl: string,
  token: string,
  input: CreateDisputeInput,
): Promise<ApiResult<DisputeResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/disputes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DisputeResponseSchema,
  );
}

export async function fetchDisputesList(
  apiBaseUrl: string,
  token: string,
  options?: {
    countryCode?: string | undefined;
    status?: string | undefined;
  },
): Promise<ApiResult<DisputesListResponse>> {
  const params = new URLSearchParams();
  if (options?.countryCode) params.set("countryCode", options.countryCode);
  if (options?.status) params.set("status", options.status);

  const qs = params.toString();
  return requestTyped(
    `${apiBaseUrl}/v1/disputes${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    DisputesListResponseSchema,
  );
}

export async function resolveDisputeTicket(
  apiBaseUrl: string,
  token: string,
  disputeId: string,
  input: ResolveDisputeInput,
): Promise<ApiResult<DisputeResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/disputes/${encodeURIComponent(disputeId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DisputeResponseSchema,
  );
}

export async function fetchAdminAuditEvents(
  apiBaseUrl: string,
  token: string,
  options?: {
    countryCode?: string | undefined;
    action?: string | undefined;
    resourceType?: string | undefined;
    limit?: number | undefined;
  },
): Promise<ApiResult<AdminAuditListResponse>> {
  const params = new URLSearchParams();
  if (options?.countryCode) params.set("countryCode", options.countryCode);
  if (options?.action) params.set("action", options.action);
  if (options?.resourceType) params.set("resourceType", options.resourceType);
  params.set("limit", String(options?.limit ?? 50));

  return requestTyped(
    `${apiBaseUrl}/v1/admin/audit-events?${params.toString()}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    AdminAuditListResponseSchema,
  );
}
