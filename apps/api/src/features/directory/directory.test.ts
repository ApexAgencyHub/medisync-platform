import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  DemoPersonasResponse,
  DirectoryDoctorsResponse,
  DirectoryDriversResponse,
  DirectoryFacilitiesResponse,
  DirectoryPatientsResponse,
  PrescriptionsListResponse,
  VerifyPrescriptionQrResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import { SEEDED_DEMO_PASSWORD } from "./pg-store.js";
import { seedRealisticWorld } from "./seed-world.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 7 directory & world seed: pickers, RBAC country isolation & idempotent seeding", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];

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
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("seeds multi-country facilities/personas idempotently and enforces RBAC + country scoping on pickers", async () => {
    // Verify second seed call is idempotent without duplicating schedules or throwing
    const secondSeed = await seedRealisticWorld(pool, redis, TEST_AUTH_SECRET);
    expect(secondSeed.facilitiesSeeded).toBeGreaterThanOrEqual(16);
    expect(secondSeed.schedulesSeeded).toBe(0);

    // 1. Public Facilities & Doctors pickers filter cleanly by CountryPack and search text
    const maPharmRes = await app.inject({
      method: "GET",
      url: "/v1/directory/facilities?countryCode=MA&kind=PHARMACY",
    });
    expect(maPharmRes.statusCode).toBe(200);
    const maPharmBody = maPharmRes.json<DirectoryFacilitiesResponse>();
    expect(
      maPharmBody.facilities.some((f) => f.name.includes("Maarif")),
    ).toBe(true);
    expect(maPharmBody.facilities.every((f) => f.countryCode === "MA")).toBe(
      true,
    );

    const maDocsRes = await app.inject({
      method: "GET",
      url: "/v1/directory/doctors?countryCode=MA&q=Cardio",
    });
    expect(maDocsRes.statusCode).toBe(200);
    const maDocsBody = maDocsRes.json<DirectoryDoctorsResponse>();
    expect(maDocsBody.doctors.length).toBeGreaterThanOrEqual(1);
    expect(
      maDocsBody.doctors.some((d) => /Cardiology/i.test(d.specialty)),
    ).toBe(true);

    const maNursesRes = await app.inject({
      method: "GET",
      url: "/v1/directory/doctors?countryCode=MA&q=Nursing",
    });
    expect(maNursesRes.statusCode).toBe(200);
    const maNursesBody = maNursesRes.json<DirectoryDoctorsResponse>();
    expect(
      maNursesBody.doctors.some(
        (d) =>
          d.email === "nurse.ma@medisync.global" &&
          /Infirmiers/i.test(d.specialty),
      ),
    ).toBe(true);

    const maDriversRes = await app.inject({
      method: "GET",
      url: "/v1/directory/drivers?countryCode=MA",
    });
    expect(maDriversRes.statusCode).toBe(200);
    const maDriversBody = maDriversRes.json<DirectoryDriversResponse>();
    expect(
      maDriversBody.drivers.some(
        (drv) =>
          drv.email === "driver.ma@medisync.global" &&
          drv.vehicleType === "AMBULANCE" &&
          drv.liveStatus === "AVAILABLE",
      ),
    ).toBe(true);
    expect(
      maDriversBody.drivers.some(
        (drv) =>
          drv.email === "courier.ma@medisync.global" &&
          drv.vehicleType === "MEDICAL_SHUTTLE" &&
          drv.liveStatus === "AVAILABLE",
      ),
    ).toBe(true);

    // 2. Demo personas endpoint & sign-in verification
    const personasRes = await app.inject({
      method: "GET",
      url: "/v1/directory/demo-personas",
    });
    expect(personasRes.statusCode).toBe(200);
    const personasBody = personasRes.json<DemoPersonasResponse>();
    expect(personasBody.personas.length).toBeGreaterThanOrEqual(8);

    const docLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "doctor.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(docLoginRes.statusCode).toBe(200);
    const docMa = docLoginRes.json<AuthResponse>();

    // Register ephemeral driver to test 403 block on patient directory
    const drvRegRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `drv-dir-${runSuffix}@medisync.test`,
        password: "StrongPassword!123",
        fullName: "Test Driver",
        role: "DRIVER",
        countryCode: "MA",
      },
    });
    expect(drvRegRes.statusCode).toBe(201);
    const drvAuth = drvRegRes.json<AuthResponse>();
    createdUserIds.push(drvAuth.user.id);

    // 3. Patient Picker RBAC & Strict Country Isolation
    const unauthPat = await app.inject({
      method: "GET",
      url: "/v1/directory/patients",
    });
    expect(unauthPat.statusCode).toBe(401);

    const drvPat = await app.inject({
      method: "GET",
      url: "/v1/directory/patients",
      headers: { authorization: `Bearer ${drvAuth.token}` },
    });
    expect(drvPat.statusCode).toBe(403);

    const docPat = await app.inject({
      method: "GET",
      url: "/v1/directory/patients?q=Amrani&countryCode=INTL",
      headers: { authorization: `Bearer ${docMa.token}` },
    });
    expect(docPat.statusCode).toBe(200);
    const docPatBody = docPat.json<DirectoryPatientsResponse>();
    expect(docPatBody.patients.length).toBeGreaterThanOrEqual(1);
    // Country isolation overrides requested INTL back to actor country MA
    expect(docPatBody.patients.every((p) => p.countryCode === "MA")).toBe(true);
    expect(
      docPatBody.patients.some((p) => p.email === "patient.ma@medisync.global"),
    ).toBe(true);

    // 4. Verify seeded HMAC QR prescription verifies cleanly for seeded MA pharmacist
    const patLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "patient.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(patLoginRes.statusCode).toBe(200);
    const patMa = patLoginRes.json<AuthResponse>();

    const rxListRes = await app.inject({
      method: "GET",
      url: "/v1/clinical/prescriptions?countryCode=MA",
      headers: { authorization: `Bearer ${patMa.token}` },
    });
    expect(rxListRes.statusCode).toBe(200);
    const rxList = rxListRes.json<PrescriptionsListResponse>();
    expect(rxList.prescriptions.length).toBeGreaterThanOrEqual(1);

    const pharmLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "pharmacist.ma@medisync.global",
        password: SEEDED_DEMO_PASSWORD,
      },
    });
    expect(pharmLoginRes.statusCode).toBe(200);
    const pharmMa = pharmLoginRes.json<AuthResponse>();

    const seededRx =
      rxList.prescriptions.find((p) =>
        p.notes?.includes("Seeded initial e-prescription"),
      ) ?? rxList.prescriptions[0]!;
    const verifyQrRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions/verify-qr",
      headers: { authorization: `Bearer ${pharmMa.token}` },
      payload: { qrToken: seededRx.qrToken },
    });
    expect(verifyQrRes.statusCode).toBe(200);
    const verified = verifyQrRes.json<VerifyPrescriptionQrResponse>();
    expect(verified.prescription.countryCode).toBe("MA");
  });
});
