import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  AdminAuditQuerySchema,
  AdminOverviewQuerySchema,
  AdminOverrideDispatchSchema,
  AdminUsersQuerySchema,
  CreateDisputeSchema,
  DisputeStatusSchema,
  ResolveDisputeSchema,
  UpdateUserRoleSchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import { publishDispatchUpdate } from "../maps-dispatch/index.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  AdminBadRequestError,
  AdminConflictError,
  AdminForbiddenError,
  AdminNotFoundError,
  createDispute,
  getAdminOverview,
  listAuditEventsFiltered,
  listDisputesScoped,
  listUsersAdmin,
  overrideDispatchAdmin,
  resolveDisputeAdmin,
  updateUserRoleAdmin,
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
  },
): Promise<void> {
  app.get("/v1/admin/overview", async (request, reply) => {
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      ADMIN_OPS_VIEWER_ROLES,
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
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      ADMIN_OPS_VIEWER_ROLES,
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

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/users/:id/role",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        OPS_ADMIN_ONLY,
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
        );
        return { user };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/v1/admin/dispatches/:id/override",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        ADMIN_OPS_VIEWER_ROLES,
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
        await publishDispatchUpdate(deps.redis, dispatch);
        return { dispatch };
      } catch (err) {
        return handleAdminError(err, reply);
      }
    },
  );

  app.post("/v1/disputes", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
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
    const claims = authenticateRequest(request, reply, deps.authSecret);
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
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        ADMIN_OPS_VIEWER_ROLES,
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
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      ADMIN_OPS_VIEWER_ROLES,
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
