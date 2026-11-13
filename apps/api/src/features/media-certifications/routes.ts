import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import {
  AdminFacilityMediaQuerySchema,
  PresignFacilityMediaSchema,
  PresignUserMediaSchema,
  ReviewFacilityDocumentSchema,
  type UserRole,
} from "@medisync/contracts";
import { authenticateRequest } from "../foundation/index.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  MediaBadRequestError,
  MediaForbiddenError,
  MediaInvalidSignatureError,
  MediaNotFoundError,
  confirmFacilityMediaUpload,
  confirmUserMediaUpload,
  listAdminFacilityMediaScoped,
  listFacilityMediaScoped,
  listUserMediaScoped,
  presignFacilityMediaUpload,
  presignUserMediaUpload,
  reviewFacilityDocumentAdmin,
  reviewUserDocumentAdmin,
} from "./pg-store.js";

const FacilityParamSchema = z.object({
  id: z.string().uuid(),
});

const FacilityMediaParamSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
});

const MediaIdParamSchema = z.object({
  mediaId: z.string().uuid(),
});

const ADMIN_MEDIA_VIEWER_ROLES: readonly UserRole[] = [
  "OPS_ADMIN",
  "HOSPITAL_ADMIN",
];

const OPS_ADMIN_ONLY: readonly UserRole[] = ["OPS_ADMIN"];

function handleMediaError(err: unknown, reply: FastifyReply) {
  if (err instanceof MediaForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof MediaNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof MediaInvalidSignatureError) {
    return reply.status(422).send({
      error: "INVALID_FILE_SIGNATURE",
      message: err.message,
    });
  }
  if (err instanceof MediaBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  throw err;
}

export async function registerMediaCertificationRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    authSecret: string;
    s3Config: S3PresignConfig;
  },
): Promise<void> {
  app.post<{ Params: { id: string } }>(
    "/v1/facilities/:id/media/presign-upload",
    async (request, reply) => {
      const claims = authenticateRequest(request, reply, deps.authSecret);
      if (!claims) return;

      const params = FacilityParamSchema.safeParse(request.params);
      const body = PresignFacilityMediaSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({ error: "INVALID_UPLOAD_REQUEST" });
      }

      try {
        const result = await presignFacilityMediaUpload(
          deps.pool,
          params.data.id,
          claims,
          deps.s3Config,
          body.data,
        );
        return reply.status(201).send(result);
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string; mediaId: string } }>(
    "/v1/facilities/:id/media/:mediaId/confirm",
    async (request, reply) => {
      const claims = authenticateRequest(request, reply, deps.authSecret);
      if (!claims) return;

      const params = FacilityMediaParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_MEDIA_PARAMS" });
      }

      try {
        const document = await confirmFacilityMediaUpload(
          deps.pool,
          params.data.id,
          params.data.mediaId,
          claims,
          deps.s3Config,
        );
        return { document };
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/v1/facilities/:id/media",
    async (request, reply) => {
      const claims = authenticateRequest(request, reply, deps.authSecret);
      if (!claims) return;

      const params = FacilityParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_FACILITY_ID" });
      }

      try {
        const documents = await listFacilityMediaScoped(
          deps.pool,
          params.data.id,
          claims,
          deps.s3Config,
        );
        return { documents };
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.get("/v1/admin/facility-media", async (request, reply) => {
    const claims = authenticateRequest(
      request,
      reply,
      deps.authSecret,
      ADMIN_MEDIA_VIEWER_ROLES,
    );
    if (!claims) return;

    const query = AdminFacilityMediaQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "INVALID_FACILITY_MEDIA_QUERY" });
    }

    try {
      const documents = await listAdminFacilityMediaScoped(
        deps.pool,
        claims,
        deps.s3Config,
        query.data,
      );
      return { documents };
    } catch (err) {
      return handleMediaError(err, reply);
    }
  });

  app.patch<{ Params: { mediaId: string } }>(
    "/v1/admin/facility-media/:mediaId/review",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        OPS_ADMIN_ONLY,
      );
      if (!claims) return;

      const params = MediaIdParamSchema.safeParse(request.params);
      const body = ReviewFacilityDocumentSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({ error: "INVALID_REVIEW_PAYLOAD" });
      }

      try {
        const document = await reviewFacilityDocumentAdmin(
          deps.pool,
          params.data.mediaId,
          claims,
          deps.s3Config,
          body.data,
        );
        return { document };
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.post("/v1/users/me/media/presign-upload", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    const body = PresignUserMediaSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: "INVALID_UPLOAD_REQUEST",
        issues: body.error.issues,
      });
    }

    try {
      const result = await presignUserMediaUpload(
        deps.pool,
        claims,
        deps.s3Config,
        body.data,
      );
      return reply.status(201).send(result);
    } catch (err) {
      return handleMediaError(err, reply);
    }
  });

  app.post<{ Params: { mediaId: string } }>(
    "/v1/users/me/media/:mediaId/confirm",
    async (request, reply) => {
      const claims = authenticateRequest(request, reply, deps.authSecret);
      if (!claims) return;

      const params = MediaIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_MEDIA_ID" });
      }

      try {
        const result = await confirmUserMediaUpload(
          deps.pool,
          params.data.mediaId,
          claims,
          deps.s3Config,
        );
        return result;
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.get("/v1/users/me/media", async (request, reply) => {
    const claims = authenticateRequest(request, reply, deps.authSecret);
    if (!claims) return;

    try {
      const documents = await listUserMediaScoped(
        deps.pool,
        claims.sub,
        claims,
        deps.s3Config,
      );
      return { documents };
    } catch (err) {
      return handleMediaError(err, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    "/v1/admin/users/:id/media",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        ADMIN_MEDIA_VIEWER_ROLES,
      );
      if (!claims) return;

      const params = FacilityParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "INVALID_USER_ID" });
      }

      try {
        const documents = await listUserMediaScoped(
          deps.pool,
          params.data.id,
          claims,
          deps.s3Config,
        );
        return { documents };
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );

  app.patch<{ Params: { mediaId: string } }>(
    "/v1/admin/user-media/:mediaId/review",
    async (request, reply) => {
      const claims = authenticateRequest(
        request,
        reply,
        deps.authSecret,
        OPS_ADMIN_ONLY,
      );
      if (!claims) return;

      const params = MediaIdParamSchema.safeParse(request.params);
      const body = ReviewFacilityDocumentSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({ error: "INVALID_REVIEW_PAYLOAD" });
      }

      try {
        const document = await reviewUserDocumentAdmin(
          deps.pool,
          params.data.mediaId,
          claims,
          deps.s3Config,
          body.data,
        );
        return { document };
      } catch (err) {
        return handleMediaError(err, reply);
      }
    },
  );
}
