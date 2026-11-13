import crypto from "node:crypto";
import type { Redis } from "ioredis";
import type { Pool, PoolClient } from "pg";
import {
  PharmacyOrderItemSummarySchema,
  PharmacyOrderSummarySchema,
  PharmacyProductSummarySchema,
  type ConfirmOrderPaymentInput,
  type CreatePharmacyOrderInput,
  type CreatePharmacyProductInput,
  type ListPharmacyProductsQuery,
  type PharmacyOrderSummary,
  type PharmacyProductCategory,
  type PharmacyProductSummary,
  type UpdatePharmacyOrderStatusInput,
  type UserRole,
} from "@medisync/contracts";
import { resolveCountryPack } from "@medisync/country-packs";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import { appendAuditLog, type AuthTokenClaims } from "../foundation/index.js";
import {
  createDispatchRequest,
  publishDispatchUpdate,
} from "../maps-dispatch/index.js";

export class PharmacyBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PharmacyBadRequestError";
  }
}

export class PharmacyForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PharmacyForbiddenError";
  }
}

export class PharmacyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PharmacyNotFoundError";
  }
}

export class PharmacyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PharmacyConflictError";
  }
}

const DELIVERY_FEE_BY_COUNTRY: Record<string, number> = {
  MA: 2500, // 25.00 MAD
  FR: 590, // 5.90 EUR
  US: 699, // 6.99 USD
  INTL: 500, // 5.00 USD
};

const ORDER_STAFF_ROLES: readonly UserRole[] = [
  "PHARMACIST",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "OPS_ADMIN",
];

function hydrateProductRow(
  row: Record<string, unknown>,
  s3Config?: S3PresignConfig,
): PharmacyProductSummary {
  const imageKey =
    typeof row.imageObjectKey === "string" && row.imageObjectKey.length > 0
      ? row.imageObjectKey
      : null;
  const imageUrl =
    imageKey && s3Config
      ? createSigV4PresignedUrl({
          config: s3Config,
          method: "GET",
          objectKey: imageKey,
        })
      : null;

  return PharmacyProductSummarySchema.parse({
    ...row,
    imageUrl,
  });
}

async function fetchProductById(
  pool: Pool | PoolClient,
  productId: string,
  s3Config?: S3PresignConfig,
): Promise<PharmacyProductSummary | null> {
  const res = await pool.query(
    `SELECT
       p.id,
       p.country_code AS "countryCode",
       p.facility_id AS "facilityId",
       f.name AS "facilityName",
       p.sku,
       p.name,
       p.generic_name AS "genericName",
       p.category,
       p.dosage_form AS "dosageForm",
       p.strength,
       p.requires_prescription AS "requiresPrescription",
       p.price_minor AS "priceMinor",
       p.currency_code AS "currencyCode",
       p.stock_qty AS "stockQty",
       p.is_active AS "isActive",
       p.image_object_key AS "imageObjectKey",
       to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM pharmacy_products p
     JOIN facilities f ON f.id = p.facility_id
     WHERE p.id = $1
     LIMIT 1`,
    [productId],
  );
  if (res.rowCount === 0) return null;
  return hydrateProductRow(res.rows[0] as Record<string, unknown>, s3Config);
}

export async function listPharmacyProducts(
  pool: Pool,
  query: ListPharmacyProductsQuery,
  s3Config?: S3PresignConfig,
): Promise<PharmacyProductSummary[]> {
  const pattern =
    query.q && query.q.trim().length > 0 ? `%${query.q.trim()}%` : null;

  const res = await pool.query(
    `SELECT
       p.id,
       p.country_code AS "countryCode",
       p.facility_id AS "facilityId",
       f.name AS "facilityName",
       p.sku,
       p.name,
       p.generic_name AS "genericName",
       p.category,
       p.dosage_form AS "dosageForm",
       p.strength,
       p.requires_prescription AS "requiresPrescription",
       p.price_minor AS "priceMinor",
       p.currency_code AS "currencyCode",
       p.stock_qty AS "stockQty",
       p.is_active AS "isActive",
       p.image_object_key AS "imageObjectKey",
       to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM pharmacy_products p
     JOIN facilities f ON f.id = p.facility_id
     WHERE p.is_active = TRUE
       AND ($1::text IS NULL OR p.country_code = $1)
       AND ($2::uuid IS NULL OR p.facility_id = $2)
       AND ($3::text IS NULL OR p.category = $3)
       AND ($4::boolean IS NULL OR p.stock_qty > 0)
       AND (
         $5::text IS NULL
         OR p.name ILIKE $5
         OR COALESCE(p.generic_name, '') ILIKE $5
         OR p.sku ILIKE $5
       )
     ORDER BY p.requires_prescription ASC, p.name ASC
     LIMIT $6`,
    [
      query.countryCode ?? null,
      query.facilityId ?? null,
      query.category ?? null,
      query.inStockOnly ? true : null,
      pattern,
      query.limit,
    ],
  );

  return res.rows.map((row) =>
    hydrateProductRow(row as Record<string, unknown>, s3Config),
  );
}

