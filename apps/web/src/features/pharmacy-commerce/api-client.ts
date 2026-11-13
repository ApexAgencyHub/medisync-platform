import {
  PharmacyOrderResponseSchema,
  PharmacyOrdersResponseSchema,
  PharmacyProductResponseSchema,
  PharmacyProductsResponseSchema,
  PrescriptionsListResponseSchema,
  type ConfirmOrderPaymentInput,
  type CreatePharmacyOrderInput,
  type CreatePharmacyProductInput,
  type ListPharmacyProductsQuery,
  type PharmacyOrderSummary,
  type PharmacyProductSummary,
  type PrescriptionSummary,
  type UpdatePharmacyOrderStatusInput,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export type { ApiResult };

export async function listPharmacyProducts(
  apiBaseUrl: string,
  query: Partial<ListPharmacyProductsQuery> = {},
): Promise<ApiResult<{ products: PharmacyProductSummary[] }>> {
  const qs = new URLSearchParams();
  if (query.countryCode) qs.set("countryCode", query.countryCode);
  if (query.facilityId) qs.set("facilityId", query.facilityId);
  if (query.category) qs.set("category", query.category);
  if (query.q) qs.set("q", query.q);
  if (query.inStockOnly) qs.set("inStockOnly", "true");
  if (query.limit) qs.set("limit", String(query.limit));

  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/products?${qs.toString()}`,
    { method: "GET", cache: "no-store" },
    PharmacyProductsResponseSchema,
  );
}

export async function createPharmacyProduct(
  apiBaseUrl: string,
  token: string,
  input: CreatePharmacyProductInput,
): Promise<ApiResult<{ product: PharmacyProductSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/products`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PharmacyProductResponseSchema,
  );
}

export async function updatePharmacyProductStock(
  apiBaseUrl: string,
  token: string,
  productId: string,
  patch: { stockQty?: number; priceMinor?: number; isActive?: boolean },
): Promise<ApiResult<{ product: PharmacyProductSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/products/${encodeURIComponent(productId)}/stock`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    },
    PharmacyProductResponseSchema,
  );
}

export async function createPharmacyOrder(
  apiBaseUrl: string,
  token: string,
  input: CreatePharmacyOrderInput,
): Promise<ApiResult<{ order: PharmacyOrderSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/orders`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PharmacyOrderResponseSchema,
  );
}

export async function confirmPharmacyOrderPayment(
  apiBaseUrl: string,
  token: string,
  orderId: string,
  input: ConfirmOrderPaymentInput,
): Promise<ApiResult<{ order: PharmacyOrderSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/orders/${encodeURIComponent(orderId)}/confirm-payment`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PharmacyOrderResponseSchema,
  );
}

export async function listPharmacyOrders(
  apiBaseUrl: string,
  token: string,
  countryCode?: string,
): Promise<ApiResult<{ orders: PharmacyOrderSummary[] }>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}&limit=50`
    : "?limit=50";
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/orders${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
    PharmacyOrdersResponseSchema,
  );
}

export async function updatePharmacyOrderStatus(
  apiBaseUrl: string,
  token: string,
  orderId: string,
  input: UpdatePharmacyOrderStatusInput,
): Promise<ApiResult<{ order: PharmacyOrderSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/pharmacy/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PharmacyOrderResponseSchema,
  );
}

export async function listMyPrescriptionsForCheckout(
  apiBaseUrl: string,
  token: string,
  countryCode: string,
): Promise<ApiResult<{ prescriptions: PrescriptionSummary[] }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/prescriptions?countryCode=${encodeURIComponent(countryCode)}&limit=30`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
    PrescriptionsListResponseSchema,
  );
}
