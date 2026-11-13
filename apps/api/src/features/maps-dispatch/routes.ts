import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateDispatchRequestSchema,
  DispatchListQuerySchema,
  DispatchStreamEventSchema,
  DriverPingInputSchema,
  FacilityViewportQuerySchema,
  NearbyDriversQuerySchema,
  TransitionDispatchStatusSchema,
  UpdateFacilityOperationalStatusSchema,
  type UserRole,
} from "@medisync/contracts";
import {
  appendAuditLog,
  authenticateRequest,
  verifyAuthToken,
} from "../foundation/index.js";
import {
  createDispatchRequest,
  DispatchConflictError,
  DispatchForbiddenError,
  DispatchNotFoundError,
  listDispatchRequestsScoped,
  queryFacilitiesInViewport,
  TargetFacilityInvalidError,
  transitionDispatchStatus,
  updateFacilityOperationalStatus,
} from "./pg-store.js";
import {
  dispatchPubSubChannel,
  findNearbyDrivers,
  publishDispatchUpdate,
  upsertDriverLocation,
} from "./redis-geo.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const StreamQuerySchema = z.object({
  token: z.string().min(1).optional(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
});

const FACILITY_MANAGER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

const DISPATCH_CREATOR_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

export async function registerMapsDispatchRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis: Redis;
    authSecret: string;
    corsOrigins: readonly string[];
  },
): Promise<void> {
  app.get("/v1/maps/facilities/viewport", async (request, reply) => {
    const parsed = FacilityViewportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_VIEWPORT_QUERY",
        issues: parsed.error.issues,
      });
    }

    return queryFacilitiesInViewport(deps.pool, parsed.data);
  });

  app.patch(
    "/v1/maps/facilities/:id/operational-status",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        FACILITY_MANAGER_ROLES,
      );
      if (!claims) return;

      const paramParsed = UuidParamSchema.safeParse(request.params);
      const bodyParsed = UpdateFacilityOperationalStatusSchema.safeParse(
        request.body,
      );
      if (!paramParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "INVALID_PAYLOAD" });
      }

      try {
        const facility = await updateFacilityOperationalStatus(
          deps.pool,
          paramParsed.data.id,
          {
            userId: claims.sub,
            role: claims.role,
            countryCode: claims.countryCode,
          },
          bodyParsed.data,
        );
        if (!facility) {
          return reply.status(404).send({ error: "FACILITY_NOT_FOUND" });
        }

        await appendAuditLog(deps.pool, {
          countryCode: facility.countryCode,
          actorId: claims.sub,
          actorRole: claims.role,
          action: "FACILITY_OPERATIONAL_STATUS_UPDATED",
          resourceType: "facility",
          resourceId: facility.id,
          metadata: { openStatus: facility.openStatus },
        });

        return { facility };
      } catch (err) {
        if (err instanceof DispatchForbiddenError) {
          return reply.status(403).send({ error: "FORBIDDEN_FACILITY_SCOPE" });
        }
        throw err;
      }
    },
  );

  app.post("/v1/dispatch/drivers/ping", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret, [
      "DRIVER",
    ]);
    if (!claims) return;

    const parsed = DriverPingInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_DRIVER_PING",
        issues: parsed.error.issues,
      });
    }

    const marker = await upsertDriverLocation(deps.redis, {
      driverId: claims.sub,
      countryCode: claims.countryCode,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      headingDeg: parsed.data.headingDeg,
      status: parsed.data.status,
    });

    return { driver: marker };
  });

  app.get("/v1/dispatch/drivers/nearby", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const parsed = NearbyDriversQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_NEARBY_QUERY",
        issues: parsed.error.issues,
      });
    }

    if (
      claims.role !== "OPS_ADMIN" &&
      parsed.data.countryCode &&
      parsed.data.countryCode !== claims.countryCode
    ) {
      return reply.status(403).send({ error: "CROSS_COUNTRY_FORBIDDEN" });
    }

    const targetCountry =
      claims.role === "OPS_ADMIN"
        ? (parsed.data.countryCode ?? claims.countryCode)
        : claims.countryCode;

    return findNearbyDrivers(deps.redis, {
      countryCode: targetCountry,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusKm: parsed.data.radiusKm,
      limit: parsed.data.limit,
    });
  });

  app.post("/v1/dispatch/requests", async (request, reply) => {
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      DISPATCH_CREATOR_ROLES,
    );
    if (!claims) return;

    const parsed = CreateDispatchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_DISPATCH_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const dispatch = await createDispatchRequest(
        deps.pool,
        claims.sub,
        claims.countryCode,
        parsed.data,
      );

      await appendAuditLog(deps.pool, {
        countryCode: dispatch.countryCode,
        actorId: claims.sub,
        actorRole: claims.role,
        action: "DISPATCH_REQUEST_CREATED",
        resourceType: "dispatch_request",
        resourceId: dispatch.id,
        metadata: { urgency: dispatch.urgency },
      });

      await publishDispatchUpdate(deps.redis, dispatch);
      return reply.status(201).send({ dispatch });
    } catch (err) {
      if (err instanceof TargetFacilityInvalidError) {
        return reply
          .status(422)
          .send({ error: "INVALID_OR_UNVERIFIED_TARGET_FACILITY" });
      }
      throw err;
    }
  });

  app.get("/v1/dispatch/requests", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const parsed = DispatchListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_DISPATCH_QUERY" });
    }

    const dispatches = await listDispatchRequestsScoped(deps.pool, parsed.data, {
      userId: claims.sub,
      role: claims.role,
      countryCode: claims.countryCode,
    });
    return { dispatches };
  });

  app.patch("/v1/dispatch/requests/:id/status", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const paramParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = TransitionDispatchStatusSchema.safeParse(request.body);
    if (!paramParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const dispatch = await transitionDispatchStatus(
        deps.pool,
        {
          userId: claims.sub,
          role: claims.role,
          countryCode: claims.countryCode,
        },
        paramParsed.data.id,
        bodyParsed.data.status,
        bodyParsed.data.driverUserId,
      );

      await appendAuditLog(deps.pool, {
        countryCode: dispatch.countryCode,
        actorId: claims.sub,
        actorRole: claims.role,
        action: "DISPATCH_STATUS_UPDATED",
        resourceType: "dispatch_request",
        resourceId: dispatch.id,
        metadata: {
          status: dispatch.status,
          driverUserId: dispatch.driverUserId,
        },
      });

      await publishDispatchUpdate(deps.redis, dispatch);
      return { dispatch };
    } catch (err) {
      if (err instanceof DispatchNotFoundError) {
        return reply.status(404).send({ error: "DISPATCH_NOT_FOUND" });
      }
      if (err instanceof DispatchForbiddenError) {
        return reply.status(403).send({ error: "FORBIDDEN_DISPATCH_ACTION" });
      }
      if (err instanceof DispatchConflictError) {
        return reply.status(409).send({ error: "DISPATCH_STATE_CONFLICT" });
      }
      throw err;
    }
  });

  app.get("/v1/dispatch/stream", async (request, reply) => {
    const queryParsed = StreamQuerySchema.safeParse(request.query);
    const headerAuth = request.headers.authorization;
    const rawToken =
      headerAuth && headerAuth.startsWith("Bearer ")
        ? headerAuth.slice("Bearer ".length).trim()
        : queryParsed.success
          ? queryParsed.data.token
          : undefined;

    if (!rawToken) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    const claims = verifyAuthToken(rawToken, deps.authSecret);
    if (!claims) {
      return reply.status(401).send({ error: "INVALID_OR_EXPIRED_TOKEN" });
    }

    const targetCountry =
      claims.role === "OPS_ADMIN" &&
      queryParsed.success &&
      queryParsed.data.countryCode
        ? queryParsed.data.countryCode
        : claims.countryCode;

    const origin = request.headers.origin;
    const corsHeaders: Record<string, string> = {};
    if (origin && deps.corsOrigins.includes(origin)) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders["Access-Control-Allow-Credentials"] = "true";
      corsHeaders.Vary = "Origin";
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders,
    });

    const channel = dispatchPubSubChannel(targetCountry);
    const subscriber = deps.redis.duplicate();
    let sequence = 1;
    let closed = false;

    const writeEvent = (eventName: string, payload: unknown) => {
      if (closed || reply.raw.writableEnded) return;
      reply.raw.write(
        `id: ${sequence++}\nevent: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
      );
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeatTimer);
      subscriber.removeAllListeners("message");
      void subscriber.unsubscribe(channel).catch(() => undefined);
      void subscriber.quit().catch(() => undefined);
    };

    const heartbeatTimer = setInterval(() => {
      if (!closed && !reply.raw.writableEnded) {
        reply.raw.write(": ping\n\n");
      }
    }, 20_000);
    heartbeatTimer.unref();

    request.raw.on("close", cleanup);

    subscriber.on("message", (_chan, rawMessage) => {
      if (closed) return;
      try {
        const parsed = DispatchStreamEventSchema.safeParse(
          JSON.parse(rawMessage),
        );
        if (!parsed.success) return;

        if (parsed.data.type === "dispatch.updated") {
          const isPatientRole =
            claims.role === "PATIENT" || claims.role === "CAREGIVER";
          if (
            isPatientRole &&
            parsed.data.dispatch.patientUserId !== claims.sub
          ) {
            return;
          }
        }

        writeEvent(parsed.data.type, parsed.data);
      } catch {
        // Ignore malformed pubsub frames cleanly without dropping client stream
      }
    });

    await subscriber.subscribe(channel);
    writeEvent("snapshot", {
      type: "snapshot",
      countryCode: targetCountry,
      timestampIso: new Date().toISOString(),
    });
  });
}
