import crypto from "node:crypto";
import type { Redis } from "ioredis";
import type { Pool, PoolClient } from "pg";
import {
  DispatchRequestSummarySchema,
  PharmacyOrderItemSummarySchema,
  PharmacyOrderSummarySchema,
  PharmacyProductSummarySchema,
  type ConfirmOrderPaymentInput,
  type CreatePharmacyOrderInput,
  type CreatePharmacyProductInput,
  type DispatchRequestSummary,
  type ListPharmacyProductsQuery,
  type PaymentWebhookEvent,
  type PharmacyOrderSummary,
  type PharmacyProductCategory,
  type PharmacyProductSummary,
  type UpdatePharmacyOrderStatusInput,
  type UpdatePharmacyProductInput,
  type UserRole,
} from "@medisync/contracts";
import {
  getMoroccanCityAliasTerms,
  resolveCountryPack,
} from "@medisync/country-packs";
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

export function resolveCourierFeeMinor(countryCode?: string): number {
  const key = countryCode?.trim().toUpperCase() ?? "INTL";
  return DELIVERY_FEE_BY_COUNTRY[key] ?? DELIVERY_FEE_BY_COUNTRY.INTL!;
}

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
       f.city AS "facilityCity",
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
  const cityPatterns =
    query.city && query.city.trim().length > 0
      ? getMoroccanCityAliasTerms(query.city).map((term) => `%${term}%`)
      : null;

  const res = await pool.query(
    `SELECT
       p.id,
       p.country_code AS "countryCode",
       p.facility_id AS "facilityId",
       f.name AS "facilityName",
       f.city AS "facilityCity",
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
     WHERE ($7::boolean IS TRUE OR p.is_active = TRUE)
       AND ($1::text IS NULL OR p.country_code = $1)
       AND ($2::uuid IS NULL OR p.facility_id = $2)
       AND ($3::text IS NULL OR p.category = $3)
       AND ($4::boolean IS NULL OR p.stock_qty > 0)
       AND (
         $5::text IS NULL
         OR p.name ILIKE $5
         OR COALESCE(p.generic_name, '') ILIKE $5
         OR p.sku ILIKE $5
         OR f.name ILIKE $5
         OR COALESCE(f.city, '') ILIKE $5
       )
       AND (
         $8::text[] IS NULL
         OR translate(COALESCE(f.city, ''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY') ILIKE ANY($8::text[])
       )
     ORDER BY p.is_active DESC, p.requires_prescription ASC, p.name ASC
     LIMIT $6`,
    [
      query.countryCode ?? null,
      query.facilityId ?? null,
      query.category ?? null,
      query.inStockOnly ? true : null,
      pattern,
      query.limit,
      Boolean(query.includeInactive),
      cityPatterns,
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
  patch: UpdatePharmacyProductInput,
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

  const nextGeneric =
    patch.genericName === undefined
      ? existing.genericName
      : patch.genericName?.trim() || null;

  try {
    await pool.query(
      `UPDATE pharmacy_products
       SET sku = COALESCE($2, sku),
           name = COALESCE($3, name),
           generic_name = $4,
           category = COALESCE($5, category),
           dosage_form = COALESCE($6, dosage_form),
           strength = COALESCE($7, strength),
           requires_prescription = COALESCE($8, requires_prescription),
           stock_qty = COALESCE($9, stock_qty),
           price_minor = COALESCE($10, price_minor),
           is_active = COALESCE($11, is_active),
           updated_at = NOW()
       WHERE id = $1`,
      [
        productId,
        patch.sku ? patch.sku.trim().toUpperCase() : null,
        patch.name ? patch.name.trim() : null,
        nextGeneric,
        patch.category ?? null,
        patch.dosageForm ? patch.dosageForm.trim() : null,
        patch.strength ? patch.strength.trim() : null,
        patch.requiresPrescription ?? null,
        patch.stockQty ?? null,
        patch.priceMinor ?? null,
        patch.isActive ?? null,
      ],
    );
  } catch (err) {
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
  }

  await appendAuditLog(pool, {
    countryCode: existing.countryCode,
    actorId: actor.sub,
    actorRole: actor.role,
    action: "PHARMACY_PRODUCT_UPDATED",
    resourceType: "pharmacy_product",
    resourceId: productId,
    metadata: {
      sku: patch.sku ? patch.sku.trim().toUpperCase() : existing.sku,
      stockQty: patch.stockQty ?? existing.stockQty,
      priceMinor: patch.priceMinor ?? existing.priceMinor,
      isActive: patch.isActive ?? existing.isActive,
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
      if (!rx || rx.status !== "ISSUED") {
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

    const countryPack = resolveCountryPack(facility.countryCode);
    if (
      requiresRx &&
      !countryPack.allowRxCourierDelivery &&
      input.fulfillmentMode === "COURIER_DELIVERY"
    ) {
      throw new PharmacyBadRequestError(
        `PRESCRIPTION_PICKUP_REQUIRED_${facility.countryCode}: Under ${countryPack.pharmacyLawReference ?? "national pharmacy regulations"}, prescription medications require in-person pickup at the licensed pharmacy.`,
      );
    }

    const decRes = await client.query<{ id: string }>(
      `UPDATE pharmacy_products AS p
       SET stock_qty = p.stock_qty - v.qty,
           updated_at = NOW()
       FROM unnest($1::uuid[], $2::int[]) AS v(id, qty)
       WHERE p.id = v.id AND p.stock_qty >= v.qty
       RETURNING p.id`,
      [
        lineItemsToInsert.map((item) => item.productId),
        lineItemsToInsert.map((item) => item.quantity),
      ],
    );
    if ((decRes.rowCount ?? 0) !== lineItemsToInsert.length) {
      const updatedIds = new Set(decRes.rows.map((r) => r.id));
      const failed = lineItemsToInsert.find((it) => !updatedIds.has(it.productId));
      throw new PharmacyConflictError(
        `INSUFFICIENT_STOCK:${failed?.sku ?? "UNKNOWN"}`,
      );
    }

    const currencyCode = resolveCountryPack(facility.countryCode).currencyCode;
    const deliveryFeeMinor =
      input.fulfillmentMode === "COURIER_DELIVERY"
        ? resolveCourierFeeMinor(facility.countryCode)
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

    await client.query(
      `INSERT INTO pharmacy_order_items (
         order_id, product_id, product_name, sku,
         requires_prescription, quantity, unit_price_minor, line_total_minor
       )
       SELECT $1, v.product_id, v.product_name, v.sku, v.requires_rx, v.qty, v.unit_price, v.line_total
       FROM unnest(
         $2::uuid[],
         $3::text[],
         $4::text[],
         $5::boolean[],
         $6::int[],
         $7::int[],
         $8::int[]
       ) AS v(product_id, product_name, sku, requires_rx, qty, unit_price, line_total)`,
      [
        createdOrderId,
        lineItemsToInsert.map((i) => i.productId),
        lineItemsToInsert.map((i) => i.productName),
        lineItemsToInsert.map((i) => i.sku),
        lineItemsToInsert.map((i) => i.requiresPrescription),
        lineItemsToInsert.map((i) => i.quantity),
        lineItemsToInsert.map((i) => i.unitPriceMinor),
        lineItemsToInsert.map((i) => i.lineTotalMinor),
      ],
    );

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
      (actor.role === "PHARMACIST" || actor.role === "HOSPITAL_ADMIN") &&
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
    let fallbackLat = orderMeta.deliveryLat;
    let fallbackLng = orderMeta.deliveryLng;
    if (fallbackLat === null || fallbackLng === null) {
      const facRes = await pool.query<{ lat: number; lng: number }>(
        `SELECT lat, lng FROM facilities WHERE id = $1 LIMIT 1`,
        [orderMeta.facilityId],
      );
      fallbackLat = facRes.rows[0]?.lat ?? 0;
      fallbackLng = facRes.rows[0]?.lng ?? 0;
    }

    const dispatch = await createDispatchRequest(
      pool,
      orderMeta.patientUserId,
      orderMeta.countryCode,
      {
        targetFacilityId: orderMeta.facilityId,
        pickupLat: fallbackLat,
        pickupLng: fallbackLng,
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

  const ordersRes = await pool.query<Record<string, unknown>>(
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
     WHERE ($1::text IS NULL OR o.country_code = $1)
       AND ($2::uuid IS NULL OR o.patient_user_id = $2)
       AND ($3::text IS NULL OR o.status = $3)
     ORDER BY o.created_at DESC
     LIMIT $4`,
    [effectiveCountry, patientOnly, query.status ?? null, query.limit ?? 50],
  );

  if (ordersRes.rows.length === 0) return [];

  const orderIds = ordersRes.rows.map((row) => String(row.id));
  const itemsRes = await pool.query<Record<string, unknown> & { orderId: string }>(
    `SELECT
       order_id AS "orderId",
       id,
       product_id AS "productId",
       product_name AS "productName",
       sku,
       requires_prescription AS "requiresPrescription",
       quantity,
       unit_price_minor AS "unitPriceMinor",
       line_total_minor AS "lineTotalMinor"
     FROM pharmacy_order_items
     WHERE order_id = ANY($1::uuid[])
     ORDER BY order_id ASC, product_name ASC`,
    [orderIds],
  );

  const itemsByOrderId = new Map<string, ReturnType<typeof PharmacyOrderItemSummarySchema.parse>[]>();
  for (const itemRow of itemsRes.rows) {
    const orderId = String(itemRow.orderId);
    const list = itemsByOrderId.get(orderId) ?? [];
    list.push(PharmacyOrderItemSummarySchema.parse(itemRow));
    itemsByOrderId.set(orderId, list);
  }

  return ordersRes.rows.map((row) =>
    PharmacyOrderSummarySchema.parse({
      ...row,
      items: itemsByOrderId.get(String(row.id)) ?? [],
    }),
  );
}

export async function updatePharmacyOrderStatusAtomic(
  pool: Pool,
  redis: Redis | undefined,
  orderId: string,
  actor: AuthTokenClaims,
  input: UpdatePharmacyOrderStatusInput,
): Promise<PharmacyOrderSummary> {
  const isStaff = ORDER_STAFF_ROLES.includes(actor.role);
  const isSelfPendingCancelCandidate = input.status === "CANCELLED";
  if (!isStaff && !isSelfPendingCancelCandidate) {
    throw new PharmacyForbiddenError(
      "Only pharmacy, courier, or admin staff may advance order status.",
    );
  }

  let cancelledDispatch: DispatchRequestSummary | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query<{
      id: string;
      countryCode: string;
      patientUserId: string;
      status: string;
      dispatchRequestId: string | null;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         patient_user_id AS "patientUserId",
         status,
         dispatch_request_id AS "dispatchRequestId"
       FROM pharmacy_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId],
    );
    const existing = checkRes.rows[0];
    if (!existing) {
      throw new PharmacyNotFoundError("Pharmacy order not found.");
    }
    if (!isStaff) {
      if (
        existing.patientUserId !== actor.sub ||
        existing.status !== "PENDING_PAYMENT" ||
        input.status !== "CANCELLED"
      ) {
        throw new PharmacyForbiddenError(
          "Only pharmacy, courier, or admin staff may advance order status.",
        );
      }
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

    const ALLOWED_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
      PENDING_PAYMENT: ["CANCELLED"],
      PAID: ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
      PREPARING: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
    };
    const allowedNext = ALLOWED_ORDER_TRANSITIONS[existing.status] ?? [];
    if (!allowedNext.includes(input.status)) {
      throw new PharmacyConflictError(
        `INVALID_ORDER_TRANSITION:${existing.status}->${input.status}`,
      );
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
      if (itemsRes.rows.length > 0) {
        await client.query(
          `UPDATE pharmacy_products AS p
           SET stock_qty = p.stock_qty + v.qty,
               updated_at = NOW()
           FROM unnest($1::uuid[], $2::int[]) AS v(id, qty)
           WHERE p.id = v.id`,
          [
            itemsRes.rows.map((it) => it.productId),
            itemsRes.rows.map((it) => it.quantity),
          ],
        );
      }

      if (existing.dispatchRequestId) {
        const dispatchRes = await client.query(
          `UPDATE dispatch_requests
           SET status = 'CANCELLED',
               updated_at = NOW()
           WHERE id = $1
             AND status = 'REQUESTED'
           RETURNING
             id,
             country_code AS "countryCode",
             patient_user_id AS "patientUserId",
             driver_user_id AS "driverUserId",
             target_facility_id AS "targetFacilityId",
             pickup_lat AS "pickupLat",
             pickup_lng AS "pickupLng",
             pickup_address AS "pickupAddress",
             urgency,
             status,
             notes,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"`,
          [existing.dispatchRequestId],
        );
        if (dispatchRes.rows[0]) {
          cancelledDispatch = DispatchRequestSummarySchema.parse(
            dispatchRes.rows[0],
          );
        }
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

  if (cancelledDispatch && redis) {
    await publishDispatchUpdate(redis, cancelledDispatch).catch(() => undefined);
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

export async function settlePaymentWebhookAtomic(
  pool: Pool,
  redis: Redis | undefined,
  event: PaymentWebhookEvent,
): Promise<{ processed: boolean; deduplicated: boolean }> {
  const client: PoolClient = await pool.connect();
  let dispatchTarget: {
    orderId: string;
    patientUserId: string;
    countryCode: string;
    facilityId: string;
    deliveryAddress: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    receiptNumber: string;
  } | null = null;

  try {
    await client.query("BEGIN");

    const eventInsert = await client.query<{ id: string }>(
      `INSERT INTO payment_webhook_events (
         provider, event_id, resource_type, resource_id, amount_minor, currency_code, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [
        event.provider,
        event.eventId,
        event.resourceType,
        event.resourceId,
        event.amountMinor,
        event.currencyCode.toUpperCase(),
        event.status,
      ],
    );
    if (eventInsert.rowCount === 0) {
      await client.query("COMMIT");
      return { processed: true, deduplicated: true };
    }

    if (event.status === "SUCCEEDED") {
      if (event.resourceType === "PHARMACY_ORDER") {
        const orderRes = await client.query<{
          id: string;
          countryCode: string;
          patientUserId: string;
          facilityId: string;
          fulfillmentMode: string;
          deliveryAddress: string | null;
          deliveryLat: number | null;
          deliveryLng: number | null;
          status: string;
          totalMinor: number;
          currencyCode: string;
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
             status,
             total_minor AS "totalMinor",
             currency_code AS "currencyCode"
           FROM pharmacy_orders
           WHERE id = $1
           FOR UPDATE`,
          [event.resourceId],
        );
        const order = orderRes.rows[0];
        if (!order) {
          throw new PharmacyNotFoundError("PHARMACY_ORDER_NOT_FOUND");
        }
        if (
          event.amountMinor < order.totalMinor ||
          event.currencyCode.toUpperCase() !== order.currencyCode.toUpperCase()
        ) {
          throw new PharmacyBadRequestError("WEBHOOK_AMOUNT_OR_CURRENCY_MISMATCH");
        }
        if (order.status === "PENDING_PAYMENT") {
          const receiptNumber = `REC-${order.countryCode}-${crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;
          await client.query(
            `UPDATE pharmacy_orders
             SET status = 'PAID',
                 payment_method = 'CARD_SIMULATED',
                 payment_reference = $2,
                 receipt_number = $3,
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [order.id, event.paymentReference, receiptNumber],
          );
          await appendAuditLog(client, {
            countryCode: order.countryCode,
            actorId: order.patientUserId,
            actorRole: "PATIENT",
            action: "PAYMENT_WEBHOOK_SETTLED",
            resourceType: "pharmacy_order",
            resourceId: order.id,
            metadata: {
              source: "PAYMENT_WEBHOOK",
              provider: event.provider,
              eventId: event.eventId,
              paymentReference: event.paymentReference,
            },
          });
          if (order.fulfillmentMode === "COURIER_DELIVERY") {
            dispatchTarget = {
              orderId: order.id,
              patientUserId: order.patientUserId,
              countryCode: order.countryCode,
              facilityId: order.facilityId,
              deliveryAddress: order.deliveryAddress,
              deliveryLat: order.deliveryLat,
              deliveryLng: order.deliveryLng,
              receiptNumber,
            };
          }
        }
      } else {
        const invRes = await client.query<{
          id: string;
          countryCode: string;
          patientUserId: string;
          status: string;
          patientPayableMinor: number;
          currencyCode: string;
        }>(
          `SELECT
             id,
             country_code AS "countryCode",
             patient_user_id AS "patientUserId",
             status,
             patient_payable_minor AS "patientPayableMinor",
             currency_code AS "currencyCode"
           FROM medical_invoices
           WHERE id = $1
           FOR UPDATE`,
          [event.resourceId],
        );
        const invoice = invRes.rows[0];
        if (!invoice) {
          throw new PharmacyNotFoundError("MEDICAL_INVOICE_NOT_FOUND");
        }
        if (
          event.amountMinor < invoice.patientPayableMinor ||
          event.currencyCode.toUpperCase() !== invoice.currencyCode.toUpperCase()
        ) {
          throw new PharmacyBadRequestError("WEBHOOK_AMOUNT_OR_CURRENCY_MISMATCH");
        }
        if (invoice.status !== "PAID" && invoice.status !== "VOID" && invoice.status !== "REFUNDED") {
          await client.query(
            `UPDATE medical_invoices
             SET status = 'PAID',
                 payment_method = $2,
                 payment_reference = $3,
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [invoice.id, event.provider, event.paymentReference],
          );
          await appendAuditLog(client, {
            countryCode: invoice.countryCode,
            actorId: invoice.patientUserId,
            actorRole: "PATIENT",
            action: "PAYMENT_WEBHOOK_SETTLED",
            resourceType: "medical_invoice",
            resourceId: invoice.id,
            metadata: {
              source: "PAYMENT_WEBHOOK",
              provider: event.provider,
              eventId: event.eventId,
              paymentReference: event.paymentReference,
            },
          });
        }
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  if (dispatchTarget) {
    let lat = dispatchTarget.deliveryLat;
    let lng = dispatchTarget.deliveryLng;
    if (lat === null || lng === null) {
      const facRes = await pool.query<{ lat: number; lng: number }>(
        `SELECT lat, lng FROM facilities WHERE id = $1 LIMIT 1`,
        [dispatchTarget.facilityId],
      );
      lat = facRes.rows[0]?.lat ?? 0;
      lng = facRes.rows[0]?.lng ?? 0;
    }
    const dispatch = await createDispatchRequest(
      pool,
      dispatchTarget.patientUserId,
      dispatchTarget.countryCode,
      {
        targetFacilityId: dispatchTarget.facilityId,
        pickupLat: lat,
        pickupLng: lng,
        pickupAddress:
          dispatchTarget.deliveryAddress ?? "Pharmacy Courier Dropoff Destination",
        urgency: "ROUTINE",
        notes: `Pharmacy courier order ${dispatchTarget.receiptNumber}`,
      },
    );
    await pool.query(
      `UPDATE pharmacy_orders SET dispatch_request_id = $2, updated_at = NOW() WHERE id = $1`,
      [dispatchTarget.orderId, dispatch.id],
    );
    if (redis) {
      await publishDispatchUpdate(redis, dispatch);
    }
  }

  return { processed: true, deduplicated: false };
}
