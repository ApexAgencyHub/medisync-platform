import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  TelehealthPresenceInputSchema,
  TelehealthRoomStateResponseSchema,
  TelehealthSignalInputSchema,
  TelehealthStreamEventSchema,
  type UserRole,
} from "@medisync/contracts";
import { getRedisPubSubHub } from "../../shared/redis/pubsub-hub.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  authenticateRequest,
  SESSION_COOKIE_NAME,
  verifyLiveSessionToken,
} from "../foundation/index.js";
import {
  appendAndPublishSignal,
  readRecentSignals,
  readRoomParticipants,
  resolveConfiguredIceServers,
  TelehealthBadRequestError,
  TelehealthConflictError,
  TelehealthForbiddenError,
  TelehealthNotFoundError,
  TelehealthRateLimitError,
  telehealthPubSubChannel,
  updateParticipantPresence,
  verifyTelehealthParticipant,
} from "./store.js";

const AppointmentIdParamSchema = z.object({
  appointmentId: z.string().uuid(),
});

const SessionQuerySchema = z.object({
  sinceSeq: z.coerce.number().int().min(0).default(0),
});

const StreamQuerySchema = z.object({
  token: z.string().min(1).optional(),
  sinceSeq: z.coerce.number().int().min(0).default(0),
});

const TELEHEALTH_PARTICIPANT_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "PATIENT",
  "CAREGIVER",
];

