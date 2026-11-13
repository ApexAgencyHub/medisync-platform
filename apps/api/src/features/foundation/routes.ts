import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateFacilitySchema,
  FacilityListQuerySchema,
  LoginSchema,
  RegisterUserSchema,
  UserRoleSchema,
  VerifyFacilitySchema,
  type UserRole,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import {
  hashPassword,
  signAuthToken,
  verifyPassword,
} from "./auth-crypto.js";
import { authenticateRequest } from "./guard.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  DuplicateConflictError,
  findUserByEmail,
  findUserById,
  insertFacility,
  insertUser,
  listAuditLogs,
  listFacilitiesScoped,
  pingDatabase,
  updateFacilityVerification,
} from "./store.js";

const FACILITY_ONBOARDING_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

const FacilityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const AuditQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function registerFoundationRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; authSecret: string; s3Config?: S3PresignConfig },
): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const dbOk = await pingDatabase(deps.pool);
    if (!dbOk) {
      return reply.status(503).send({ status: "degraded", db: false });
    }
    return {
      status: "ok",
      service: "medisync-api",
      db: true,
      rolesCount: UserRoleSchema.options.length,
      timestamp: new Date().toISOString(),
    };
  });

  app.post("/v1/auth/register", async (request, reply) => {
    const parsed = RegisterUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await insertUser(deps.pool, parsed.data, passwordHash);

      await appendAuditLog(deps.pool, {
        countryCode: user.countryCode,
        actorId: user.id,
        actorRole: user.role,
        action: "USER_REGISTERED",
        resourceType: "user",
        resourceId: user.id,
      });

      const token = signAuthToken(user, deps.authSecret);
      return reply.status(201).send({ token, user });
    } catch (err) {
      if (err instanceof DuplicateConflictError) {
        return reply.status(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
      }
      throw err;
    }
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const stored = await findUserByEmail(
      deps.pool,
      parsed.data.email,
      deps.s3Config,
    );
    if (!stored) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const passwordMatches = await verifyPassword(
      parsed.data.password,
      stored.passwordHash,
    );
    if (!passwordMatches) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const user = {
      id: stored.id,
      email: stored.email,
      fullName: stored.fullName,
      role: stored.role,
      countryCode: stored.countryCode,
      facilityId: stored.facilityId,
      avatarUrl: stored.avatarUrl,
      emailVerified: stored.emailVerified,
      phone: stored.phone,
      phoneVerified: stored.phoneVerified,
      createdAtIso: stored.createdAtIso,
    };

    await appendAuditLog(deps.pool, {
      countryCode: user.countryCode,
      actorId: user.id,
      actorRole: user.role,
      action: "USER_LOGIN",
      resourceType: "user",
      resourceId: user.id,
    });

    const token = signAuthToken(user, deps.authSecret);
    return { token, user };
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const user = await findUserById(deps.pool, claims.sub, deps.s3Config);
    if (!user) {
      return reply.status(401).send({ error: "ACCOUNT_NOT_FOUND" });
    }
    return { user };
  });

  app.post("/v1/facilities", async (request, reply) => {
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      FACILITY_ONBOARDING_ROLES,
    );
    if (!claims) return;

    const parsed = CreateFacilitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    if (
      claims.role !== "OPS_ADMIN" &&
      parsed.data.countryCode !== claims.countryCode
    ) {
      return reply.status(403).send({ error: "CROSS_COUNTRY_FORBIDDEN" });
    }

    const licenseValid = validateFacilityLicense(
      parsed.data.countryCode,
      parsed.data.licenseNumber,
    );
    if (!licenseValid) {
      return reply.status(422).send({
        error: "INVALID_JURISDICTION_LICENSE",
        countryCode: parsed.data.countryCode,
      });
    }

    try {
      const facility = await insertFacility(
        deps.pool,
        parsed.data,
        claims.sub,
      );

      await appendAuditLog(deps.pool, {
        countryCode: facility.countryCode,
        actorId: claims.sub,
        actorRole: claims.role,
        action: "FACILITY_CREATED",
        resourceType: "facility",
        resourceId: facility.id,
        metadata: { kind: facility.kind, licenseNumber: facility.licenseNumber },
      });

      return reply.status(201).send({ facility });
    } catch (err) {
      if (err instanceof DuplicateConflictError) {
        return reply.status(409).send({ error: "DUPLICATE_FACILITY_LICENSE" });
      }
      throw err;
    }
  });

  app.get("/v1/facilities", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const parsed = FacilityListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const facilities = await listFacilitiesScoped(deps.pool, parsed.data, {
      userId: claims.sub,
      role: claims.role,
      countryCode: claims.countryCode,
    });
    return { facilities };
  });

  app.patch("/v1/admin/facilities/:id/verify", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret, [
      "OPS_ADMIN",
    ]);
    if (!claims) return;

    const paramParsed = FacilityIdParamSchema.safeParse(request.params);
    const bodyParsed = VerifyFacilitySchema.safeParse(request.body);
    if (!paramParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    const facility = await updateFacilityVerification(
      deps.pool,
      paramParsed.data.id,
      bodyParsed.data.status,
    );
    if (!facility) {
      return reply.status(404).send({ error: "FACILITY_NOT_FOUND" });
    }

    await appendAuditLog(deps.pool, {
      countryCode: facility.countryCode,
      actorId: claims.sub,
      actorRole: claims.role,
      action: "FACILITY_VERIFICATION_UPDATED",
      resourceType: "facility",
      resourceId: facility.id,
      metadata: {
        status: facility.verificationStatus,
        note: bodyParsed.data.note ?? null,
      },
    });

    return { facility };
  });

  app.get("/v1/admin/audit-logs", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret, [
      "OPS_ADMIN",
    ]);
    if (!claims) return;

    const parsed = AuditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    const logs = await listAuditLogs(deps.pool, {
      countryCode: parsed.data.countryCode,
      limit: parsed.data.limit,
    });
    return { logs };
  });
}
