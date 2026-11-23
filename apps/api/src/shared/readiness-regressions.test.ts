import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  DirectoryDoctorsResponse,
  DispatchRequestSummary,
  PharmacyOrderResponse,
  PharmacyProductResponse,
  PharmacyProductsResponse,
  ViewportFacilityItem,
} from "@medisync/contracts";
import { buildApiServer } from "../server.js";
import { createDbPool } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { createRedisClient } from "./redis/client.js";
import { loadApiEnv, readOptionalEnvBool } from "./env.js";
import {
  buildS3CorsXml,
  DEFAULT_DEV_S3_CONFIG,
  ensureS3BucketCors,
} from "./storage/s3-presign.js";
import {
  setSessionCookie,
  verifyLiveSessionToken,
} from "../features/foundation/guard.js";
import { isSimulatedCardAllowed } from "./payments/psp.js";
import { SEEDED_DEMO_PASSWORD } from "../features/directory/pg-store.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("production readiness regressions: env parsing, RBAC parity, multi-city MA seed, cache & webhook limits", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdDispatchIds: string[] = [];

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
      seedDemoWorld: true,
      allowSimulatedPayments: true,
      paymentWebhookSecret: "medisync-regression-webhook-secret-32",
    });
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await pool.query("DELETE FROM pharmacy_orders WHERE id = ANY($1::uuid[])", [
        createdOrderIds,
      ]);
    }
    if (createdDispatchIds.length > 0) {
      await pool.query("DELETE FROM dispatch_requests WHERE id = ANY($1::uuid[])", [
        createdDispatchIds,
      ]);
    }
    if (createdProductIds.length > 0) {
      await pool.query("DELETE FROM pharmacy_products WHERE id = ANY($1::uuid[])", [
        createdProductIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("parses .env.production blank optional variables without crashing startup", () => {
    const parsed = loadApiEnv({
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://medisync:prod_secure_db_pass_9876543210@postgres:5432/medisync",
      REDIS_URL: DEFAULT_TEST_REDIS_URL,
      AUTH_SECRET: TEST_AUTH_SECRET,
      S3_ACCESS_KEY_ID: "AKIA_PROD_TEST_KEY_1234",
      S3_SECRET_ACCESS_KEY: "prod-s3-secret-key-minimum-32-chars-ok",
      GOOGLE_CLIENT_ID: "",
      S3_PUBLIC_ENDPOINT: "   ",
      SMTP_WEBHOOK_URL: "",
      SMS_WEBHOOK_URL: "",
      PAYMENT_WEBHOOK_SECRET: "",
      ALLOW_SIMULATED_PAYMENTS: "",
      ENABLE_DEV_OTP_PREVIEW: "",
      COOKIE_SECURE: "",
      ENABLE_REQUEST_LOGS: "",
    });
    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parsed.S3_PUBLIC_ENDPOINT).toBeUndefined();
    expect(parsed.SMTP_WEBHOOK_URL).toBeUndefined();
    expect(parsed.SMS_WEBHOOK_URL).toBeUndefined();
    expect(parsed.PAYMENT_WEBHOOK_SECRET).toBeUndefined();
    expect(parsed.ALLOW_SIMULATED_PAYMENTS).toBeUndefined();
    expect(parsed.ENABLE_DEV_OTP_PREVIEW).toBeUndefined();
    expect(parsed.COOKIE_SECURE).toBeUndefined();
    expect(parsed.ENABLE_REQUEST_LOGS).toBe(false);
  });

  it("seeds verified Moroccan facilities inside all 6 Moroccan metro city presets", async () => {
    const moroccoPresets = [
      { city: "Casablanca", minLng: -7.694, minLat: 33.562, maxLng: -7.596, maxLat: 33.606 },
      { city: "Rabat", minLng: -6.885, minLat: 33.972, maxLng: -6.795, maxLat: 34.036 },
      { city: "Marrakech", minLng: -8.048, minLat: 31.602, maxLng: -7.958, maxLat: 31.662 },
      { city: "Tangier", minLng: -5.858, minLat: 35.742, maxLng: -5.768, maxLat: 35.798 },
      { city: "Fès", minLng: -5.048, minLat: 34.006, maxLng: -4.958, maxLat: 34.062 },
      { city: "Agadir", minLng: -9.642, minLat: 30.392, maxLng: -9.552, maxLat: 30.448 },
    ];

    for (const preset of moroccoPresets) {
      const res = await app.inject({
        method: "GET",
        url: `/v1/maps/facilities/viewport?countryCode=MA&minLng=${preset.minLng}&minLat=${preset.minLat}&maxLng=${preset.maxLng}&maxLat=${preset.maxLat}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ facilities: ViewportFacilityItem[] }>();
      expect(
        body.facilities.length,
        `Expected >=4 seeded facilities in ${preset.city}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("enforces doctor directory SQL filter parity with SELECT projections", async () => {
    const teleRes = await app.inject({
      method: "GET",
      url: "/v1/directory/doctors?countryCode=MA&telehealthOnly=true",
    });
    expect(teleRes.statusCode).toBe(200);
    const teleDocs = teleRes.json<DirectoryDoctorsResponse>().doctors;
    expect(teleDocs.length).toBeGreaterThanOrEqual(1);
    expect(teleDocs.every((d) => d.telehealthEnabled === true)).toBe(true);

    const homeRes = await app.inject({
      method: "GET",
      url: "/v1/directory/doctors?countryCode=MA&homeVisitOnly=true",
    });
    expect(homeRes.statusCode).toBe(200);
    const homeDocs = homeRes.json<DirectoryDoctorsResponse>().doctors;
    expect(homeDocs.length).toBeGreaterThanOrEqual(1);
    expect(homeDocs.every((d) => d.homeVisitEnabled === true)).toBe(true);
  });

  it("allows PHARMACIST and LAB_TECH to list scoped billing invoices and blocks oversized webhooks (413)", async () => {
    const pharmLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "pharmacist.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(pharmLogin.statusCode).toBe(200);
    const pharmAuth = pharmLogin.json<AuthResponse>();

    const labLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "lab.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(labLogin.statusCode).toBe(200);
    const labAuth = labLogin.json<AuthResponse>();

    const pharmInv = await app.inject({
      method: "GET",
      url: "/v1/billing/invoices?countryCode=MA",
      headers: { authorization: `Bearer ${pharmAuth.token}` },
    });
    expect(pharmInv.statusCode).toBe(200);

    const labInv = await app.inject({
      method: "GET",
      url: "/v1/billing/invoices?countryCode=MA",
      headers: { authorization: `Bearer ${labAuth.token}` },
    });
    expect(labInv.statusCode).toBe(200);

    // Oversized payment webhook (>1 MiB) rejected cleanly in preParsing with 413
    const oversizedPayload = JSON.stringify({
      blob: "x".repeat(1_100_000),
    });
    const webhookRes = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook",
      headers: { "content-type": "application/json" },
      payload: oversizedPayload,
    });
    expect(webhookRes.statusCode).toBe(413);
  });

  it("restores stock & busts cache on patient pending-order cancel, and cancels linked courier dispatch on pharmacist cancel", async () => {
    const pharmLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "pharmacist.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    const pharmAuth = pharmLogin.json<AuthResponse>();
    const patLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "patient.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    const patAuth = patLogin.json<AuthResponse>();

    const facId = pharmAuth.user.facilityId!;
    const createProd = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/products",
      headers: { authorization: `Bearer ${pharmAuth.token}` },
      payload: {
        facilityId: facId,
        sku: `MA-REG-${runSuffix}`,
        name: `Regression Thermometer ${runSuffix}`,
        genericName: "Digital Thermometer",
        category: "MEDICAL_DEVICE",
        dosageForm: "Unit",
        strength: "IR",
        requiresPrescription: false,
        priceMinor: 9500,
        stockQty: 10,
      },
    });
    expect(createProd.statusCode).toBe(201);
    const prod = createProd.json<PharmacyProductResponse>().product;
    createdProductIds.push(prod.id);

    // 1. Patient creates PENDING_PAYMENT order (stock 10 -> 8), warms cache, then self-cancels (stock 8 -> 10 immediately)
    const pendingOrdRes = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patAuth.token}` },
      payload: {
        facilityId: facId,
        items: [{ productId: prod.id, quantity: 2 }],
        fulfillmentMode: "PHARMACY_PICKUP",
      },
    });
    expect(pendingOrdRes.statusCode).toBe(201);
    const pendingOrder = pendingOrdRes.json<PharmacyOrderResponse>().order;
    createdOrderIds.push(pendingOrder.id);

    const warmCacheRes = await app.inject({
      method: "GET",
      url: `/v1/pharmacy/products?countryCode=MA&q=${encodeURIComponent(runSuffix)}`,
    });
    expect(warmCacheRes.json<PharmacyProductsResponse>().products[0]?.stockQty).toBe(8);

    const selfCancelRes = await app.inject({
      method: "PATCH",
      url: `/v1/pharmacy/orders/${pendingOrder.id}/status`,
      headers: { authorization: `Bearer ${patAuth.token}` },
      payload: { status: "CANCELLED" },
    });
    expect(selfCancelRes.statusCode).toBe(200);
    expect(selfCancelRes.json<PharmacyOrderResponse>().order.status).toBe("CANCELLED");

    const afterCancelRes = await app.inject({
      method: "GET",
      url: `/v1/pharmacy/products?countryCode=MA&q=${encodeURIComponent(runSuffix)}`,
    });
    expect(afterCancelRes.json<PharmacyProductsResponse>().products[0]?.stockQty).toBe(10);

    // 2. Paid COURIER_DELIVERY order cancelled by pharmacist cancels linked REQUESTED dispatch atomically
    const courierOrdRes = await app.inject({
      method: "POST",
      url: "/v1/pharmacy/orders",
      headers: { authorization: `Bearer ${patAuth.token}` },
      payload: {
        facilityId: facId,
        items: [{ productId: prod.id, quantity: 1 }],
        fulfillmentMode: "COURIER_DELIVERY",
        deliveryAddress: "14 Boulevard d'Anfa, Casablanca",
        deliveryLat: 33.591,
        deliveryLng: -7.638,
      },
    });
    expect(courierOrdRes.statusCode).toBe(201);
    const courierOrder = courierOrdRes.json<PharmacyOrderResponse>().order;
    createdOrderIds.push(courierOrder.id);

    const paidRes = await app.inject({
      method: "POST",
      url: `/v1/pharmacy/orders/${courierOrder.id}/confirm-payment`,
      headers: { authorization: `Bearer ${patAuth.token}` },
      payload: { paymentMethod: "CARD_SIMULATED" },
    });
    expect(paidRes.statusCode).toBe(200);
    const paidOrder = paidRes.json<PharmacyOrderResponse>().order;
    expect(paidOrder.dispatchRequestId).toBeTruthy();
    createdDispatchIds.push(paidOrder.dispatchRequestId!);

    const pharmCancelRes = await app.inject({
      method: "PATCH",
      url: `/v1/pharmacy/orders/${courierOrder.id}/status`,
      headers: { authorization: `Bearer ${pharmAuth.token}` },
      payload: { status: "CANCELLED" },
    });
    expect(pharmCancelRes.statusCode).toBe(200);

    const dispatchCheck = await pool.query<{ status: string }>(
      `SELECT status FROM dispatch_requests WHERE id = $1`,
      [paidOrder.dispatchRequestId],
    );
    expect(dispatchCheck.rows[0]?.status).toBe("CANCELLED");
  });

  it("blocks pending-approval staff tokens in SSE verifyLiveSessionToken consistently with HTTP guard", async () => {
    const regRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `pending-sse-${runSuffix}@medisync.test`,
        password: "StrongPassword!123",
        fullName: "Dr. Pending Verification",
        role: "DOCTOR",
        countryCode: "MA",
      },
    });
    expect(regRes.statusCode).toBe(201);
    const auth = regRes.json<AuthResponse>();
    createdUserIds.push(auth.user.id);

    const verdict = await verifyLiveSessionToken(
      auth.token,
      { authSecret: TEST_AUTH_SECRET, pool, redis },
      { requireVerifiedProvider: true },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.status).toBe(403);
      expect(verdict.error).toBe("PROVIDER_VERIFICATION_REQUIRED");
    }
  });

  it("treats blank env flags as undefined so COOKIE_SECURE & ALLOW_SIMULATED_PAYMENTS stay hardened in production", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevCookieSecure = process.env.COOKIE_SECURE;
    const prevSimPay = process.env.ALLOW_SIMULATED_PAYMENTS;
    try {
      process.env.NODE_ENV = "production";
      process.env.COOKIE_SECURE = "";
      process.env.ALLOW_SIMULATED_PAYMENTS = "   ";

      expect(readOptionalEnvBool("COOKIE_SECURE")).toBeUndefined();
      expect(readOptionalEnvBool("ALLOW_SIMULATED_PAYMENTS")).toBeUndefined();
      expect(isSimulatedCardAllowed()).toBe(false);

      let capturedOptions: { secure?: boolean } | undefined;
      const fakeReply = {
        setCookie(_name: string, _val: string, opts: { secure?: boolean }) {
          capturedOptions = opts;
        },
      };
      setSessionCookie(fakeReply as never, "tok");
      expect(capturedOptions?.secure).toBe(true);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevCookieSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = prevCookieSecure;
      if (prevSimPay === undefined) delete process.env.ALLOW_SIMULATED_PAYMENTS;
      else process.env.ALLOW_SIMULATED_PAYMENTS = prevSimPay;
    }
  });

  it("allows OPS_ADMIN (INTL) to create a dispatch targeting a verified Moroccan hospital under countryCode MA", async () => {
    const adminLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "ops.admin@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminAuth = adminLogin.json<AuthResponse>();

    const facRes = await app.inject({
      method: "GET",
      url: "/v1/directory/facilities?countryCode=MA&kind=HOSPITAL",
    });
    expect(facRes.statusCode).toBe(200);
    const maHospitalId = facRes.json<{ facilities: Array<{ id: string }> }>()
      .facilities[0]?.id;
    expect(maHospitalId).toBeTruthy();

    const dispatchRes = await app.inject({
      method: "POST",
      url: "/v1/dispatch/requests",
      headers: { authorization: `Bearer ${adminAuth.token}` },
      payload: {
        pickupLat: 33.584,
        pickupLng: -7.624,
        pickupAddress: `Boulevard Anfa Ops Test ${runSuffix}`,
        targetFacilityId: maHospitalId,
        urgency: "EMERGENCY",
      },
    });
    expect(dispatchRes.statusCode).toBe(201);
    const dispatch = dispatchRes.json<{ dispatch: DispatchRequestSummary }>().dispatch;
    createdDispatchIds.push(dispatch.id);
    expect(dispatch.countryCode).toBe("MA");
    expect(dispatch.targetFacilityId).toBe(maHospitalId);
  });

  it("seeds doctors, nurses, live-pinged drivers, and weekday slots across all 6 Moroccan metro cities", async () => {
    const expectedCities = [
      { city: "Casablanca", lat: 33.584, lng: -7.624 },
      { city: "Rabat", lat: 34.001, lng: -6.847 },
      { city: "Marrakech", lat: 31.636, lng: -8.008 },
      { city: "Tangier", lat: 35.768, lng: -5.814 },
      { city: "Fès", lat: 34.028, lng: -5.001 },
      { city: "Agadir", lat: 30.418, lng: -9.596 },
    ];

    const [docsRes, driversRes, patientLogin] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/v1/directory/doctors?countryCode=MA&limit=100",
      }),
      app.inject({
        method: "GET",
        url: "/v1/directory/drivers?countryCode=MA&limit=100",
      }),
      app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: "patient.ma@medisync.global",
          password: SEEDED_DEMO_PASSWORD,
        },
      }),
    ]);

    expect(docsRes.statusCode).toBe(200);
    expect(driversRes.statusCode).toBe(200);
    expect(patientLogin.statusCode).toBe(200);

    const maPractitioners = docsRes.json<DirectoryDoctorsResponse>().doctors;
    const maDrivers = driversRes.json<{
      drivers: Array<{
        id: string;
        facilityCity?: string | null;
        liveStatus: string | null;
      }>;
    }>().drivers;
    const patientToken = patientLogin.json<AuthResponse>().token;

    for (const target of expectedCities) {
      const cityDoctors = maPractitioners.filter(
        (d) => d.role === "DOCTOR" && d.facilityCity === target.city,
      );
      const cityNurses = maPractitioners.filter(
        (d) => d.role === "NURSE" && d.facilityCity === target.city,
      );
      const cityDrivers = maDrivers.filter(
        (drv) => drv.facilityCity === target.city && drv.liveStatus === "AVAILABLE",
      );

      expect(
        cityDoctors.length,
        `Expected verified doctor in ${target.city}`,
      ).toBeGreaterThanOrEqual(1);
      expect(
        cityNurses.length,
        `Expected verified nurse in ${target.city}`,
      ).toBeGreaterThanOrEqual(1);
      expect(
        cityDrivers.length,
        `Expected AVAILABLE ambulance driver in ${target.city}`,
      ).toBeGreaterThanOrEqual(1);

      const nearbyRes = await app.inject({
        method: "GET",
        url: `/v1/dispatch/drivers/nearby?countryCode=MA&lat=${target.lat}&lng=${target.lng}&radiusKm=25`,
        headers: { authorization: `Bearer ${patientToken}` },
      });
      expect(nearbyRes.statusCode).toBe(200);
      const nearby = nearbyRes.json<{ drivers: Array<{ driverId: string }> }>()
        .drivers;
      expect(
        nearby.length,
        `Expected live Redis Geo driver ping near ${target.city}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("supports accent-insensitive & bilingual Moroccan city search and authoritative city filtering with zero cross-city leakage", async () => {
    const [fesDocsRes, fesFacsRes, tangerDocsRes, rabatFacsRes] =
      await Promise.all([
        app.inject({
          method: "GET",
          url: "/v1/directory/doctors?countryCode=MA&q=Fes&limit=100",
        }),
        app.inject({
          method: "GET",
          url: "/v1/directory/facilities?countryCode=MA&q=Fes&limit=100",
        }),
        app.inject({
          method: "GET",
          url: "/v1/directory/doctors?countryCode=MA&q=Tanger&limit=100",
        }),
        app.inject({
          method: "GET",
          url: "/v1/directory/facilities?countryCode=MA&city=Rabat&limit=100",
        }),
      ]);

    expect(fesDocsRes.statusCode).toBe(200);
    expect(fesFacsRes.statusCode).toBe(200);
    expect(tangerDocsRes.statusCode).toBe(200);
    expect(rabatFacsRes.statusCode).toBe(200);

    const fesDocs = fesDocsRes.json<DirectoryDoctorsResponse>().doctors;
    expect(fesDocs.some((d) => d.fullName === "Dr. Zineb Lahlou")).toBe(true);
    expect(fesDocs.some((d) => d.fullName === "Hamza Squalli")).toBe(true);

    const fesFacs = fesFacsRes.json<{
      facilities: Array<{ city?: string | null; name: string }>;
    }>().facilities;
    expect(fesFacs.length).toBeGreaterThanOrEqual(4);

    const tangerDocs = tangerDocsRes.json<DirectoryDoctorsResponse>().doctors;
    expect(tangerDocs.some((d) => d.fullName === "Dr. Anas Bakkali")).toBe(true);
    expect(tangerDocs.some((d) => d.fullName === "Sanaa El Khattabi")).toBe(
      true,
    );

    // Structured ?city=Rabat must NOT leak Tangier's "Route de Rabat, Tanger" hospital
    const rabatFacs = rabatFacsRes.json<{
      facilities: Array<{ city?: string | null; name: string }>;
    }>().facilities;
    expect(rabatFacs.length).toBe(4);
    expect(rabatFacs.every((f) => f.city === "Rabat")).toBe(true);
  });

  it("rejects placeholder & dev secrets in NODE_ENV=production and sends valid SigV4 PutBucketCors requests", async () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://medisync:CHANGE_ME_STRONG_DB_PASSWORD@postgres:5432/medisync",
        REDIS_URL: DEFAULT_TEST_REDIS_URL,
        AUTH_SECRET: "CHANGE_ME_MINIMUM_32_CHARS_HIGH_ENTROPY_SECRET",
      }),
    ).toThrow(/placeholder|dev credential/i);

    // Default dev DB/S3 credentials must also be rejected when NODE_ENV=production
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        DATABASE_URL: DEFAULT_TEST_DB_URL,
        REDIS_URL: DEFAULT_TEST_REDIS_URL,
        AUTH_SECRET: TEST_AUTH_SECRET,
      }),
    ).toThrow(/placeholder|dev credential/i);

    const xml = buildS3CorsXml([
      "https://app.medisync.ma/",
      "https://app.medisync.ma",
    ]);
    expect(xml).toContain("<AllowedOrigin>https://app.medisync.ma</AllowedOrigin>");
    expect(xml).toContain("<AllowedMethod>PUT</AllowedMethod>");
    expect(xml).toContain("<ExposeHeader>ETag</ExposeHeader>");
    expect(xml.match(/<AllowedOrigin>/g)?.length).toBe(1);

    // Verify signed PutBucketCors request against a real local HTTP listener (method, query, SigV4, Content-MD5, XML)
    let captured: {
      method: string | undefined;
      url: string | undefined;
      authorization: string | undefined;
      contentMd5: string | undefined;
      contentSha256: string | undefined;
      body: Buffer;
    } | null = null;
    let responseStatus = 200;

    const mockS3 = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        captured = {
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization,
          contentMd5: req.headers["content-md5"] as string | undefined,
          contentSha256: req.headers["x-amz-content-sha256"] as
            | string
            | undefined,
          body: Buffer.concat(chunks),
        };
        res.statusCode = responseStatus;
        res.end();
      });
    });

    await new Promise<void>((resolve) => mockS3.listen(0, "127.0.0.1", resolve));
    const addr = mockS3.address() as AddressInfo;
    const mockConfig = {
      ...DEFAULT_DEV_S3_CONFIG,
      endpoint: `http://127.0.0.1:${addr.port}`,
      bucket: "medisync-prod-bucket",
      region: "eu-west-1",
    };

    try {
      const okResult = await ensureS3BucketCors(mockConfig, [
        "https://app.medisync.ma/",
      ]);
      expect(okResult).toBe(true);
      expect(captured).not.toBeNull();
      expect(captured!.method).toBe("PUT");
      expect(captured!.url).toBe("/medisync-prod-bucket?cors=");
      expect(captured!.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=[^/]+\/\d{8}\/eu-west-1\/s3\/aws4_request, SignedHeaders=.*content-md5.*, Signature=[a-f0-9]{64}$/,
      );
      expect(captured!.contentMd5).toBe(
        crypto.createHash("md5").update(captured!.body).digest("base64"),
      );
      expect(captured!.contentSha256).toBe(
        crypto.createHash("sha256").update(captured!.body).digest("hex"),
      );
      expect(captured!.body.toString("utf8")).toContain(
        "<AllowedOrigin>https://app.medisync.ma</AllowedOrigin>",
      );

      responseStatus = 403;
      const deniedResult = await ensureS3BucketCors(mockConfig, [
        "https://app.medisync.ma",
      ]);
      expect(deniedResult).toBe(false);
    } finally {
      await new Promise<void>((resolve) => mockS3.close(() => resolve()));
    }
  });
});
