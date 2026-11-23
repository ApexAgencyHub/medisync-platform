import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateDispatchRequestSchema,
  DeclineDispatchRequestSchema,
  DispatchListQuerySchema,
  DispatchStreamEventSchema,
  DriverPingInputSchema,
  FacilityViewportQuerySchema,
  NearbyDriversQuerySchema,
  TransitionDispatchStatusSchema,
  UpdateFacilityOperationalStatusSchema,
  type DriverStatus,
  type UserRole,
} from "@medisync/contracts";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  withGenerationCache,
} from "../../shared/redis/cache.js";
import { getRedisPubSubHub } from "../../shared/redis/pubsub-hub.js";
import {
  appendAuditLog,
  authenticateRequest,
  SESSION_COOKIE_NAME,
  verifyLiveSessionToken,
} from "../foundation/index.js";
import {
  createDispatchRequest,
  declineOrReleaseDispatch,
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
  clearDriverOffDuty,
  dispatchPubSubChannel,
  findNearbyDrivers,
  isDriverOffDuty,
  publishDispatchUpdate,
  upsertDriverLocation,
} from "./redis-geo.js";
import {
  checkDriverOfferBeforeAccept,
  DEFAULT_DRIVER_OFFER_TTL_MS,
  ensureDriverOfferWindow,
  markDriverOfferAutoRefused,
  markDriverOfferManualDeclined,
} from "./offer-window.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const StreamQuerySchema = z.object({
  token: z.string().min(1).optional(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
});

