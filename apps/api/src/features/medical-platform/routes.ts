import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateMedicalInvoiceSchema,
  CreateMedicalServiceSchema,
  CreatePatientInsuranceSchema,
  ListMedicalInvoicesQuerySchema,
  ListMedicalServicesQuerySchema,
  PayMedicalInvoiceSchema,
  UpsertPatientMedicalProfileSchema,
  type UserRole,
} from "@medisync/contracts";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  withGenerationCache,
} from "../../shared/redis/cache.js";
import { isSimulatedCardAllowed } from "../../shared/payments/psp.js";
import { authenticateRequest } from "../foundation/index.js";
import {
  createMedicalInvoiceAtomic,
  createMedicalServiceScoped,
  createPatientInsuranceScoped,
  getPatientMedicalProfileScoped,
  listMedicalInvoicesScoped,
  listMedicalServicesPublic,
  listPatientInsurancesScoped,
  MedicalPlatformBadRequestError,
  MedicalPlatformConflictError,
  MedicalPlatformForbiddenError,
  MedicalPlatformNotFoundError,
  payMedicalInvoiceAtomic,
  upsertPatientMedicalProfileScoped,
  verifyPatientInsuranceAdmin,
} from "./pg-store.js";

const PatientIdParamSchema = z.object({
  patientId: z.string().uuid(),
});

