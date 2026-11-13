import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { AuthResponse, FacilitySummary } from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { hashPassword } from "./auth-crypto.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 1 foundation: postgis, auth, rbac & audit", () => {
  let pool: Pool;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseSuffix = String(
    Math.floor(100000 + crypto.randomInt(0, 899999)),
  );
  const testLicense = `MA-CLIN-${licenseSuffix}`;
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    pool = createDbPool(databaseUrl);
    await runMigrations(pool);

    app = await buildApiServer({
      databaseUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      pool,
      runDbMigrations: true,
    });
    await app.ready();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0 || createdFacilityIds.length > 0) {
      await pool.query(
        `DELETE FROM audit_logs
         WHERE actor_id = ANY($1::uuid[])
            OR resource_id = ANY($2::text[])`,
        [createdUserIds, createdFacilityIds],
      );
    }
    if (createdFacilityIds.length > 0) {
      await pool.query(
        "DELETE FROM facilities WHERE id = ANY($1::uuid[])",
        [createdFacilityIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    await app.close();
    await pool.end();
  });

  it("returns health status with live PostgreSQL connection and all 9 roles", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; db: boolean; rolesCount: number }>();
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
    expect(body.rolesCount).toBe(9);
  });

  it("lists country packs and validates facility license formats", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/country-packs",
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json<{ packs: Array<{ code: string }> }>();
    expect(listBody.packs.length).toBeGreaterThanOrEqual(4);

    const checkRes = await app.inject({
      method: "POST",
      url: "/v1/country-packs/validate-license",
      payload: { countryCode: "MA", licenseNumber: testLicense },
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json<{ valid: boolean }>().valid).toBe(true);
  });

  it("enforces registration boundaries, login/me, PostGIS facility onboarding, RBAC, and audit logs", async () => {
    // 1. Public self-registration rejects OPS_ADMIN privilege escalation
    const escalationRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `ops-reject-${runSuffix}@medisync.test`,
        password: "StrongPassword!123",
        fullName: "Rejected Admin",
        role: "OPS_ADMIN",
        countryCode: "MA",
      },
    });
    expect(escalationRes.statusCode).toBe(400);

    // 2. Register Doctor in MA + Patient in MA + Patient in FR
    const doctorEmail = `doc-${runSuffix}@medisync.test`;
    const patientMaEmail = `pat-ma-${runSuffix}@medisync.test`;
    const patientFrEmail = `pat-fr-${runSuffix}@medisync.test`;
    const password = "StrongPassword!123";

    const docRegRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: doctorEmail,
        password,
        fullName: "Dr. Karim Tazi",
        role: "DOCTOR",
        countryCode: "MA",
      },
    });
    expect(docRegRes.statusCode).toBe(201);
    const docAuth = docRegRes.json<AuthResponse>();
    createdUserIds.push(docAuth.user.id);
    expect(docAuth.user.role).toBe("DOCTOR");
    expect(docAuth.user.countryCode).toBe("MA");

    // Duplicate email rejected with 409
    const dupRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: doctorEmail,
        password,
        fullName: "Dr. Karim Tazi",
        role: "DOCTOR",
        countryCode: "MA",
      },
    });
    expect(dupRes.statusCode).toBe(409);

    const patMaReg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: patientMaEmail,
        password,
        fullName: "Nadia El Fassi",
        role: "PATIENT",
        countryCode: "MA",
      },
    });
    expect(patMaReg.statusCode).toBe(201);
    const patMaAuth = patMaReg.json<AuthResponse>();
    createdUserIds.push(patMaAuth.user.id);

    const patFrReg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: patientFrEmail,
        password,
        fullName: "Claire Moreau",
        role: "PATIENT",
        countryCode: "FR",
      },
    });
    expect(patFrReg.statusCode).toBe(201);
    const patFrAuth = patFrReg.json<AuthResponse>();
    createdUserIds.push(patFrAuth.user.id);

    // 3. Login + /v1/auth/me check + bad password 401
    const badLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: doctorEmail, password: "WrongPassword!1" },
    });
    expect(badLogin.statusCode).toBe(401);

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: doctorEmail, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const loggedIn = loginRes.json<AuthResponse>();

    const meUnauth = await app.inject({ method: "GET", url: "/v1/auth/me" });
    expect(meUnauth.statusCode).toBe(401);

    const meRes = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${loggedIn.token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json<{ user: AuthResponse["user"] }>().user.id).toBe(
      docAuth.user.id,
    );

    // 4. Facility onboarding RBAC, cross-country block, and jurisdiction license validation
    const patientCreateRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${patMaAuth.token}` },
      payload: {
        name: "Unauthorized Clinic",
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: testLicense,
        lat: 33.5731,
        lng: -7.5898,
        address: "Casablanca",
      },
    });
    expect(patientCreateRes.statusCode).toBe(403);

    const crossCountryRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${docAuth.token}` },
      payload: {
        name: "Cross Border Clinic",
        kind: "CLINIC",
        countryCode: "FR",
        licenseNumber: "FR-123456789",
        lat: 48.8566,
        lng: 2.3522,
        address: "Paris",
      },
    });
    expect(crossCountryRes.statusCode).toBe(403);

    const badLicenseRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${docAuth.token}` },
      payload: {
        name: "Invalid License Clinic",
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: "BADFORMAT",
        lat: 33.5731,
        lng: -7.5898,
        address: "18 Boulevard d'Anfa, Casablanca",
      },
    });
    expect(badLicenseRes.statusCode).toBe(422);

    const createFacilityRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${docAuth.token}` },
      payload: {
        name: "Clinique Atlas Casablanca",
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: testLicense,
        lat: 33.5731,
        lng: -7.5898,
        address: "18 Boulevard d'Anfa, Casablanca",
      },
    });
    expect(createFacilityRes.statusCode).toBe(201);
    const { facility } = createFacilityRes.json<{ facility: FacilitySummary }>();
    createdFacilityIds.push(facility.id);
    expect(facility.verificationStatus).toBe("PENDING_REVIEW");

    // Duplicate country+license rejected 409
    const dupFacilityRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${docAuth.token}` },
      payload: {
        name: "Duplicate License Clinic",
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: testLicense,
        lat: 33.5731,
        lng: -7.5898,
        address: "Casablanca",
      },
    });
    expect(dupFacilityRes.statusCode).toBe(409);

    // 5. Pending facility visible to owner, hidden from other MA patient
    const docListRes = await app.inject({
      method: "GET",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${docAuth.token}` },
    });
    expect(docListRes.statusCode).toBe(200);
    expect(
      docListRes
        .json<{ facilities: FacilitySummary[] }>()
        .facilities.some((f) => f.id === facility.id),
    ).toBe(true);

    const patListBeforeVerify = await app.inject({
      method: "GET",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${patMaAuth.token}` },
    });
    expect(patListBeforeVerify.statusCode).toBe(200);
    expect(
      patListBeforeVerify
        .json<{ facilities: FacilitySummary[] }>()
        .facilities.some((f) => f.id === facility.id),
    ).toBe(false);

    // 6. Non-admin cannot verify facilities or read audit logs
    const nonAdminVerify = await app.inject({
      method: "PATCH",
      url: `/v1/admin/facilities/${facility.id}/verify`,
      headers: { authorization: `Bearer ${docAuth.token}` },
      payload: { status: "VERIFIED" },
    });
    expect(nonAdminVerify.statusCode).toBe(403);

    const nonAdminAudit = await app.inject({
      method: "GET",
      url: "/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${docAuth.token}` },
    });
    expect(nonAdminAudit.statusCode).toBe(403);

    // 7. Seed OPS_ADMIN directly in DB, log in, verify facility, check visibility + audit logs
    const opsEmail = `ops-${runSuffix}@medisync.test`;
    const opsHash = await hashPassword(password);
    const opsInsert = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code)
       VALUES ($1, $2, $3, 'OPS_ADMIN', 'INTL')
       RETURNING id`,
      [opsEmail, opsHash, "Global Ops Admin"],
    );
    createdUserIds.push(opsInsert.rows[0]!.id);

    const opsLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: opsEmail, password },
    });
    expect(opsLogin.statusCode).toBe(200);
    const opsAuth = opsLogin.json<AuthResponse>();

    const verifyRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/facilities/${facility.id}/verify`,
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: {
        status: "VERIFIED",
        note: "Ministry license checked",
      },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(
      verifyRes.json<{ facility: FacilitySummary }>().facility.verificationStatus,
    ).toBe("VERIFIED");

    // MA patient now sees verified MA facility; FR patient still isolated
    const patMaAfterVerify = await app.inject({
      method: "GET",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${patMaAuth.token}` },
    });
    expect(
      patMaAfterVerify
        .json<{ facilities: FacilitySummary[] }>()
        .facilities.some((f) => f.id === facility.id),
    ).toBe(true);

    const patFrList = await app.inject({
      method: "GET",
      url: "/v1/facilities?countryCode=MA",
      headers: { authorization: `Bearer ${patFrAuth.token}` },
    });
    expect(
      patFrList
        .json<{ facilities: FacilitySummary[] }>()
        .facilities.some((f) => f.id === facility.id),
    ).toBe(false);

    // Audit trail contains facility lifecycle actions
    const auditRes = await app.inject({
      method: "GET",
      url: "/v1/admin/audit-logs?countryCode=MA&limit=20",
      headers: { authorization: `Bearer ${opsAuth.token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const actions = auditRes
      .json<{ logs: Array<{ action: string; resourceId: string }> }>()
      .logs.filter((log) => log.resourceId === facility.id || createdUserIds.includes(log.resourceId))
      .map((log) => log.action);

    expect(actions).toContain("USER_REGISTERED");
    expect(actions).toContain("USER_LOGIN");
    expect(actions).toContain("FACILITY_CREATED");
    expect(actions).toContain("FACILITY_VERIFICATION_UPDATED");
  });
});
