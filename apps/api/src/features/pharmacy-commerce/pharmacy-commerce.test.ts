import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  FacilitySummary,
  PharmacyOrderResponse,
  PharmacyProductResponse,
  PharmacyProductsResponse,
  PrescriptionResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 8 pharmacy-commerce: catalog, atomic stock locks, Rx validation & courier dispatch", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseNum = `MA-PHRM-${Math.floor(100000 + crypto.randomInt(0, 800000))}`;
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdDispatchIds: string[] = [];
  const createdRxIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    pool = createDbPool(databaseUrl);
    redis = createRedisClient(redisUrl);
    await runMigrations(pool);

    app = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      pool,
      redis,
      runDbMigrations: false,
    });
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await pool.query("DELETE FROM pharmacy_orders WHERE id = ANY($1::uuid[])", [
        createdOrderIds,
      ]);
    }
    if (createdDispatchIds.length > 0) {
      await pool.query(
        "DELETE FROM dispatch_requests WHERE id = ANY($1::uuid[])",
        [createdDispatchIds],
      );
    }
    if (createdRxIds.length > 0) {
      await pool.query("DELETE FROM prescriptions WHERE id = ANY($1::uuid[])", [
        createdRxIds,
      ]);
    }
    if (createdProductIds.length > 0) {
      await pool.query(
        "DELETE FROM pharmacy_products WHERE id = ANY($1::uuid[])",
        [createdProductIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
        [createdUserIds],
      );
    }
    if (createdFacilityIds.length > 0) {
      await pool.query("DELETE FROM facilities WHERE id = ANY($1::uuid[])", [
        createdFacilityIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }

    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("enforces atomic stock checkout, Rx linking, payment receipt generation & courier dispatch creation", async () => {
    const registerActor = async (
      prefix: string,
      role: "PHARMACIST" | "DOCTOR" | "PATIENT",
      countryCode: string,
    ): Promise<AuthResponse> => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `${prefix}-${runSuffix}@medisync.test`,
          password: "StrongPassword!123",
          fullName: `Actor ${prefix}`,
          role,
          countryCode,
        },
      });
      expect(res.statusCode).toBe(201);
      const auth = res.json<AuthResponse>();
      createdUserIds.push(auth.user.id);
      return auth;
    };

    const pharmMa = await registerActor("pharm-comm", "PHARMACIST", "MA");
    const docMa = await registerActor("doc-comm", "DOCTOR", "MA");
    const patMa = await registerActor("pat-comm", "PATIENT", "MA");
    const patFr = await registerActor("pat-fr-comm", "PATIENT", "FR");

    // 1. Onboard & verify MA Pharmacy
    const facRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: {
        countryCode: "MA",
        kind: "PHARMACY",
        name: `Pharmacie Commerce ${runSuffix}`,
        licenseNumber: licenseNum,
        lat: 33.5818,
        lng: -7.6348,
        address: "100 Boulevard Bir Anzarane, Casablanca",
      },
    });
    expect(facRes.statusCode).toBe(201);
    const pharmacy = facRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(pharmacy.id);
    await pool.query(
      `UPDATE facilities SET verification_status = 'VERIFIED' WHERE id = $1`,
      [pharmacy.id],
    );

    // 2. Pharmacist creates OTC item with stock = 1 (to test race) + Rx item with stock = 10
    const otcCreate = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/products",
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        sku: `MA-RACE-${runSuffix}`,
        name: "Limited Pulse Oximeter",
        category: "MEDICAL_DEVICE",
        requiresPrescription: false,
        priceMinor: 25000,
        stockQty: 1,
      },
    });
    expect(otcCreate.statusCode).toBe(201);
    const otcProd = otcCreate.json<PharmacyProductResponse>().product;
    createdProductIds.push(otcProd.id);
    expect(otcProd.currencyCode).toBe("MAD");

    const rxProdCreate = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/products",
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        sku: `MA-RX-${runSuffix}`,
        name: "Amoxicillin 500mg Rx",
        category: "PRESCRIPTION_RX",
        requiresPrescription: true,
        priceMinor: 8500,
        stockQty: 10,
      },
    });
    expect(rxProdCreate.statusCode).toBe(201);
    const rxProd = rxProdCreate.json<PharmacyProductResponse>().product;
    createdProductIds.push(rxProd.id);

    // Cross-country FR patient blocked from MA pharmacy checkout
    const crossCountryOrder = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patFr.token}` },
      payload: {
        facilityId: pharmacy.id,
        items: [{ productId: otcProd.id, quantity: 1 }],
        fulfillmentMode: "PHARMACY_PICKUP",
      },
    });
    expect(crossCountryOrder.statusCode).toBe(403);

    // 3. Concurrent double-checkout for stock=1 OTC item -> exactly one 201 and one 409!
    const [raceA, raceB] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/v1/pharmacy/orders",
        headers: { authorization: `Bearer ${patMa.token}` },
        payload: {
          facilityId: pharmacy.id,
          items: [{ productId: otcProd.id, quantity: 1 }],
          fulfillmentMode: "PHARMACY_PICKUP",
        },
      }),
      app.inject({
        method: "POST",
        url: "/v1/pharmacy/orders",
        headers: { authorization: `Bearer ${patMa.token}` },
        payload: {
          facilityId: pharmacy.id,
          items: [{ productId: otcProd.id, quantity: 1 }],
          fulfillmentMode: "PHARMACY_PICKUP",
        },
      }),
    ]);

    const raceCodes = [raceA.statusCode, raceB.statusCode].sort();
    expect(raceCodes).toEqual([201, 409]);
    const winningOrder = (
      raceA.statusCode === 201 ? raceA : raceB
    ).json<PharmacyOrderResponse>().order;
    createdOrderIds.push(winningOrder.id);

    // 4. Rx item without prescriptionId fails with 400 PRESCRIPTION_REQUIRED_FOR_RX_ITEMS
    const missingRxOrder = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        items: [{ productId: rxProd.id, quantity: 1 }],
        fulfillmentMode: "COURIER_DELIVERY",
        deliveryAddress: "240 Boulevard d'Anfa, Casablanca",
      },
    });
    expect(missingRxOrder.statusCode).toBe(400);

    // Doctor issues real prescription -> Morocco Law 17-04 blocks Rx courier delivery, allows Rx counter pickup, and allows courier dispatch for OTC/devices
    const rxRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions",
      headers: { authorization: `Bearer ${docMa.token}` },
      payload: {
        patientUserId: patMa.user.id,
        medications: [
          {
            name: "Amoxicillin",
            dosage: "500mg",
            frequency: "3x daily",
            durationDays: 7,
          },
        ],
      },
    });
    expect(rxRes.statusCode).toBe(201);
    const issuedRx = rxRes.json<PrescriptionResponse>().prescription;
    createdRxIds.push(issuedRx.id);

    const blockedRxCourierRes = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        prescriptionId: issuedRx.id,
        items: [{ productId: rxProd.id, quantity: 1 }],
        fulfillmentMode: "COURIER_DELIVERY",
        deliveryAddress: "240 Boulevard d'Anfa, Casablanca",
      },
    });
    expect(blockedRxCourierRes.statusCode).toBe(400);
    expect(blockedRxCourierRes.json<{ error: string }>().error).toContain(
      "PRESCRIPTION_PICKUP_REQUIRED_MA",
    );

    const rxPickupOrderRes = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        prescriptionId: issuedRx.id,
        items: [{ productId: rxProd.id, quantity: 2 }],
        fulfillmentMode: "PHARMACY_PICKUP",
      },
    });
    expect(rxPickupOrderRes.statusCode).toBe(201);
    const rxPickupOrder = rxPickupOrderRes.json<PharmacyOrderResponse>().order;
    createdOrderIds.push(rxPickupOrder.id);
    expect(rxPickupOrder.subtotalMinor).toBe(17000);
    expect(rxPickupOrder.deliveryFeeMinor).toBe(0);
    expect(rxPickupOrder.totalMinor).toBe(17000);

    // Non-Rx medical device supports full COURIER_DELIVERY + dispatch creation
    const otcDeviceCreate = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/products",
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        sku: `MA-DEV-${runSuffix}`,
        name: "Digital BP Monitor",
        category: "MEDICAL_DEVICE",
        requiresPrescription: false,
        priceMinor: 18000,
        stockQty: 5,
      },
    });
    expect(otcDeviceCreate.statusCode).toBe(201);
    const otcDevice = otcDeviceCreate.json<PharmacyProductResponse>().product;
    createdProductIds.push(otcDevice.id);

    const courierOrderRes = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patMa.token}` },
      payload: {
        facilityId: pharmacy.id,
        items: [{ productId: otcDevice.id, quantity: 1 }],
        fulfillmentMode: "COURIER_DELIVERY",
        deliveryAddress: "240 Boulevard d'Anfa, Casablanca",
        deliveryLat: 33.5912,
        deliveryLng: -7.641,
      },
    });
    expect(courierOrderRes.statusCode).toBe(201);
    const courierOrder = courierOrderRes.json<PharmacyOrderResponse>().order;
    createdOrderIds.push(courierOrder.id);
    expect(courierOrder.subtotalMinor).toBe(18000);
    expect(courierOrder.deliveryFeeMinor).toBe(2500);
    expect(courierOrder.totalMinor).toBe(20500);

    const payRes = await app.inject({
      method: "POST",
      url: `/v1/pharmacy/orders/${courierOrder.id}/confirm-payment`,
      headers: { authorization: `Bearer ${patMa.token}` },
      payload: { paymentMethod: "CARD_SIMULATED" },
    });
    expect(payRes.statusCode).toBe(200);
    const paidOrder = payRes.json<PharmacyOrderResponse>().order;
    expect(paidOrder.status).toBe("PAID");
    expect(paidOrder.receiptNumber).toMatch(/^REC-MA-/);
    expect(paidOrder.dispatchRequestId).toBeTruthy();
    if (paidOrder.dispatchRequestId) {
      createdDispatchIds.push(paidOrder.dispatchRequestId);
    }

    // 4. Pharmacist updates product metadata & pauses SKU; ?includeInactive=true enforces RBAC
    const patchProdRes = await app.inject({
      method: "PATCH",
      url: `/v1/pharmacy/products/${rxProd.id}`,
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: {
        name: "Amoxicillin 500mg Clavulanate",
        priceMinor: 9200,
        isActive: false,
      },
    });
    expect(patchProdRes.statusCode).toBe(200);
    const updatedProd = patchProdRes.json<PharmacyProductResponse>().product;
    expect(updatedProd.name).toBe("Amoxicillin 500mg Clavulanate");
    expect(updatedProd.priceMinor).toBe(9200);
    expect(updatedProd.isActive).toBe(false);

    const anonInactiveAttempt = await app.inject({
      method: "GET",
      url: "/v1/pharmacy/products?countryCode=MA&includeInactive=true",
    });
    expect(anonInactiveAttempt.statusCode).toBe(401);

    const pharmAllSkus = await app.inject({
      method: "GET",
      url: "/v1/pharmacy/products?countryCode=MA&includeInactive=true",
      headers: { authorization: `Bearer ${pharmMa.token}` },
    });
    expect(pharmAllSkus.statusCode).toBe(200);
    expect(
      pharmAllSkus
        .json<PharmacyProductsResponse>()
        .products.some((p) => p.id === rxProd.id && !p.isActive),
    ).toBe(true);
  });
});