const PolicyParamSchema = z.object({
  patientId: z.string().uuid(),
  policyId: z.string().uuid(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const VerifyInsuranceBodySchema = z.object({
  verificationStatus: z.enum(["PENDING", "VERIFIED", "EXPIRED", "REJECTED"]),
});

const EHR_ACCESS_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "OPS_ADMIN",
];

// Administrative billing & reception staff may inspect and verify patient insurance cards
// without gaining access to sensitive clinical EHR allergies, notes, or diagnoses.
const INSURANCE_ACCESS_ROLES: readonly UserRole[] = [
  ...EHR_ACCESS_ROLES,
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
];

const INSURANCE_ADMIN_ROLES: readonly UserRole[] = [
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const SERVICE_PUBLISHER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

const INVOICE_ISSUER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

const INVOICE_PAYER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

function mapMedicalPlatformError(err: unknown, reply: FastifyReply): unknown {
  if (err instanceof MedicalPlatformBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  if (err instanceof MedicalPlatformForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof MedicalPlatformNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof MedicalPlatformConflictError) {
    return reply.status(409).send({ error: err.message });
  }
  throw err;
}

export async function registerMedicalPlatformRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    requireProviderVerification?: boolean;
    allowSimulatedPayments?: boolean | undefined;
  },
): Promise<void> {
  const authDeps = {
    authSecret: deps.authSecret,
    pool: deps.pool,
    redis: deps.redis,
  };

  async function handleGetProfile(
    request: FastifyRequest,
    reply: FastifyReply,
    explicitPatientId?: string,
  ) {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      EHR_ACCESS_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const targetPatientId = explicitPatientId ?? claims.sub;
    try {
      const profile = await getPatientMedicalProfileScoped(
        deps.pool,
        targetPatientId,
        claims,
      );
      return { profile };
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  }

  async function handlePutProfile(
    request: FastifyRequest,
    reply: FastifyReply,
    explicitPatientId?: string,
  ) {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      EHR_ACCESS_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const parsed = UpsertPatientMedicalProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PROFILE_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const targetPatientId = explicitPatientId ?? claims.sub;
    try {
      const profile = await upsertPatientMedicalProfileScoped(
        deps.pool,
        targetPatientId,
        claims,
        parsed.data,
      );
      return { profile };
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  }

  async function handleListInsurances(
    request: FastifyRequest,
    reply: FastifyReply,
    explicitPatientId?: string,
  ) {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      INSURANCE_ACCESS_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const targetPatientId = explicitPatientId ?? claims.sub;
    try {
      const policies = await listPatientInsurancesScoped(
        deps.pool,
        targetPatientId,
        claims,
      );
      return { policies };
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  }

  async function handleCreateInsurance(
    request: FastifyRequest,
    reply: FastifyReply,
    explicitPatientId?: string,
  ) {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      INSURANCE_ACCESS_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const parsed = CreatePatientInsuranceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_INSURANCE_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const targetPatientId = explicitPatientId ?? claims.sub;
    try {
      const policy = await createPatientInsuranceScoped(
        deps.pool,
        targetPatientId,
        claims,
        parsed.data,
      );
      return reply.status(201).send({ policy });
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  }

  // Patient EHR Medical Profiles
  app.get("/v1/clinical/patients/me/profile", (request, reply) =>
    handleGetProfile(request, reply),
  );
  app.put("/v1/clinical/patients/me/profile", (request, reply) =>
    handlePutProfile(request, reply),
  );

  app.get<{ Params: { patientId: string } }>(
    "/v1/clinical/patients/:patientId/profile",
    (request, reply) => {
      const params = PatientIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_PATIENT_ID" });
      }
      return handleGetProfile(request, reply, params.data.patientId);
    },
  );

  app.put<{ Params: { patientId: string } }>(
    "/v1/clinical/patients/:patientId/profile",
    (request, reply) => {
      const params = PatientIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_PATIENT_ID" });
      }
      return handlePutProfile(request, reply, params.data.patientId);
    },
  );

  // Patient Insurance Policies
  app.get("/v1/clinical/patients/me/insurances", (request, reply) =>
    handleListInsurances(request, reply),
  );
  app.post("/v1/clinical/patients/me/insurances", (request, reply) =>
    handleCreateInsurance(request, reply),
  );

  app.get<{ Params: { patientId: string } }>(
    "/v1/clinical/patients/:patientId/insurances",
    (request, reply) => {
      const params = PatientIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_PATIENT_ID" });
      }
      return handleListInsurances(request, reply, params.data.patientId);
    },
  );

  app.post<{ Params: { patientId: string } }>(
    "/v1/clinical/patients/:patientId/insurances",
    (request, reply) => {
      const params = PatientIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_PATIENT_ID" });
      }
      return handleCreateInsurance(request, reply, params.data.patientId);
    },
  );

  app.patch<{ Params: { patientId: string; policyId: string } }>(
    "/v1/clinical/patients/:patientId/insurances/:policyId",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        authDeps,
        INSURANCE_ADMIN_ROLES,
        { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
      );
      if (!claims) return;

      const params = PolicyParamSchema.safeParse(request.params);
      const body = VerifyInsuranceBodySchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({ error: "INVALID_INSURANCE_REVIEW_PAYLOAD" });
      }

      try {
        const policy = await verifyPatientInsuranceAdmin(
          deps.pool,
          params.data.patientId,
          params.data.policyId,
          claims,
          body.data.verificationStatus,
        );
        return { policy };
      } catch (err) {
        return mapMedicalPlatformError(err, reply);
      }
    },
  );

  // Medical Services Marketplace Catalog
  app.get("/v1/directory/services", async (request, reply) => {
    const parsed = ListMedicalServicesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_SERVICES_QUERY",
        issues: parsed.error.issues,
      });
    }

    const cacheKey = `services:${JSON.stringify(parsed.data)}`;
    const services = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listMedicalServicesPublic(deps.pool, parsed.data),
    );
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return { services };
  });

  app.post("/v1/directory/services", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      SERVICE_PUBLISHER_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const parsed = CreateMedicalServiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_SERVICE_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const service = await createMedicalServiceScoped(
        deps.pool,
        claims,
        parsed.data,
      );
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      return reply.status(201).send({ service });
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  });

  // Unified Medical Billing & Idempotent Invoices
  app.post("/v1/billing/invoices", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      INVOICE_ISSUER_ROLES,
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const parsed = CreateMedicalInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_INVOICE_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const { invoice, deduplicated } = await createMedicalInvoiceAtomic(
        deps.pool,
        claims,
        parsed.data,
      );
      return reply.status(deduplicated ? 200 : 201).send({ invoice });
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  });

  app.get("/v1/billing/invoices", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      authDeps,
      [
        "PATIENT",
        "CAREGIVER",
        "DOCTOR",
        "NURSE",
        "PHARMACIST",
        "LAB_TECH",
        "CLINIC_STAFF",
        "HOSPITAL_ADMIN",
        "OPS_ADMIN",
      ],
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const parsed = ListMedicalInvoicesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_INVOICE_QUERY",
        issues: parsed.error.issues,
      });
    }

    try {
      const invoices = await listMedicalInvoicesScoped(
        deps.pool,
        claims,
        parsed.data,
      );
      return { invoices };
    } catch (err) {
      return mapMedicalPlatformError(err, reply);
    }
  });

  app.post<{ Params: { id: string } }>(
    "/v1/billing/invoices/:id/pay",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        authDeps,
        INVOICE_PAYER_ROLES,
        { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
      );
      if (!claims) return;

      const params = IdParamSchema.safeParse(request.params);
      const body = PayMedicalInvoiceSchema.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        return reply.status(400).send({ error: "INVALID_PAYMENT_PAYLOAD" });
      }

      if (
        body.data.paymentMethod === "CARD" &&
        !isSimulatedCardAllowed(deps.allowSimulatedPayments)
      ) {
        return reply.status(403).send({
          error: "PAYMENT_PROVIDER_REQUIRED",
          message:
            "Direct card settlement without PSP webhook verification is disabled in production.",
        });
      }

      try {
        const invoice = await payMedicalInvoiceAtomic(
          deps.pool,
          params.data.id,
          claims,
          body.data,
        );
        return { invoice };
      } catch (err) {
        return mapMedicalPlatformError(err, reply);
      }
    },
  );
}