export async function createPharmacyProduct(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreatePharmacyProductInput,
  s3Config?: S3PresignConfig,
): Promise<PharmacyProductSummary> {
  const targetFacilityId = input.facilityId ?? actor.facilityId;
  if (!targetFacilityId) {
    throw new PharmacyBadRequestError("PHARMACY_FACILITY_REQUIRED");
  }

  const facRes = await pool.query<{
    id: string;
    countryCode: string;
    kind: string;
    verificationStatus: string;
  }>(
    `SELECT
       id,
       country_code AS "countryCode",
       kind,
       verification_status AS "verificationStatus"
     FROM facilities
     WHERE id = $1
     LIMIT 1`,
    [targetFacilityId],
  );

  const facility = facRes.rows[0];
  if (!facility) {
    throw new PharmacyNotFoundError("Target pharmacy facility was not found.");
  }
  if (facility.kind !== "PHARMACY") {
    throw new PharmacyBadRequestError(
      "Products can only be added to a facility of kind PHARMACY.",
    );
  }
  if (
    actor.role !== "OPS_ADMIN" &&
    facility.countryCode !== actor.countryCode
  ) {
    throw new PharmacyForbiddenError(
      "Cross-country pharmacy catalog management is forbidden.",
    );
  }

  const pack = resolveCountryPack(facility.countryCode);

  let insertedId = "";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO pharmacy_products (
         country_code, facility_id, sku, name, generic_name, category,
         dosage_form, strength, requires_prescription, price_minor,
         currency_code, stock_qty, image_object_key, created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        facility.countryCode,
        facility.id,
        input.sku.trim().toUpperCase(),
        input.name.trim(),
        input.genericName?.trim() ?? null,
        input.category,
        input.dosageForm.trim(),
        input.strength.trim(),
        input.requiresPrescription,
        input.priceMinor,
        pack.currencyCode,
        input.stockQty,
        input.imageObjectKey?.trim() ?? null,
        actor.sub,
      ],
    );
    insertedId = insertRes.rows[0]!.id;

    await appendAuditLog(client, {
      countryCode: facility.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PHARMACY_PRODUCT_CREATED",
      resourceType: "pharmacy_product",
      resourceId: insertedId,
      metadata: { sku: input.sku, stockQty: input.stockQty },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: unknown }).code === "23505"
    ) {
      throw new PharmacyConflictError(
        "SKU already exists in this pharmacy facility.",
      );
    }
    throw err;
  } finally {
    client.release();
  }

  const product = await fetchProductById(pool, insertedId, s3Config);
  if (!product) {
    throw new Error("Created pharmacy product could not be hydrated.");
  }
  return product;
}

export async function updatePharmacyProductStock(
  pool: Pool,
  productId: string,
  actor: AuthTokenClaims,
  patch: { stockQty?: number; priceMinor?: number; isActive?: boolean },
  s3Config?: S3PresignConfig,
): Promise<PharmacyProductSummary> {
  const existing = await fetchProductById(pool, productId, s3Config);
  if (!existing) {
    throw new PharmacyNotFoundError("Pharmacy product not found.");
  }
  if (
    actor.role !== "OPS_ADMIN" &&
    existing.countryCode !== actor.countryCode
  ) {
    throw new PharmacyForbiddenError(
      "Cross-country pharmacy stock updates are forbidden.",
    );
  }

  await pool.query(
    `UPDATE pharmacy_products
     SET stock_qty = COALESCE($2, stock_qty),
         price_minor = COALESCE($3, price_minor),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $1`,
    [
      productId,
      patch.stockQty ?? null,
      patch.priceMinor ?? null,
      patch.isActive ?? null,
    ],
  );

  await appendAuditLog(pool, {
    countryCode: existing.countryCode,
    actorId: actor.sub,
    actorRole: actor.role,
    action: "PHARMACY_PRODUCT_STOCK_UPDATED",
    resourceType: "pharmacy_product",
    resourceId: productId,
    metadata: {
      stockQty: patch.stockQty ?? existing.stockQty,
      priceMinor: patch.priceMinor ?? existing.priceMinor,
    },
  });

  const updated = await fetchProductById(pool, productId, s3Config);
  if (!updated) {
    throw new PharmacyNotFoundError("Pharmacy product not found after update.");
  }
  return updated;
}

