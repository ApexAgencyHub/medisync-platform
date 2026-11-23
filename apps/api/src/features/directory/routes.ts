import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  DirectorySearchQuerySchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import {
  DIRECTORY_CACHE_GEN_KEY,
  withGenerationCache,
} from "../../shared/redis/cache.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  listDirectoryDoctorsScoped,
  listDirectoryDriversPublic,
  listDirectoryFacilitiesPublic,
  listDirectoryPatientsScoped,
  listSeededDemoPersonas,
} from "./pg-store.js";

const PATIENT_PICKER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

export async function registerDirectoryRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    requireProviderVerification?: boolean;
  },
): Promise<void> {
  app.get("/v1/directory/patients", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PATIENT_PICKER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = DirectorySearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const patients = await listDirectoryPatientsScoped(
      deps.pool,
      claims,
      parsed.data,
      deps.s3Config,
    );
    return { patients };
  });

  app.get("/v1/directory/doctors", async (request, reply) => {
    const parsed = DirectorySearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const cacheKey = `doctors:${JSON.stringify(parsed.data)}`;
    const doctors = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listDirectoryDoctorsScoped(deps.pool, parsed.data, deps.s3Config),
    );
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return { doctors };
  });

  app.get("/v1/directory/facilities", async (request, reply) => {
    const parsed = DirectorySearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const cacheKey = `facilities:${JSON.stringify(parsed.data)}`;
    const facilities = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listDirectoryFacilitiesPublic(deps.pool, parsed.data),
    );
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return { facilities };
  });

  app.get("/v1/directory/drivers", async (request, reply) => {
    const parsed = DirectorySearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const drivers = await listDirectoryDriversPublic(
      deps.pool,
      deps.redis,
      parsed.data,
      deps.s3Config,
    );
    reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    return { drivers };
  });

  app.get("/v1/directory/demo-personas", async (_request, reply) => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEV_SEED !== "true" &&
      process.env.ENABLE_DEMO_SEED !== "true"
    ) {
      return { personas: [] };
    }
    const personas = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      "demo-personas",
      300,
      () => listSeededDemoPersonas(deps.pool),
    );
    reply.header(
      "Cache-Control",
      "public, max-age=120, stale-while-revalidate=300",
    );
    return { personas };
  });
}
