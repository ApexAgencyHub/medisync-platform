import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  ClinicalFilterQuerySchema,
  CreateLabOrderSchema,
  CreatePrescriptionSchema,
  CreateVisitNoteSchema,
  DispensePrescriptionSchema,
  PresignClinicalUploadSchema,
  UpdateLabOrderStatusSchema,
  VerifyPrescriptionQrSchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  ClinicalBadRequestError,
  ClinicalConflictError,
  ClinicalForbiddenError,
  ClinicalInvalidMediaError,
  ClinicalNotFoundError,
  confirmClinicalMediaUpload,
  createLabOrder,
  createPrescription,
  createPresignedMediaUpload,
  createVisitNote,
  dispensePrescriptionAtomic,
  listClinicalMediaScoped,
  listLabOrdersScoped,
  listPrescriptionsScoped,
  listVisitNotesScoped,
  updateLabOrderStatus,
  verifyPrescriptionQrRecord,
} from "./pg-store.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const VISIT_NOTE_WRITER_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "OPS_ADMIN",
];

const VISIT_NOTE_VIEWER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "OPS_ADMIN",
];

const RX_ISSUER_ROLES: readonly UserRole[] = ["DOCTOR", "OPS_ADMIN"];

const RX_VIEWER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "PHARMACIST",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const PHARMACIST_ROLES: readonly UserRole[] = ["PHARMACIST", "OPS_ADMIN"];

const LAB_ORDER_CREATOR_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const LAB_ORDER_VIEWER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "LAB_TECH",
  "OPS_ADMIN",
];

const LAB_TECH_ROLES: readonly UserRole[] = [
  "LAB_TECH",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

const MEDIA_UPLOADER_ROLES: readonly UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

function mapClinicalError(err: unknown, reply: FastifyReply): unknown {
  if (err instanceof ClinicalBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  if (err instanceof ClinicalInvalidMediaError) {
    return reply.status(422).send({
      error: "INVALID_FILE_SIGNATURE",
      message: err.message,
    });
  }
  if (err instanceof ClinicalForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof ClinicalNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof ClinicalConflictError) {
    return reply.status(409).send({ error: err.message });
  }
  throw err;
}

export async function registerClinicalRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    s3Config: S3PresignConfig;
    requireProviderVerification?: boolean;
  },
): Promise<void> {
  app.post("/v1/clinical/visit-notes", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      VISIT_NOTE_WRITER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreateVisitNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const visitNote = await createVisitNote(deps.pool, claims, parsed.data);
      return reply.status(201).send({ visitNote });
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.get("/v1/clinical/visit-notes", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      VISIT_NOTE_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = ClinicalFilterQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    try {
      const visitNotes = await listVisitNotesScoped(
        deps.pool,
        claims,
        parsed.data,
      );
      return { visitNotes };
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.post("/v1/clinical/prescriptions", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      RX_ISSUER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreatePrescriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const prescription = await createPrescription(
        deps.pool,
        claims,
        deps.authSecret,
        parsed.data,
      );
      return reply.status(201).send({ prescription });
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.get("/v1/clinical/prescriptions", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      RX_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = ClinicalFilterQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    try {
      const prescriptions = await listPrescriptionsScoped(
        deps.pool,
        claims,
        parsed.data,
      );
      return { prescriptions };
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.post("/v1/clinical/prescriptions/verify-qr", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PHARMACIST_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = VerifyPrescriptionQrSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QR_PAYLOAD" });
    }

    try {
      const prescription = await verifyPrescriptionQrRecord(
        deps.pool,
        claims,
        deps.authSecret,
        parsed.data.qrToken,
      );
      return { valid: true, prescription };
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.post(
    "/v1/clinical/prescriptions/:id/dispense",
    async (request, reply) => {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        PHARMACIST_ROLES,
        { requireVerifiedProvider: deps.requireProviderVerification },
      );
      if (!claims) return;

      const paramsParsed = UuidParamSchema.safeParse(request.params);
      const bodyParsed = DispensePrescriptionSchema.safeParse(
        request.body ?? {},
      );
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "INVALID_PAYLOAD" });
      }

      try {
        const prescription = await dispensePrescriptionAtomic(
          deps.pool,
          paramsParsed.data.id,
          claims,
          bodyParsed.data,
        );
        return reply.status(200).send({ prescription });
      } catch (err) {
        return mapClinicalError(err, reply);
      }
    },
  );

  app.post("/v1/clinical/lab-orders", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      LAB_ORDER_CREATOR_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreateLabOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const labOrder = await createLabOrder(deps.pool, claims, parsed.data);
      return reply.status(201).send({ labOrder });
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.get("/v1/clinical/lab-orders", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      LAB_ORDER_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = ClinicalFilterQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    try {
      const labOrders = await listLabOrdersScoped(
        deps.pool,
        claims,
        parsed.data,
      );
      return { labOrders };
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.patch("/v1/clinical/lab-orders/:id/status", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      LAB_TECH_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = UpdateLabOrderStatusSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const labOrder = await updateLabOrderStatus(
        deps.pool,
        paramsParsed.data.id,
        claims,
        bodyParsed.data,
      );
      return reply.status(200).send({ labOrder });
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.post("/v1/clinical/media/presign-upload", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      MEDIA_UPLOADER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = PresignClinicalUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_UPLOAD_REQUEST",
        issues: parsed.error.issues,
      });
    }

    try {
      const response = await createPresignedMediaUpload(
        deps.pool,
        claims,
        deps.s3Config,
        parsed.data,
      );
      return reply.status(201).send(response);
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.post("/v1/clinical/media/:id/confirm", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      MEDIA_UPLOADER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "INVALID_MEDIA_ID" });
    }

    try {
      const mediaObject = await confirmClinicalMediaUpload(
        deps.pool,
        paramsParsed.data.id,
        claims,
        deps.s3Config,
      );
      return reply.status(200).send({ mediaObject });
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });

  app.get("/v1/clinical/media", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      LAB_ORDER_VIEWER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = ClinicalFilterQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    try {
      const mediaObjects = await listClinicalMediaScoped(
        deps.pool,
        claims,
        deps.s3Config,
        parsed.data,
      );
      return { mediaObjects };
    } catch (err) {
      return mapClinicalError(err, reply);
    }
  });
}