async function fetchOrderById(
  pool: Pool | PoolClient,
  orderId: string,
): Promise<PharmacyOrderSummary | null> {
  const orderRes = await pool.query(
    `SELECT
       o.id,
       o.country_code AS "countryCode",
       o.patient_user_id AS "patientUserId",
       u.full_name AS "patientName",
       o.facility_id AS "facilityId",
       f.name AS "facilityName",
       o.prescription_id AS "prescriptionId",
       o.fulfillment_mode AS "fulfillmentMode",
       o.delivery_address AS "deliveryAddress",
       o.dispatch_request_id AS "dispatchRequestId",
       o.status,
       o.currency_code AS "currencyCode",
       o.subtotal_minor AS "subtotalMinor",
       o.delivery_fee_minor AS "deliveryFeeMinor",
       o.total_minor AS "totalMinor",
       o.payment_method AS "paymentMethod",
       o.payment_reference AS "paymentReference",
       o.receipt_number AS "receiptNumber",
       o.notes,
       to_char(o.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "paidAtIso",
       to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
       to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
     FROM pharmacy_orders o
     JOIN users u ON u.id = o.patient_user_id
     JOIN facilities f ON f.id = o.facility_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId],
  );
  if (orderRes.rowCount === 0) return null;

  const itemsRes = await pool.query(
    `SELECT
       id,
       product_id AS "productId",
       product_name AS "productName",
       sku,
       requires_prescription AS "requiresPrescription",
       quantity,
       unit_price_minor AS "unitPriceMinor",
       line_total_minor AS "lineTotalMinor"
     FROM pharmacy_order_items
     WHERE order_id = $1
     ORDER BY product_name ASC`,
    [orderId],
  );

  return PharmacyOrderSummarySchema.parse({
    ...orderRes.rows[0],
    items: itemsRes.rows.map((r) => PharmacyOrderItemSummarySchema.parse(r)),
  });
}

export async function createPharmacyOrderAtomic(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreatePharmacyOrderInput,
): Promise<PharmacyOrderSummary> {
  if (
    input.fulfillmentMode === "COURIER_DELIVERY" &&
    (!input.deliveryAddress || input.deliveryAddress.trim().length < 5)
  ) {
    throw new PharmacyBadRequestError(
      "Delivery address is required for courier delivery orders.",
    );
  }

  // Merge duplicate line items by productId so row locking stays deadlock-free
  const qtyByProduct = new Map<string, number>();
  for (const item of input.items) {
    qtyByProduct.set(
      item.productId,
      (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }
  const sortedProductIds = Array.from(qtyByProduct.keys()).sort();

  const client = await pool.connect();
  let createdOrderId = "";

  try {
    await client.query("BEGIN");

    const facRes = await client.query<{
      id: string;
      countryCode: string;
      kind: string;
      verificationStatus: string;
      lat: number;
      lng: number;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         kind,
         verification_status AS "verificationStatus",
         lat,
         lng
       FROM facilities
       WHERE id = $1
       LIMIT 1`,
      [input.facilityId],
    );

    const facility = facRes.rows[0];
    if (!facility || facility.kind !== "PHARMACY") {
      throw new PharmacyNotFoundError("Target pharmacy facility not found.");
    }
    if (facility.verificationStatus !== "VERIFIED") {
      throw new PharmacyBadRequestError(
        "Orders can only be placed with verified pharmacy facilities.",
      );
    }
    if (
      actor.role !== "OPS_ADMIN" &&
      facility.countryCode !== actor.countryCode
    ) {
      throw new PharmacyForbiddenError(
        "Cross-country pharmacy checkout is forbidden.",
      );
    }

    const lockedProductsRes = await client.query<{
      id: string;
      facilityId: string;
      sku: string;
      name: string;
      requiresPrescription: boolean;
      priceMinor: number;
      currencyCode: string;
      stockQty: number;
      isActive: boolean;
    }>(
      `SELECT
         id,
         facility_id AS "facilityId",
         sku,
         name,
         requires_prescription AS "requiresPrescription",
         price_minor AS "priceMinor",
         currency_code AS "currencyCode",
         stock_qty AS "stockQty",
         is_active AS "isActive"
       FROM pharmacy_products
       WHERE id = ANY($1::uuid[])
       ORDER BY id ASC
       FOR UPDATE`,
      [sortedProductIds],
    );

    if (lockedProductsRes.rows.length !== sortedProductIds.length) {
      throw new PharmacyNotFoundError(
        "One or more cart items do not exist in the pharmacy catalog.",
      );
    }

    let requiresRx = false;
    let subtotalMinor = 0;

    const lineItemsToInsert: Array<{
      productId: string;
      productName: string;
      sku: string;
      requiresPrescription: boolean;
      quantity: number;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }> = [];

    for (const row of lockedProductsRes.rows) {
      if (row.facilityId !== facility.id || !row.isActive) {
        throw new PharmacyBadRequestError(
          `Product ${row.name} is not active in the selected pharmacy.`,
        );
      }
      const requestedQty = qtyByProduct.get(row.id) ?? 0;
      if (requestedQty <= 0) {
        throw new PharmacyBadRequestError("Invalid item quantity.");
      }
      if (row.stockQty < requestedQty) {
        throw new PharmacyConflictError(
          `INSUFFICIENT_STOCK:${row.sku} (${row.stockQty} left)`,
        );
      }
      if (row.requiresPrescription) {
        requiresRx = true;
      }
      const lineTotal = row.priceMinor * requestedQty;
      subtotalMinor += lineTotal;
      lineItemsToInsert.push({
        productId: row.id,
        productName: row.name,
        sku: row.sku,
        requiresPrescription: row.requiresPrescription,
        quantity: requestedQty,
        unitPriceMinor: row.priceMinor,
        lineTotalMinor: lineTotal,
      });
    }

    if (requiresRx) {
      if (!input.prescriptionId) {
        throw new PharmacyBadRequestError(
          "PRESCRIPTION_REQUIRED_FOR_RX_ITEMS",
        );
      }
      const rxRes = await client.query<{
        id: string;
        countryCode: string;
        patientUserId: string;
        status: string;
      }>(
        `SELECT
           id,
           country_code AS "countryCode",
           patient_user_id AS "patientUserId",
           status
         FROM prescriptions
         WHERE id = $1
         LIMIT 1`,
        [input.prescriptionId],
      );
      const rx = rxRes.rows[0];
      if (!rx || rx.status === "CANCELLED") {
        throw new PharmacyBadRequestError("INVALID_OR_CANCELLED_PRESCRIPTION");
      }
      if (rx.countryCode !== facility.countryCode) {
        throw new PharmacyForbiddenError(
          "Prescription country does not match pharmacy country.",
        );
      }
      if (
        (actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
        rx.patientUserId !== actor.sub
      ) {
        throw new PharmacyForbiddenError(
          "Cannot attach another patient's prescription.",
        );
      }
    }

    for (const item of lineItemsToInsert) {
      const decRes = await client.query(
        `UPDATE pharmacy_products
         SET stock_qty = stock_qty - $2,
             updated_at = NOW()
         WHERE id = $1 AND stock_qty >= $2`,
        [item.productId, item.quantity],
      );
      if (decRes.rowCount === 0) {
        throw new PharmacyConflictError(`INSUFFICIENT_STOCK:${item.sku}`);
      }
    }

    const currencyCode = resolveCountryPack(facility.countryCode).currencyCode;
    const deliveryFeeMinor =
      input.fulfillmentMode === "COURIER_DELIVERY"
        ? (DELIVERY_FEE_BY_COUNTRY[facility.countryCode] ?? 500)
        : 0;
    const totalMinor = subtotalMinor + deliveryFeeMinor;

    const orderInsertRes = await client.query<{ id: string }>(
      `INSERT INTO pharmacy_orders (
         country_code, patient_user_id, facility_id, prescription_id,
         fulfillment_mode, delivery_address, delivery_lat, delivery_lng,
         status, currency_code, subtotal_minor, delivery_fee_minor, total_minor, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_PAYMENT', $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        facility.countryCode,
        actor.sub,
        facility.id,
        input.prescriptionId ?? null,
        input.fulfillmentMode,
        input.deliveryAddress?.trim() ?? null,
        input.deliveryLat ?? facility.lat,
        input.deliveryLng ?? facility.lng,
        currencyCode,
        subtotalMinor,
        deliveryFeeMinor,
        totalMinor,
        input.notes?.trim() ?? null,
      ],
    );
    createdOrderId = orderInsertRes.rows[0]!.id;

    for (const item of lineItemsToInsert) {
      await client.query(
        `INSERT INTO pharmacy_order_items (
           order_id, product_id, product_name, sku,
           requires_prescription, quantity, unit_price_minor, line_total_minor
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          createdOrderId,
          item.productId,
          item.productName,
          item.sku,
          item.requiresPrescription,
          item.quantity,
          item.unitPriceMinor,
          item.lineTotalMinor,
        ],
      );
    }

    await appendAuditLog(client, {
      countryCode: facility.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PHARMACY_ORDER_CREATED",
      resourceType: "pharmacy_order",
      resourceId: createdOrderId,
      metadata: {
        facilityId: facility.id,
        itemCount: lineItemsToInsert.length,
        totalMinor,
        fulfillmentMode: input.fulfillmentMode,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const order = await fetchOrderById(pool, createdOrderId);
  if (!order) {
    throw new Error("Created pharmacy order could not be loaded.");
  }
  return order;
}

export async function confirmPharmacyOrderPayment(
  pool: Pool,
  redis: Redis,
  orderId: string,
  actor: AuthTokenClaims,
  input: ConfirmOrderPaymentInput,
): Promise<PharmacyOrderSummary> {
  const client = await pool.connect();
  let orderMeta: {
    countryCode: string;
    patientUserId: string;
    facilityId: string;
    fulfillmentMode: string;
    deliveryAddress: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    receiptNumber: string;
  } | null = null;

  try {
    await client.query("BEGIN");

    const checkRes = await client.query<{
      id: string;
      countryCode: string;
      patientUserId: string;
      facilityId: string;
      fulfillmentMode: string;
      deliveryAddress: string | null;
      deliveryLat: number | null;
      deliveryLng: number | null;
      status: string;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         patient_user_id AS "patientUserId",
         facility_id AS "facilityId",
         fulfillment_mode AS "fulfillmentMode",
         delivery_address AS "deliveryAddress",
         delivery_lat AS "deliveryLat",
         delivery_lng AS "deliveryLng",
         status
       FROM pharmacy_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId],
    );

    const existing = checkRes.rows[0];
    if (!existing) {
      throw new PharmacyNotFoundError("Pharmacy order not found.");
    }
    const isStaffSameCountry =
      ORDER_STAFF_ROLES.includes(actor.role) &&
      existing.countryCode === actor.countryCode;
    if (
      actor.role !== "OPS_ADMIN" &&
      existing.patientUserId !== actor.sub &&
      !isStaffSameCountry
    ) {
      throw new PharmacyForbiddenError(
        "You are not authorized to confirm payment for this order.",
      );
    }

    if (existing.status !== "PENDING_PAYMENT") {
      throw new PharmacyConflictError("ORDER_NOT_PENDING_PAYMENT");
    }

    const receiptNumber = `REC-${existing.countryCode}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;
    const paymentRef =
      input.paymentReference?.trim() ??
      `PAY-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

    await client.query(
      `UPDATE pharmacy_orders
       SET status = 'PAID',
           payment_method = $2,
           payment_reference = $3,
           receipt_number = $4,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, input.paymentMethod, paymentRef, receiptNumber],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PHARMACY_ORDER_PAID",
      resourceType: "pharmacy_order",
      resourceId: orderId,
      metadata: {
        paymentMethod: input.paymentMethod,
        receiptNumber,
      },
    });

    await client.query("COMMIT");
    orderMeta = {
      countryCode: existing.countryCode,
      patientUserId: existing.patientUserId,
      facilityId: existing.facilityId,
      fulfillmentMode: existing.fulfillmentMode,
      deliveryAddress: existing.deliveryAddress,
      deliveryLat: existing.deliveryLat,
      deliveryLng: existing.deliveryLng,
      receiptNumber,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // If courier delivery was selected, create live dispatch job through maps-dispatch barrel
  if (orderMeta && orderMeta.fulfillmentMode === "COURIER_DELIVERY") {
    const dispatch = await createDispatchRequest(
      pool,
      orderMeta.patientUserId,
      orderMeta.countryCode,
      {
        targetFacilityId: orderMeta.facilityId,
        pickupLat: orderMeta.deliveryLat ?? 33.5731,
        pickupLng: orderMeta.deliveryLng ?? -7.5898,
        pickupAddress:
          orderMeta.deliveryAddress ?? "Pharmacy Courier Dropoff Destination",
        urgency: "ROUTINE",
        notes: `Pharmacy courier order ${orderMeta.receiptNumber}`,
      },
    );

    await pool.query(
      `UPDATE pharmacy_orders SET dispatch_request_id = $2, updated_at = NOW() WHERE id = $1`,
      [orderId, dispatch.id],
    );
    await publishDispatchUpdate(redis, dispatch);
  }

  const hydrated = await fetchOrderById(pool, orderId);
  if (!hydrated) {
    throw new PharmacyNotFoundError("Order not found after payment.");
  }
  return hydrated;
}

export async function listPharmacyOrdersScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: { countryCode?: string; status?: string; limit?: number },
): Promise<PharmacyOrderSummary[]> {
  const effectiveCountry =
    actor.role === "OPS_ADMIN"
      ? (query.countryCode ?? null)
      : actor.countryCode;
  const patientOnly =
    actor.role === "PATIENT" || actor.role === "CAREGIVER" ? actor.sub : null;

  const idsRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM pharmacy_orders
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::uuid IS NULL OR patient_user_id = $2)
       AND ($3::text IS NULL OR status = $3)
     ORDER BY created_at DESC
     LIMIT $4`,
    [effectiveCountry, patientOnly, query.status ?? null, query.limit ?? 50],
  );

  const orders: PharmacyOrderSummary[] = [];
  for (const row of idsRes.rows) {
    const hydrated = await fetchOrderById(pool, row.id);
    if (hydrated) orders.push(hydrated);
  }
  return orders;
}

export async function updatePharmacyOrderStatusAtomic(
  pool: Pool,
  orderId: string,
  actor: AuthTokenClaims,
  input: UpdatePharmacyOrderStatusInput,
): Promise<PharmacyOrderSummary> {
  if (!ORDER_STAFF_ROLES.includes(actor.role)) {
    throw new PharmacyForbiddenError(
      "Only pharmacy, courier, or admin staff may advance order status.",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query<{
      id: string;
      countryCode: string;
      status: string;
    }>(
      `SELECT id, country_code AS "countryCode", status
       FROM pharmacy_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId],
    );
    const existing = checkRes.rows[0];
    if (!existing) {
      throw new PharmacyNotFoundError("Pharmacy order not found.");
    }
    if (
      actor.role !== "OPS_ADMIN" &&
      existing.countryCode !== actor.countryCode
    ) {
      throw new PharmacyForbiddenError(
        "Cross-country order state updates are forbidden.",
      );
    }

    if (
      existing.status === "CANCELLED" ||
      existing.status === "DELIVERED"
    ) {
      throw new PharmacyConflictError("ORDER_ALREADY_FINALIZED");
    }

    await client.query(
      `UPDATE pharmacy_orders
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, input.status],
    );

    if (input.status === "CANCELLED") {
      const itemsRes = await client.query<{
        productId: string;
        quantity: number;
      }>(
        `SELECT product_id AS "productId", quantity
         FROM pharmacy_order_items
         WHERE order_id = $1`,
        [orderId],
      );
      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE pharmacy_products
           SET stock_qty = stock_qty + $2,
               updated_at = NOW()
           WHERE id = $1`,
          [item.productId, item.quantity],
        );
      }
    }

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: `PHARMACY_ORDER_STATUS_${input.status}`,
      resourceType: "pharmacy_order",
      resourceId: orderId,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const updated = await fetchOrderById(pool, orderId);
  if (!updated) {
    throw new PharmacyNotFoundError("Order not found after update.");
  }
  return updated;
}

interface SeedProductTemplate {
  skuSuffix: string;
  name: string;
  genericName: string;
  category: PharmacyProductCategory;
  dosageForm: string;
  strength: string;
  requiresPrescription: boolean;
  priceByCurrency: Record<string, number>;
  stockQty: number;
}

const DEFAULT_PHARMACY_CATALOG: readonly SeedProductTemplate[] = [
  {
    skuSuffix: "PARAC-1000",
    name: "Doliprane / Paracetamol 1000mg",
    genericName: "Acetaminophen",
    category: "OTC_MEDICATION",
    dosageForm: "Box / 8 Tablets",
    strength: "1000 mg",
    requiresPrescription: false,
    priceByCurrency: { MAD: 2400, EUR: 320, USD: 699 },
    stockQty: 140,
  },
  {
    skuSuffix: "AMOX-500",
    name: "Amoxicillin Clavulanate 500/125",
    genericName: "Amoxicillin + Clavulanic Acid",
    category: "PRESCRIPTION_RX",
    dosageForm: "Box / 16 Film Tablets",
    strength: "500 mg",
    requiresPrescription: true,
    priceByCurrency: { MAD: 9500, EUR: 1180, USD: 1850 },
    stockQty: 65,
  },
  {
    skuSuffix: "AMLOD-5",
    name: "Amlodipine Besylate 5mg",
    genericName: "Amlodipine",
    category: "PRESCRIPTION_RX",
    dosageForm: "Blister / 30 Tablets",
    strength: "5 mg",
    requiresPrescription: true,
    priceByCurrency: { MAD: 7800, EUR: 940, USD: 1490 },
    stockQty: 80,
  },
  {
    skuSuffix: "OXIM-PRO",
    name: "Clinical Fingertip Pulse Oximeter",
    genericName: "SpO2 + Pulse Optical Sensor",
    category: "MEDICAL_DEVICE",
    dosageForm: "Diagnostic Device",
    strength: "OLED SpO2",
    requiresPrescription: false,
    priceByCurrency: { MAD: 24900, EUR: 2990, USD: 3499 },
    stockQty: 28,
  },
  {
    skuSuffix: "ORS-PED",
    name: "Pediatric Oral Rehydration Salts (ORS)",
    genericName: "Sodium Citrate + Glucose",
    category: "PEDIATRIC_CARE",
    dosageForm: "10 Sachets",
    strength: "WHO Formula",
    requiresPrescription: false,
    priceByCurrency: { MAD: 3600, EUR: 540, USD: 899 },
    stockQty: 95,
  },
  {
    skuSuffix: "INSUL-GLARG",
    name: "Insulin Glargine Cold-Chain Pen Pack",
    genericName: "Insulin Glargine",
    category: "COLD_CHAIN",
    dosageForm: "5 Pre-filled Pens (2-8°C)",
    strength: "100 U/mL",
    requiresPrescription: true,
    priceByCurrency: { MAD: 48500, EUR: 4950, USD: 8900 },
    stockQty: 18,
  },
];

export async function seedDefaultPharmacyProducts(pool: Pool): Promise<number> {
  const facRes = await pool.query<{ id: string; countryCode: string }>(
    `SELECT id, country_code AS "countryCode"
     FROM facilities
     WHERE kind = 'PHARMACY'
       AND verification_status = 'VERIFIED'`,
  );

  let seededCount = 0;
  for (const fac of facRes.rows) {
    const pack = resolveCountryPack(fac.countryCode);
    for (const tmpl of DEFAULT_PHARMACY_CATALOG) {
      const sku = `${fac.countryCode}-${tmpl.skuSuffix}`;
      const priceMinor = tmpl.priceByCurrency[pack.currencyCode] ?? 990;
      const insRes = await pool.query(
        `INSERT INTO pharmacy_products (
           country_code, facility_id, sku, name, generic_name, category,
           dosage_form, strength, requires_prescription, price_minor,
           currency_code, stock_qty, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
         ON CONFLICT (facility_id, sku) DO NOTHING`,
        [
          fac.countryCode,
          fac.id,
          sku,
          tmpl.name,
          tmpl.genericName,
          tmpl.category,
          tmpl.dosageForm,
          tmpl.strength,
          tmpl.requiresPrescription,
          priceMinor,
          pack.currencyCode,
          tmpl.stockQty,
        ],
      );
      if ((insRes.rowCount ?? 0) > 0) {
        seededCount += 1;
      }
    }
  }
  return seededCount;
}
