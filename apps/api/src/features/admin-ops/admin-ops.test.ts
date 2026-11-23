import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AdminAuditListResponse,
  AdminOverviewResponse,
  AdminUserResponse,
  AdminUsersListResponse,
  AuthResponse,
  DispatchRequestSummary,
  DisputeResponse,
  DisputesListResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { hashPassword } from "../foundation/index.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 5 admin-ops: governance, RBAC, dispatch overrides, disputes & audit", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];
  const createdDispatchIds: string[] = [];
  const createdDisputeIds: string[] = [];

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
    if (createdDisputeIds.length > 0) {
      await pool.query(
        "DELETE FROM platform_disputes WHERE id = ANY($1::uuid[])",
        [createdDisputeIds],
      );
    }
    if (createdDispatchIds.length > 0) {
      await pool.query(
        "DELETE FROM dispatch_requests WHERE id = ANY($1::uuid[])",
        [createdDispatchIds],
      );
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

  async function seedPrivilegedUser(
    role: "OPS_ADMIN" | "HOSPITAL_ADMIN",
    countryCode: string,
    label: string,
  ): Promise<AuthResponse> {
    const email = `s5-${label}-${runSuffix}@medisync.test`;
    const password = "StrongPassword!123";
    const passwordHash = await hashPassword(password);
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [email, passwordHash, `Slice5 ${label}`, role, countryCode],
    );
    const userId = inserted.rows[0]?.id;
    expect(userId).toBeTruthy();
    if (userId) createdUserIds.push(userId);

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    return loginRes.json() as AuthResponse;
  }

  async function registerUser(
    role: string,
    countryCode: string,
    label: string,
  ): Promise<AuthResponse> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `s5-${label}-${runSuffix}@medisync.test`,
        password: "StrongPassword!123",
        fullName: `Slice5 ${label}`,
        role,
        countryCode,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as AuthResponse;
    createdUserIds.push(body.user.id);
    return body;
  }

  it("enforces country isolation on admin overview, prevents OPS_ADMIN self-demotion, overrides dispatches, and resolves disputes with immutable audit trails", async () => {
    const opsAdmin = await seedPrivilegedUser("OPS_ADMIN", "MA", "ops");
    const maHospitalAdmin = await seedPrivilegedUser(
      "HOSPITAL_ADMIN",
      "MA",
      "hosp-ma",
    );
    const usHospitalAdmin = await seedPrivilegedUser(
      "HOSPITAL_ADMIN",
      "US",
      "hosp-us",
    );
    const patient = await registerUser("PATIENT", "MA", "patient");
    const driverMa = await registerUser("DRIVER", "MA", "driver-ma");
    const driverUs = await registerUser("DRIVER", "US", "driver-us");

    // 1. Overview RBAC & Country scoping
    const patientOverviewRes = await app.inject({
      method: "GET",
      url: "/v1/admin/overview",
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(patientOverviewRes.statusCode).toBe(403);

    const crossCountryOverviewRes = await app.inject({
      method: "GET",
      url: "/v1/admin/overview?countryCode=US",
      headers: { authorization: `Bearer ${maHospitalAdmin.token}` },
    });
    expect(crossCountryOverviewRes.statusCode).toBe(403);

    const maOverviewRes = await app.inject({
      method: "GET",
      url: "/v1/admin/overview",
      headers: { authorization: `Bearer ${maHospitalAdmin.token}` },
    });
    expect(maOverviewRes.statusCode).toBe(200);
    const maOverview = maOverviewRes.json() as AdminOverviewResponse;
    expect(maOverview.overview.countryCode).toBe("MA");
    expect(maOverview.overview.totalUsers).toBeGreaterThanOrEqual(4);

    // 2. Users listing + Self-demotion guard + Role update
    const usersRes = await app.inject({
      method: "GET",
      url: "/v1/admin/users?countryCode=MA",
      headers: { authorization: `Bearer ${opsAdmin.token}` },
    });
    expect(usersRes.statusCode).toBe(200);
    const usersBody = usersRes.json() as AdminUsersListResponse;
    expect(usersBody.users.some((u) => u.id === patient.user.id)).toBe(true);

    const selfDemoteRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${opsAdmin.user.id}/role`,
      headers: { authorization: `Bearer ${opsAdmin.token}` },
      payload: { role: "PATIENT", reason: "Accidental click" },
    });
    expect(selfDemoteRes.statusCode).toBe(409);

    const hospRoleUpdateRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${patient.user.id}/role`,
      headers: { authorization: `Bearer ${maHospitalAdmin.token}` },
      payload: { role: "DOCTOR" },
    });
    expect(hospRoleUpdateRes.statusCode).toBe(403);

    const roleUpdateRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${driverUs.user.id}/role`,
      headers: { authorization: `Bearer ${opsAdmin.token}` },
      payload: {
        role: "CLINIC_STAFF",
        countryCode: "GB",
        reason: "Reassigned to UK clinic desk",
      },
    });
    expect(roleUpdateRes.statusCode).toBe(200);
    const updatedUserBody = roleUpdateRes.json() as AdminUserResponse;
    expect(updatedUserBody.user.role).toBe("CLINIC_STAFF");
    expect(updatedUserBody.user.countryCode).toBe("GB");

    // 3. Dispatch Creation + Admin Override validation & SSE publish
    const createDispatchRes = await app.inject({
      method: "POST",
      url: "/v1/dispatch/requests",
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        pickupLat: 33.5731,
        pickupLng: -7.5898,
        pickupAddress: "Boulevard Anfa, Casablanca",
        urgency: "EMERGENCY",
        notes: "Patient needs rapid ambulance dispatch",
      },
    });
    expect(createDispatchRes.statusCode).toBe(201);
    const dispatchBody = createDispatchRes.json() as {
      dispatch: DispatchRequestSummary;
    };
    createdDispatchIds.push(dispatchBody.dispatch.id);

    const invalidOverrideRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/dispatches/${dispatchBody.dispatch.id}/override`,
      headers: { authorization: `Bearer ${opsAdmin.token}` },
      payload: {
        status: "ASSIGNED",
        driverUserId: patient.user.id,
        note: "Attempt assigning non-driver",
      },
    });
    expect(invalidOverrideRes.statusCode).toBe(422);

    const overrideRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/dispatches/${dispatchBody.dispatch.id}/override`,
      headers: { authorization: `Bearer ${opsAdmin.token}` },
      payload: {
        status: "ASSIGNED",
        driverUserId: driverMa.user.id,
        note: "Escalated directly by central command",
      },
    });
    expect(overrideRes.statusCode).toBe(200);
    const overriddenDispatch = overrideRes.json() as {
      dispatch: DispatchRequestSummary;
    };
    expect(overriddenDispatch.dispatch.status).toBe("ASSIGNED");
    expect(overriddenDispatch.dispatch.driverUserId).toBe(driverMa.user.id);
    expect(overriddenDispatch.dispatch.notes).toContain("ADMIN OVERRIDE");

    // 4. Disputes creation, scoped visibility, cross-country lock & resolution
    const createDisputeRes = await app.inject({
      method: "POST",
      url: "/v1/disputes",
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        category: "DISPATCH_DELAY",
        subject: "Delayed ambulance response",
        description: "Ambulance ETA exceeded 20 minutes during peak traffic.",
        targetResourceId: dispatchBody.dispatch.id,
      },
    });
    expect(createDisputeRes.statusCode).toBe(201);
    const createdDispute = createDisputeRes.json() as DisputeResponse;
    createdDisputeIds.push(createdDispute.dispute.id);
    expect(createdDispute.dispute.status).toBe("OPEN");

    const patientDisputesRes = await app.inject({
      method: "GET",
      url: "/v1/disputes",
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(patientDisputesRes.statusCode).toBe(200);
    const patientDisputes = patientDisputesRes.json() as DisputesListResponse;
    expect(
      patientDisputes.disputes.every((d) => d.reporterUserId === patient.user.id),
    ).toBe(true);

    const usResolveMaRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/disputes/${createdDispute.dispute.id}`,
      headers: { authorization: `Bearer ${usHospitalAdmin.token}` },
      payload: {
        status: "RESOLVED",
        resolutionNote: "Cross-border attempt",
      },
    });
    expect(usResolveMaRes.statusCode).toBe(403);

    const resolveMaRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/disputes/${createdDispute.dispute.id}`,
      headers: { authorization: `Bearer ${maHospitalAdmin.token}` },
      payload: {
        status: "RESOLVED",
        resolutionNote: "Driver reassigned and SLA credit issued.",
      },
    });
    expect(resolveMaRes.statusCode).toBe(200);
    const resolvedDispute = resolveMaRes.json() as DisputeResponse;
    expect(resolvedDispute.dispute.status).toBe("RESOLVED");
    expect(resolvedDispute.dispute.resolvedByUserId).toBe(maHospitalAdmin.user.id);

    // 5. Filtered audit event verification + pendingVerification query filter
    const auditRes = await app.inject({
      method: "GET",
      url: "/v1/admin/audit-events?countryCode=MA&action=ADMIN_DISPATCH_OVERRIDE",
      headers: { authorization: `Bearer ${opsAdmin.token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const auditBody = auditRes.json() as AdminAuditListResponse;
    expect(
      auditBody.logs.some(
        (log) =>
          log.action === "ADMIN_DISPATCH_OVERRIDE" &&
          log.resourceId === dispatchBody.dispatch.id &&
          log.metadata?.nextStatus === "ASSIGNED",
      ),
    ).toBe(true);

    const pendingUsersRes = await app.inject({
      method: "GET",
      url: "/v1/admin/users?countryCode=MA&pendingVerification=true",
      headers: { authorization: `Bearer ${opsAdmin.token}` },
    });
    expect(pendingUsersRes.statusCode).toBe(200);
    const pendingList = pendingUsersRes.json() as AdminUsersListResponse;
    expect(
      pendingList.users.every(
        (u) => u.accountStatus === "PENDING_APPROVAL" || !u.credentialVerified,
      ),
    ).toBe(true);
  });
});