const FACILITY_MANAGER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
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
    requireProviderVerification?: boolean;
    driverOfferTtlMs?: number;
  },
): Promise<void> {
  const offerTtlMs =
    deps.driverOfferTtlMs && deps.driverOfferTtlMs > 0
      ? deps.driverOfferTtlMs
      : DEFAULT_DRIVER_OFFER_TTL_MS;
  // Warm PostGIS extension, spatial_ref_sys distance cache, & GiST plans on pooled connections.
  const warmupQuery = {
    countryCode: "MA",
    minLng: -7.7,
    minLat: 33.48,
    maxLng: -7.48,
    maxLat: 33.66,
    limit: 1,
  };
  await Promise.all([
    queryFacilitiesInViewport(deps.pool, warmupQuery),
    queryFacilitiesInViewport(deps.pool, warmupQuery),
  ]).catch(() => undefined);

  app.get("/v1/maps/facilities/viewport", async (request, reply) => {
    const parsed = FacilityViewportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_VIEWPORT_QUERY",
        issues: parsed.error.issues,
      });
    }

    const q = parsed.data;
    const quant = (n: number) => (Math.round(n * 200) / 200).toFixed(3);
    const cacheKey = `vp:${q.countryCode ?? "ALL"}:${q.kind ?? "ALL"}:${q.openNow ? "1" : "0"}:${q.limit}:${quant(q.minLat)}:${quant(q.minLng)}:${quant(q.maxLat)}:${quant(q.maxLng)}`;
    const result = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      15,
      () => queryFacilitiesInViewport(deps.pool, q),
    );
    reply.header(
      "Cache-Control",
      "public, max-age=15, stale-while-revalidate=60",
    );
    return result;
  });

  app.patch(
    "/v1/maps/facilities/:id/operational-status",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        FACILITY_MANAGER_ROLES,
        { requireVerifiedProvider: deps.requireProviderVerification },
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
            facilityId: claims.facilityId,
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

        await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);

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
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ["DRIVER"],
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = DriverPingInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_DRIVER_PING",
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.status === "OFF_DUTY") {
      const activeTripRes = await deps.pool.query<{ id: string }>(
        `SELECT id
         FROM dispatch_requests
         WHERE driver_user_id = $1
           AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED')
         LIMIT 1`,
        [claims.sub],
      );
      if (activeTripRes.rowCount && activeTripRes.rowCount > 0) {
        return reply.status(409).send({
          error: "ACTIVE_MISSION_DUTY_LOCK",
          message:
            "Complete or release your active dispatch mission before going Off Duty.",
        });
      }
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
    const claims = await authenticateRequest(
      request,
      reply,
      {
        authSecret: deps.authSecret,
        pool: deps.pool,
        redis: deps.redis,
      },
      undefined,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
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
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      DISPATCH_CREATOR_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
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
        claims.role,
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
    const claims = await authenticateRequest(
      request,
      reply,
      {
        authSecret: deps.authSecret,
        pool: deps.pool,
        redis: deps.redis,
      },
      undefined,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
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
    if (claims.role === "DRIVER") {
      let activeMissionStatus: "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | null =
        null;
      for (const item of dispatches) {
        if (
          item.driverUserId === claims.sub &&
          (item.status === "ASSIGNED" ||
            item.status === "EN_ROUTE" ||
            item.status === "ARRIVED")
        ) {
          activeMissionStatus = item.status;
          break;
        }
      }
      if (
        !activeMissionStatus &&
        (parsed.data.status !== undefined ||
          dispatches.length >= parsed.data.limit)
      ) {
        const activeRes = await deps.pool
          .query<{ status: "ASSIGNED" | "EN_ROUTE" | "ARRIVED" }>(
            `SELECT status
             FROM dispatch_requests
             WHERE driver_user_id = $1
               AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED')
             LIMIT 1`,
            [claims.sub],
          )
          .catch(() => null);
        activeMissionStatus = activeRes?.rows[0]?.status ?? null;
      }

      const hasActiveMission = activeMissionStatus !== null;
      const offDuty = await isDriverOffDuty(deps.redis, claims.sub).catch(
        () => false,
      );
      const driverDutyStatus: DriverStatus = activeMissionStatus
        ? activeMissionStatus === "ASSIGNED"
          ? "ASSIGNED"
          : "EN_ROUTE"
        : offDuty
          ? "OFF_DUTY"
          : "AVAILABLE";

      const visibleDispatches = [];
      for (const item of dispatches) {
        if (item.driverUserId === claims.sub && item.status !== "REQUESTED") {
          visibleDispatches.push(item);
          continue;
        }
        if (item.status !== "REQUESTED") {
          continue;
        }
        if (hasActiveMission || offDuty) {
          // Do not start or expire new 60s offer timers while the driver is off duty or on an active trip
          continue;
        }
        const offer = await ensureDriverOfferWindow(
          deps.redis,
          claims.sub,
          item.id,
          offerTtlMs,
        ).catch(() => null);
        if (!offer) {
          visibleDispatches.push(item);
          continue;
        }
        if (offer.status === "DECLINED") {
          continue;
        }
        if (offer.status === "EXPIRED") {
          if (offer.newlyExpired) {
            await appendAuditLog(deps.pool, {
              countryCode: item.countryCode,
              actorId: claims.sub,
              actorRole: claims.role,
              action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
              resourceType: "dispatch_request",
              resourceId: item.id,
              metadata: {
                offerWindowSeconds: Math.max(1, Math.ceil(offerTtlMs / 1000)),
                reason: "AUTO_TIMEOUT_60S",
              },
            }).catch(() => undefined);
          }
          continue;
        }
        visibleDispatches.push({
          ...item,
          offerExpiresAtIso: offer.offerExpiresAtIso,
          offerWindowSeconds: offer.offerWindowSeconds,
          offerRemainingMs: offer.offerRemainingMs,
        });
      }
      return { dispatches: visibleDispatches, driverDutyStatus };
    }
    return { dispatches };
  });

  function mapDispatchMutationError(
    reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
    err: unknown,
  ): boolean {
    if (err instanceof DispatchNotFoundError) {
      reply.status(404).send({ error: "DISPATCH_NOT_FOUND" });
      return true;
    }
    if (err instanceof DispatchForbiddenError) {
      reply.status(403).send({ error: "FORBIDDEN_DISPATCH_ACTION" });
      return true;
    }
    if (err instanceof DispatchConflictError) {
      reply
        .status(409)
        .send({ error: "DISPATCH_STATE_CONFLICT", message: err.message });
      return true;
    }
    return false;
  }

  app.patch("/v1/dispatch/requests/:id/status", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      undefined,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = TransitionDispatchStatusSchema.safeParse(request.body);
    if (!paramParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      if (claims.role === "DRIVER" && bodyParsed.data.status === "ASSIGNED") {
        const offerCheck = await checkDriverOfferBeforeAccept(
          deps.redis,
          claims.sub,
          paramParsed.data.id,
        );
        if (!offerCheck.allowed) {
          if (offerCheck.newlyExpired) {
            await appendAuditLog(deps.pool, {
              countryCode: claims.countryCode,
              actorId: claims.sub,
              actorRole: claims.role,
              action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
              resourceType: "dispatch_request",
              resourceId: paramParsed.data.id,
              metadata: {
                offerWindowSeconds: Math.max(1, Math.ceil(offerTtlMs / 1000)),
                reason: "AUTO_TIMEOUT_60S",
              },
            }).catch(() => undefined);
          }
          return reply.status(409).send({
            error: "DISPATCH_OFFER_EXPIRED",
            message:
              offerCheck.reason === "EXPIRED"
                ? "Dispatch offer expired after 60 seconds and was automatically refused."
                : "This dispatch request was already declined.",
          });
        }
      }

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
      if (mapDispatchMutationError(reply, err)) return;
      throw err;
    }
  });

  app.post("/v1/dispatch/requests/:id/decline", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      undefined,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = DeclineDispatchRequestSchema.safeParse(
      request.body ?? {},
    );
    if (!paramParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    const isAutoTimeout = bodyParsed.data.reason === "AUTO_TIMEOUT_60S";

    try {
      const result = await declineOrReleaseDispatch(
        deps.pool,
        {
          userId: claims.sub,
          role: claims.role,
          countryCode: claims.countryCode,
        },
        paramParsed.data.id,
      );

      if (isAutoTimeout && !result.releasedToQueue) {
        const autoRes = await markDriverOfferAutoRefused(
          deps.redis,
          claims.sub,
          paramParsed.data.id,
        );
        if (autoRes.newlyExpired) {
          await appendAuditLog(deps.pool, {
            countryCode: result.dispatch.countryCode,
            actorId: claims.sub,
            actorRole: claims.role,
            action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
            resourceType: "dispatch_request",
            resourceId: result.dispatch.id,
            metadata: {
              offerWindowSeconds: Math.max(1, Math.ceil(offerTtlMs / 1000)),
              reason: "AUTO_TIMEOUT_60S",
            },
          });
        }
      } else {
        const manualRes = await markDriverOfferManualDeclined(
          deps.redis,
          claims.sub,
          paramParsed.data.id,
        );
        if (manualRes.newlyDeclined || result.releasedToQueue) {
          await appendAuditLog(deps.pool, {
            countryCode: result.dispatch.countryCode,
            actorId: claims.sub,
            actorRole: claims.role,
            action: "DISPATCH_DECLINED_BY_DRIVER",
            resourceType: "dispatch_request",
            resourceId: result.dispatch.id,
            metadata: {
              releasedToQueue: result.releasedToQueue,
              ...(bodyParsed.data.reason
                ? { reason: bodyParsed.data.reason }
                : {}),
            },
          });
        }
      }

      if (result.releasedToQueue) {
        await publishDispatchUpdate(deps.redis, result.dispatch);
      }

      return {
        declined: true as const,
        dispatchId: paramParsed.data.id,
        releasedToQueue: result.releasedToQueue,
        dispatch: result.dispatch,
      };
    } catch (err) {
      // Auto-timeout firing right after another driver claimed the request is idempotent, not a client error
      if (isAutoTimeout && err instanceof DispatchConflictError && claims.role === "DRIVER") {
        await markDriverOfferAutoRefused(
          deps.redis,
          claims.sub,
          paramParsed.data.id,
        ).catch(() => undefined);
        return {
          declined: true as const,
          dispatchId: paramParsed.data.id,
          releasedToQueue: false,
        };
      }
      if (mapDispatchMutationError(reply, err)) return;
      throw err;
    }
  });

  app.get("/v1/dispatch/stream", async (request, reply) => {
    const queryParsed = StreamQuerySchema.safeParse(request.query);
    const headerAuth = request.headers.authorization;
    const cookieToken =
      request.cookies && typeof request.cookies[SESSION_COOKIE_NAME] === "string"
        ? request.cookies[SESSION_COOKIE_NAME]
        : undefined;
    const rawToken =
      headerAuth && headerAuth.startsWith("Bearer ")
        ? headerAuth.slice("Bearer ".length).trim()
        : (queryParsed.success ? queryParsed.data.token : undefined) ??
          cookieToken?.trim();

    if (!rawToken) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    const authRes = await verifyLiveSessionToken(
      rawToken,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!authRes.ok) {
      return reply.status(authRes.status).send({
        error: authRes.error,
        ...(authRes.message ? { message: authRes.message } : {}),
      });
    }
    const claims = authRes.claims;

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

    // Disable Fastify/Node idle socket timeout for long-lived SSE streams
    request.raw.setTimeout?.(0);
    reply.raw.setTimeout?.(0);
    request.raw.socket?.setTimeout(0);
    reply.raw.socket?.setTimeout(0);
    request.raw.socket?.setKeepAlive?.(true, 15_000);
    request.raw.socket?.setNoDelay?.(true);

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders,
    });

    const channel = dispatchPubSubChannel(targetCountry);
    const pubsubHub = getRedisPubSubHub(deps.redis);
    const untrackStream = pubsubHub.trackStream(reply.raw);
    let unsubscribe: (() => void) | null = null;
    let sequence = 1;
    let closed = false;
    const offerTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearOfferTimer = (dispatchId: string) => {
      const existing = offerTimers.get(dispatchId);
      if (existing) {
        clearTimeout(existing);
        offerTimers.delete(dispatchId);
      }
    };

    const writeEvent = (eventName: string, payload: unknown) => {
      if (closed || reply.raw.writableEnded || reply.raw.destroyed) return;
      try {
        reply.raw.write(
          `id: ${sequence++}\nevent: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
        );
      } catch {
        cleanup();
      }
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeatTimer);
      for (const timer of offerTimers.values()) {
        clearTimeout(timer);
      }
      offerTimers.clear();
      request.raw.off("close", cleanup);
      request.raw.off("error", cleanup);
      reply.raw.off("close", cleanup);
      reply.raw.off("error", cleanup);
      reply.raw.off("finish", cleanup);
      untrackStream();
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    // Keepalive below Fastify's connectionTimeout (10s) so idle streams stay alive
    const heartbeatTimer = setInterval(() => {
      if (closed || reply.raw.writableEnded || reply.raw.destroyed) {
        cleanup();
        return;
      }
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        cleanup();
      }
    }, 5_000);
    heartbeatTimer.unref();

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    reply.raw.on("close", cleanup);
    reply.raw.on("error", cleanup);
    reply.raw.on("finish", cleanup);

    let lastObservedDriverStatus: DriverStatus | null = null;

    const canViewDispatchBroadcast =
      claims.role === "OPS_ADMIN" ||
      claims.role === "DRIVER" ||
      claims.role === "HOSPITAL_ADMIN" ||
      claims.role === "CLINIC_STAFF";

    const scheduleOfferExpiryTimer = (
      dispatchId: string,
      countryCode: string,
      expiresAtMs: number,
      offerWindowSeconds: number,
    ) => {
      if (closed) return;
      clearOfferTimer(dispatchId);
      const delayMs = Math.max(25, expiresAtMs - Date.now());
      const timer = setTimeout(() => {
        offerTimers.delete(dispatchId);
        if (closed) return;
        void (async () => {
          const check = await deps.pool.query<{ status: string }>(
            `SELECT status FROM dispatch_requests WHERE id = $1 LIMIT 1`,
            [dispatchId],
          );
          if (closed || check.rows[0]?.status !== "REQUESTED") {
            return;
          }
          const autoRes = await markDriverOfferAutoRefused(
            deps.redis,
            claims.sub,
            dispatchId,
          );
          if (!autoRes.wasAutoExpired || closed) {
            return;
          }
          if (autoRes.newlyExpired) {
            await appendAuditLog(deps.pool, {
              countryCode,
              actorId: claims.sub,
              actorRole: claims.role,
              action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
              resourceType: "dispatch_request",
              resourceId: dispatchId,
              metadata: {
                offerWindowSeconds,
                reason: "AUTO_TIMEOUT_60S",
              },
            }).catch(() => undefined);
          }
          writeEvent("dispatch.offer_expired", {
            type: "dispatch.offer_expired",
            dispatchId,
            reason: "AUTO_TIMEOUT_60S",
            expiredAtIso: new Date().toISOString(),
          });
        })().catch(() => undefined);
      }, delayMs);
      timer.unref?.();
      offerTimers.set(dispatchId, timer);
    };

    const hydrateDriverOfferTimers = async () => {
      if (closed || claims.role !== "DRIVER") return;
      const offDuty = await isDriverOffDuty(deps.redis, claims.sub).catch(
        () => false,
      );
      if (closed) return;
      if (offDuty) {
        lastObservedDriverStatus = "OFF_DUTY";
        return;
      }

      const activeTrip = await deps.pool
        .query<{ id: string }>(
          `SELECT id FROM dispatch_requests
           WHERE driver_user_id = $1
             AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED')
           LIMIT 1`,
          [claims.sub],
        )
        .catch(() => null);
      if (closed) return;
      if (activeTrip && activeTrip.rowCount && activeTrip.rowCount > 0) {
        lastObservedDriverStatus = "EN_ROUTE";
        return;
      }
      lastObservedDriverStatus = "AVAILABLE";

      const openRequests = await listDispatchRequestsScoped(
        deps.pool,
        { status: "REQUESTED", limit: 25 },
        {
          userId: claims.sub,
          role: claims.role,
          countryCode: claims.countryCode,
        },
      ).catch(() => []);
      if (closed) return;

      for (const item of openRequests) {
        if (closed || item.status !== "REQUESTED") continue;
        const offer = await ensureDriverOfferWindow(
          deps.redis,
          claims.sub,
          item.id,
          offerTtlMs,
        ).catch(() => null);
        if (closed || !offer) continue;
        if (offer.status === "ACTIVE") {
          scheduleOfferExpiryTimer(
            item.id,
            item.countryCode,
            offer.expiresAtMs,
            offer.offerWindowSeconds,
          );
        } else if (offer.status === "EXPIRED") {
          if (offer.newlyExpired) {
            await appendAuditLog(deps.pool, {
              countryCode: item.countryCode,
              actorId: claims.sub,
              actorRole: claims.role,
              action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
              resourceType: "dispatch_request",
              resourceId: item.id,
              metadata: {
                offerWindowSeconds: Math.max(1, Math.ceil(offerTtlMs / 1000)),
                reason: "AUTO_TIMEOUT_60S",
              },
            }).catch(() => undefined);
          }
          writeEvent("dispatch.offer_expired", {
            type: "dispatch.offer_expired",
            dispatchId: item.id,
            reason: "AUTO_TIMEOUT_60S",
            expiredAtIso: new Date().toISOString(),
          });
        }
      }
    };

    try {
      unsubscribe = await pubsubHub.subscribe(channel, (rawMessage) => {
        if (closed) return;
        try {
          const parsed = DispatchStreamEventSchema.safeParse(
            JSON.parse(rawMessage),
          );
          if (!parsed.success) return;

          if (
            parsed.data.type === "driver.location" &&
            claims.role === "DRIVER" &&
            parsed.data.driver.driverId === claims.sub
          ) {
            const prevStatus = lastObservedDriverStatus;
            const nextStatus = parsed.data.driver.status;
            lastObservedDriverStatus = nextStatus;
            if (nextStatus === "OFF_DUTY") {
              for (const timer of offerTimers.values()) {
                clearTimeout(timer);
              }
              offerTimers.clear();
            } else if (nextStatus === "AVAILABLE" && prevStatus !== "AVAILABLE") {
              void hydrateDriverOfferTimers().catch(() => undefined);
            }
          }

          if (parsed.data.type === "dispatch.updated") {
            const isPatientRole =
              claims.role === "PATIENT" || claims.role === "CAREGIVER";
            if (isPatientRole) {
              if (parsed.data.dispatch.patientUserId !== claims.sub) {
                return;
              }
            } else if (!canViewDispatchBroadcast) {
              return;
            }

            if (claims.role === "DRIVER") {
              const dispatch = parsed.data.dispatch;
              if (dispatch.status !== "REQUESTED") {
                clearOfferTimer(dispatch.id);
                writeEvent(parsed.data.type, parsed.data);
                return;
              }

              void (async () => {
                if (closed) return;
                const offDuty = await isDriverOffDuty(
                  deps.redis,
                  claims.sub,
                ).catch(() => false);
                if (closed || offDuty) {
                  return;
                }
                const activeTrip = await deps.pool
                  .query<{ id: string }>(
                    `SELECT id FROM dispatch_requests
                     WHERE driver_user_id = $1
                       AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED')
                     LIMIT 1`,
                    [claims.sub],
                  )
                  .catch(() => null);
                if (closed || (activeTrip && activeTrip.rowCount && activeTrip.rowCount > 0)) {
                  return;
                }

                const offer = await ensureDriverOfferWindow(
                  deps.redis,
                  claims.sub,
                  dispatch.id,
                  offerTtlMs,
                ).catch(() => null);
                if (closed) return;
                if (!offer) {
                  writeEvent("dispatch.updated", parsed.data);
                  return;
                }
                if (offer.status === "DECLINED") {
                  return;
                }
                if (offer.status === "EXPIRED") {
                  if (offer.newlyExpired) {
                    await appendAuditLog(deps.pool, {
                      countryCode: dispatch.countryCode,
                      actorId: claims.sub,
                      actorRole: claims.role,
                      action: "DISPATCH_AUTO_REFUSED_TIMEOUT",
                      resourceType: "dispatch_request",
                      resourceId: dispatch.id,
                      metadata: {
                        offerWindowSeconds: Math.max(
                          1,
                          Math.ceil(offerTtlMs / 1000),
                        ),
                        reason: "AUTO_TIMEOUT_60S",
                      },
                    }).catch(() => undefined);
                  }
                  return;
                }

                writeEvent("dispatch.updated", {
                  type: "dispatch.updated",
                  dispatch: {
                    ...dispatch,
                    offerExpiresAtIso: offer.offerExpiresAtIso,
                    offerWindowSeconds: offer.offerWindowSeconds,
                    offerRemainingMs: offer.offerRemainingMs,
                  },
                });

                scheduleOfferExpiryTimer(
                  dispatch.id,
                  dispatch.countryCode,
                  offer.expiresAtMs,
                  offer.offerWindowSeconds,
                );
              })().catch(() => undefined);
              return;
            }
          }

          writeEvent(parsed.data.type, parsed.data);
        } catch {
          // Ignore malformed pubsub frames cleanly without dropping client stream
        }
      });
    } catch {
      cleanup();
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
      return;
    }

    writeEvent("snapshot", {
      type: "snapshot",
      countryCode: targetCountry,
      timestampIso: new Date().toISOString(),
    });

    if (claims.role === "DRIVER") {
      void hydrateDriverOfferTimers().catch(() => undefined);
    }
  });
}
