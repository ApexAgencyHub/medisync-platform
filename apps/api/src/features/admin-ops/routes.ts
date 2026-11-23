import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  AdminAuditQuerySchema,
  AdminCreateUserSchema,
  AdminOverviewQuerySchema,
  AdminOverrideDispatchSchema,
  AdminUpdateUserStatusSchema,
  AdminUsersQuerySchema,
  CreateDisputeSchema,
  DisputeStatusSchema,
  ResolveDisputeSchema,
  UpdateUserRoleSchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import {
  clearDriverOffDuty,
  publishDispatchUpdate,
} from "../maps-dispatch/index.js";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  SCHEDULES_CACHE_GEN_KEY,
} from "../../shared/redis/cache.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  AdminBadRequestError,
  AdminConflictError,
  AdminForbiddenError,
  AdminNotFoundError,
  createDispute,
  createUserAdmin,
  getAdminOverview,
  listAuditEventsFiltered,
  listDisputesScoped,
  listUsersAdmin,
  overrideDispatchAdmin,
  resolveDisputeAdmin,
  updateUserRoleAdmin,
  updateUserStatusAdmin,
} from "./pg-store.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const DisputeListQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  status: DisputeStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ADMIN_OPS_VIEWER_ROLES: readonly UserRole[] = [
  "OPS_ADMIN",
  "HOSPITAL_ADMIN",
];

const OPS_ADMIN_ONLY: readonly UserRole[] = ["OPS_ADMIN"];

function handleAdminError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdminForbiddenError) {
    return reply.status(403).send({
      error: "ADMIN_FORBIDDEN",
      message: err.message,
    });
  }
  if (err instanceof AdminNotFoundError) {
    return reply.status(404).send({
      error: "ADMIN_RESOURCE_NOT_FOUND",
      message: err.message,
    });
  }
  if (err instanceof AdminConflictError) {
    return reply.status(409).send({
      error: err.code,
      message: err.message,
    });
  }
  if (err instanceof AdminBadRequestError) {
    return reply.status(422).send({
      error: "ADMIN_VALIDATION_ERROR",
      message: err.message,
    });
  }
  throw err;
}

export async function registerAdminOpsRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    requireProviderVerification?: boolean;
  },
): Promise<void> {
  const verifiedAdminOptions = {
    requireVerifiedProvider: Boolean(deps.requireProviderVerification),
  };

  app.get("/v1/admin/overview", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ADMIN_OPS_VIEWER_ROLES,
      verifiedAdminOptions,
    );
    if (!claims) return;

    const parsed = AdminOverviewQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_OVERVIEW_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const overview = await getAdminOverview(deps.pool, claims, parsed.data);
      return { overview };
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });

  app.get("/v1/admin/users", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ADMIN_OPS_VIEWER_ROLES,
      verifiedAdminOptions,
    );
    if (!claims) return;

    const parsed = AdminUsersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_ADMIN_USERS_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const users = await listUsersAdmin(
        deps.pool,
        claims,
        parsed.data,
        deps.s3Config,
      );
      return { users };
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });

  app.post("/v1/admin/users", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      OPS_ADMIN_ONLY,
      verifiedAdminOptions,
    );
    if (!claims) return;

    const body = AdminCreateUserSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: "INVALID_ADMIN_USER_PAYLOAD",
        issues: body.error.issues,
      });
    }

    try {
      const user = await createUserAdmin(
        deps.pool,
        claims,
        body.data,
      );
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      return reply.status(201).send({ user });
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/users/:id/role",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        OPS_ADMIN_ONLY,
        verifiedAdminOptions,
      );
      if (!claims) return;

      const params = UuidParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_USER_ID" });
      }

      const body = UpdateUserRoleSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "INVALID_ROLE_UPDATE_PAYLOAD",
          issues: body.error.issues,
        });
      }

      try {
        const user = await updateUserRoleAdmin(
          deps.pool,
          params.data.id,
          claims,
          body.data,
          deps.s3Config,
          deps.redis,
        );
        await Promise.all([
          bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY),
          bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY),
        ]);
        return { user };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/users/:id/status",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        OPS_ADMIN_ONLY,
        verifiedAdminOptions,
      );
      if (!claims) return;

      const params = UuidParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_USER_ID" });
      }

      const body = AdminUpdateUserStatusSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "INVALID_STATUS_UPDATE_PAYLOAD",
          issues: body.error.issues,
        });
      }

      try {
        const user = await updateUserStatusAdmin(
          deps.pool,
          params.data.id,
          claims,
          body.data,
          deps.s3Config,
          deps.redis,
        );
        await Promise.all([
          bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY),
          bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY),
        ]);
        return { user };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/dispatches/:id/override",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        ADMIN_OPS_VIEWER_ROLES,
        verifiedAdminOptions,
      );
      if (!claims) return;

      const params = UuidParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_DISPATCH_ID" });
      }

      const body = AdminOverrideDispatchSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "INVALID_DISPATCH_OVERRIDE_PAYLOAD",
          issues: body.error.issues,
        });
      }

      try {
        const dispatch = await overrideDispatchAdmin(
          deps.pool,
          params.data.id,
          claims,
          body.data,
        );
        if (
          dispatch.driverUserId &&
          (dispatch.status === "ASSIGNED" ||
            dispatch.status === "EN_ROUTE" ||
            dispatch.status === "ARRIVED")
        ) {
          await clearDriverOffDuty(deps.redis, dispatch.driverUserId).catch(
            () => undefined,
          );
        }
        await publishDispatchUpdate(deps.redis, dispatch);
        return { dispatch };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.post("/v1/disputes", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const body = CreateDisputeSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: "INVALID_DISPUTE_PAYLOAD",
        issues: body.error.issues,
      });
    }

    try {
      const dispute = await createDispute(deps.pool, claims, body.data);
      return reply.status(201).send({ dispute });
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });

  app.get("/v1/disputes", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = DisputeListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_DISPUTE_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const disputes = await listDisputesScoped(deps.pool, claims, parsed.data);
      return { disputes };
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/disputes/:id",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        ADMIN_OPS_VIEWER_ROLES,
        verifiedAdminOptions,
      );
      if (!claims) return;

      const params = UuidParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_DISPUTE_ID" });
      }

      const body = ResolveDisputeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "INVALID_DISPUTE_RESOLUTION_PAYLOAD",
          issues: body.error.issues,
        });
      }

      try {
        const dispute = await resolveDisputeAdmin(
          deps.pool,
          params.data.id,
          claims,
          body.data,
        );
        return { dispute };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.get("/v1/admin/audit-events", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ADMIN_OPS_VIEWER_ROLES,
      verifiedAdminOptions,
    );
    if (!claims) return;

    const parsed = AdminAuditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_AUDIT_EVENTS_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const logs = await listAuditEventsFiltered(
        deps.pool,
        claims,
        parsed.data,
      );
      return { logs };
    } catch (err) {
      return handleAdminError(err, reply);
    }
  });
}