function mapTelehealthError(err: unknown, reply: FastifyReply): unknown {
  if (err instanceof TelehealthBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  if (err instanceof TelehealthForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof TelehealthNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof TelehealthConflictError) {
    return reply.status(409).send({ error: err.message });
  }
  if (err instanceof TelehealthRateLimitError) {
    return reply.status(429).send({ error: err.message });
  }
  throw err;
}

export async function registerTelehealthRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis: Redis;
    authSecret: string;
    corsOrigins: readonly string[];
    s3Config?: S3PresignConfig;
    requireProviderVerification?: boolean;
  },
): Promise<void> {
  const authDeps = {
    authSecret: deps.authSecret,
    pool: deps.pool,
    redis: deps.redis,
  };

  app.get("/v1/telehealth/sessions/:appointmentId", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      TELEHEALTH_PARTICIPANT_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const paramsParsed = AppointmentIdParamSchema.safeParse(request.params);
    const queryParsed = SessionQuerySchema.safeParse(request.query);
    if (!paramsParsed.success || !queryParsed.success) {
      return reply.status(400).send({ error: "INVALID_TELEHEALTH_REQUEST" });
    }

    try {
      const ctx = await verifyTelehealthParticipant(
        deps.pool,
        paramsParsed.data.appointmentId,
        claims,
        deps.s3Config,
      );
      const [participants, recentSignals] = await Promise.all([
        readRoomParticipants(deps.redis, ctx.appointment.id),
        readRecentSignals(
          deps.redis,
          ctx.appointment.id,
          queryParsed.data.sinceSeq,
        ),
      ]);

      return TelehealthRoomStateResponseSchema.parse({
        appointment: ctx.appointment,
        selfRole: ctx.selfRole,
        participants,
        recentSignals,
        iceServers: resolveConfiguredIceServers({ userId: claims.sub }),
      });
    } catch (err) {
      return mapTelehealthError(err, reply);
    }
  });

  app.post(
    "/v1/telehealth/sessions/:appointmentId/presence",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        authDeps,
        TELEHEALTH_PARTICIPANT_ROLES,
        { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
      );
      if (!claims) return;

      const paramsParsed = AppointmentIdParamSchema.safeParse(request.params);
      const bodyParsed = TelehealthPresenceInputSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "INVALID_PRESENCE_PAYLOAD" });
      }

      try {
        const ctx = await verifyTelehealthParticipant(
          deps.pool,
          paramsParsed.data.appointmentId,
          claims,
          deps.s3Config,
        );
        const participant = await updateParticipantPresence(
          deps.redis,
          ctx.appointment,
          claims.sub,
          ctx.selfRole,
          bodyParsed.data,
        );

        await appendAuditLog(deps.pool, {
          countryCode: ctx.appointment.countryCode,
          actorId: claims.sub,
          actorRole: claims.role,
          action: bodyParsed.data.joined
            ? "TELEHEALTH_ROOM_JOINED"
            : "TELEHEALTH_ROOM_LEFT",
          resourceType: "appointment",
          resourceId: ctx.appointment.id,
          metadata: {
            participantRole: ctx.selfRole,
            audioEnabled: bodyParsed.data.audioEnabled,
            videoEnabled: bodyParsed.data.videoEnabled,
          },
        }).catch(() => undefined);

        return { participant };
      } catch (err) {
        return mapTelehealthError(err, reply);
      }
    },
  );

  app.post(
    "/v1/telehealth/sessions/:appointmentId/signal",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        authDeps,
        TELEHEALTH_PARTICIPANT_ROLES,
        { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
      );
      if (!claims) return;

      const paramsParsed = AppointmentIdParamSchema.safeParse(request.params);
      const bodyParsed = TelehealthSignalInputSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({
          error: "INVALID_SIGNAL_PAYLOAD",
          ...(bodyParsed.success ? {} : { issues: bodyParsed.error.issues }),
        });
      }

      try {
        const ctx = await verifyTelehealthParticipant(
          deps.pool,
          paramsParsed.data.appointmentId,
          claims,
          deps.s3Config,
        );
        const signal = await appendAndPublishSignal(
          deps.redis,
          ctx.appointment,
          claims.sub,
          ctx.selfRole,
          bodyParsed.data,
        );

        if (bodyParsed.data.kind === "hangup") {
          await appendAuditLog(deps.pool, {
            countryCode: ctx.appointment.countryCode,
            actorId: claims.sub,
            actorRole: claims.role,
            action: "TELEHEALTH_CALL_ENDED",
            resourceType: "appointment",
            resourceId: ctx.appointment.id,
            metadata: { participantRole: ctx.selfRole },
          }).catch(() => undefined);
        }

        return reply.status(201).send({ signal });
      } catch (err) {
        return mapTelehealthError(err, reply);
      }
    },
  );

  app.get(
    "/v1/telehealth/sessions/:appointmentId/stream",
    async (request, reply) => {
      const paramsParsed = AppointmentIdParamSchema.safeParse(request.params);
      const queryParsed = StreamQuerySchema.safeParse(request.query);
      if (!paramsParsed.success || !queryParsed.success) {
        return reply.status(400).send({ error: "INVALID_TELEHEALTH_STREAM" });
      }

      const headerAuth = request.headers.authorization;
      const cookieToken =
        request.cookies && typeof request.cookies[SESSION_COOKIE_NAME] === "string"
          ? request.cookies[SESSION_COOKIE_NAME]
          : undefined;
      const rawToken =
        headerAuth && headerAuth.startsWith("Bearer ")
          ? headerAuth.slice("Bearer ".length).trim()
          : queryParsed.data.token ?? cookieToken?.trim();

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
      if (!TELEHEALTH_PARTICIPANT_ROLES.includes(claims.role)) {
        return reply.status(403).send({ error: "FORBIDDEN_ROLE" });
      }

      let ctx;
      try {
        ctx = await verifyTelehealthParticipant(
          deps.pool,
          paramsParsed.data.appointmentId,
          claims,
          deps.s3Config,
        );
      } catch (err) {
        return mapTelehealthError(err, reply);
      }

      const origin = request.headers.origin;
      const corsHeaders: Record<string, string> = {};
      if (origin && deps.corsOrigins.includes(origin)) {
        corsHeaders["Access-Control-Allow-Origin"] = origin;
        corsHeaders["Access-Control-Allow-Credentials"] = "true";
        corsHeaders.Vary = "Origin";
      }

      const channel = telehealthPubSubChannel(ctx.appointment.id);
      const [participants, recentSignals] = await Promise.all([
        readRoomParticipants(deps.redis, ctx.appointment.id),
        readRecentSignals(
          deps.redis,
          ctx.appointment.id,
          queryParsed.data.sinceSeq,
        ),
      ]);

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

      const pubsubHub = getRedisPubSubHub(deps.redis);
      const untrackStream = pubsubHub.trackStream(reply.raw);
      let unsubscribe: (() => void) | null = null;
      let eventId = 1;
      let closed = false;

      const writeEvent = (eventName: string, payload: unknown) => {
        if (closed || reply.raw.writableEnded || reply.raw.destroyed) return;
        try {
          reply.raw.write(
            `id: ${eventId++}\nevent: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
          );
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeatTimer);
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

      try {
        unsubscribe = await pubsubHub.subscribe(channel, (rawMessage) => {
          if (closed) return;
          try {
            const parsed = TelehealthStreamEventSchema.safeParse(
              JSON.parse(rawMessage),
            );
            if (!parsed.success) return;
            writeEvent(parsed.data.type, parsed.data);
          } catch {
            // Ignore malformed pubsub payload cleanly
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
        appointmentId: ctx.appointment.id,
        selfRole: ctx.selfRole,
        participants,
        recentSignals,
        timestampIso: new Date().toISOString(),
      });
    },
  );
}
