import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  AppointmentListQuerySchema,
  CreateAppointmentSchema,
  CreateScheduleSchema,
  ScheduleListQuerySchema,
  SlotsQuerySchema,
  TransitionAppointmentStatusSchema,
  UpdateScheduleSchema,
  UpsertDoctorProfileSchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  SCHEDULES_CACHE_GEN_KEY,
  withGenerationCache,
} from "../../shared/redis/cache.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  BookingBadRequestError,
  BookingForbiddenError,
  BookingInvalidTransitionError,
  BookingNotFoundError,
  createAppointmentTransactional,
  createDoctorSchedule,
  deleteDoctorSchedule,
  listAppointmentsScoped,
  listDoctorProfiles,
  listDoctorSchedules,
  queryAvailableSlots,
  SlotAlreadyBookedError,
  transitionAppointmentStatus,
  updateDoctorSchedule,
  upsertDoctorProfile,
} from "./pg-store.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const CountryFilterQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
});

const PROFILE_EDITOR_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const SCHEDULE_MANAGER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const BOOKING_CREATOR_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const BOOKING_VIEWER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

function mapDomainError(err: unknown, reply: FastifyReply): unknown {
  if (err instanceof BookingBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  if (err instanceof BookingForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof BookingNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof SlotAlreadyBookedError) {
    return reply
      .status(409)
      .send({ error: "SLOT_ALREADY_BOOKED", message: err.message });
  }
  if (err instanceof BookingInvalidTransitionError) {
    return reply.status(409).send({ error: err.message });
  }
  throw err;
}

export async function registerBookingRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    requireProviderVerification?: boolean;
  },
): Promise<void> {
  app.get("/v1/booking/profiles", async (request, reply) => {
    const parsed = CountryFilterQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }
    const profiles = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      `booking-profiles:${parsed.data.countryCode ?? "ALL"}`,
      30,
      () =>
        listDoctorProfiles(deps.pool, parsed.data.countryCode, deps.s3Config),
    );
    reply.header(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=120",
    );
    return { profiles };
  });

  app.put("/v1/booking/profiles", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PROFILE_EDITOR_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = UpsertDoctorProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const profile = await upsertDoctorProfile(
        deps.pool,
        claims,
        parsed.data,
        deps.s3Config,
      );
      await Promise.all([
        bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY),
        bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY),
      ]);
      return reply.status(200).send({ profile });
    } catch (err) {
      return mapDomainError(err, reply);
    }
  });

  app.get("/v1/booking/schedules", async (request, reply) => {
    const parsed = ScheduleListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }
    const cacheKey = [
      parsed.data.countryCode ?? "ALL",
      parsed.data.facilityId ?? "ALL",
      parsed.data.doctorUserId ?? "ALL",
      parsed.data.includeInactive ? "1" : "0",
      String(parsed.data.limit),
    ].join(":");
    const schedules = await withGenerationCache(
      deps.redis,
      SCHEDULES_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listDoctorSchedules(deps.pool, parsed.data),
    );
    return { schedules };
  });

  app.post("/v1/booking/schedules", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      SCHEDULE_MANAGER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreateScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const schedule = await createDoctorSchedule(
        deps.pool,
        claims,
        parsed.data,
      );
      await bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY);
      return reply.status(201).send({ schedule });
    } catch (err) {
      return mapDomainError(err, reply);
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/v1/booking/schedules/:id",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        SCHEDULE_MANAGER_ROLES,
        { requireVerifiedProvider: deps.requireProviderVerification },
      );
      if (!claims) return;

      const paramsParsed = UuidParamSchema.safeParse(request.params);
      const bodyParsed = UpdateScheduleSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({
          error: "INVALID_PAYLOAD",
          ...(bodyParsed.success ? {} : { issues: bodyParsed.error.issues }),
        });
      }

      try {
        const schedule = await updateDoctorSchedule(
          deps.pool,
          paramsParsed.data.id,
          claims,
          bodyParsed.data,
        );
        await bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY);
        return reply.status(200).send({ schedule });
      } catch (err) {
        return mapDomainError(err, reply);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/v1/booking/schedules/:id",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        SCHEDULE_MANAGER_ROLES,
        { requireVerifiedProvider: deps.requireProviderVerification },
      );
      if (!claims) return;

      const paramsParsed = UuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "INVALID_SCHEDULE_ID" });
      }

      try {
        const result = await deleteDoctorSchedule(
          deps.pool,
          paramsParsed.data.id,
          claims,
        );
        await bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY);
        return reply.status(200).send(result);
      } catch (err) {
        return mapDomainError(err, reply);
      }
    },
  );

  app.get("/v1/booking/slots", async (request, reply) => {
    const parsed = SlotsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_SLOTS_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const slots = await queryAvailableSlots(deps.pool, parsed.data);
      return {
        date: parsed.data.date,
        slots,
      };
    } catch (err) {
      return mapDomainError(err, reply);
    }
  });

  app.get("/v1/booking/appointments", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      BOOKING_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = AppointmentListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const appointments = await listAppointmentsScoped(
      deps.pool,
      claims,
      parsed.data,
      deps.s3Config,
    );
    return { appointments };
  });

  app.post("/v1/booking/appointments", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      BOOKING_CREATOR_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreateAppointmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const appointment = await createAppointmentTransactional(
        deps.pool,
        claims,
        parsed.data,
        deps.s3Config,
      );
      return reply.status(201).send({ appointment });
    } catch (err) {
      return mapDomainError(err, reply);
    }
  });

  app.patch("/v1/booking/appointments/:id/status", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      BOOKING_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = TransitionAppointmentStatusSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const appointment = await transitionAppointmentStatus(
        deps.pool,
        paramsParsed.data.id,
        claims,
        bodyParsed.data.status,
        bodyParsed.data.note,
        deps.s3Config,
      );
      return reply.status(200).send({ appointment });
    } catch (err) {
      return mapDomainError(err, reply);
    }
  });
}
