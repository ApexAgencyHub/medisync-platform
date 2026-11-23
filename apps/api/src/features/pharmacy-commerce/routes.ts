import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  ConfirmOrderPaymentSchema,
  CreatePharmacyOrderSchema,
  CreatePharmacyProductSchema,
  ListPharmacyProductsQuerySchema,
  PaymentWebhookEventSchema,
  UpdatePharmacyOrderStatusSchema,
  UpdatePharmacyProductSchema,
  type UserRole,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  isSimulatedCardAllowed,
  verifyPaymentWebhookSignature,
} from "../../shared/payments/psp.js";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  withGenerationCache,
} from "../../shared/redis/cache.js";
import { authenticateRequest } from "../foundation/index.js";
import {
  confirmPharmacyOrderPayment,
  createPharmacyOrderAtomic,
  createPharmacyProduct,
  listPharmacyOrdersScoped,
  listPharmacyProducts,
  PharmacyBadRequestError,
  PharmacyConflictError,
  PharmacyForbiddenError,
  PharmacyNotFoundError,
  resolveCourierFeeMinor,
  settlePaymentWebhookAtomic,
  updatePharmacyOrderStatusAtomic,
  updatePharmacyProductStock,
} from "./pg-store.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const OrdersQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  status: z.string().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const PRODUCT_MANAGER_ROLES: readonly UserRole[] = [
  "PHARMACIST",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
];

function mapPharmacyError(err: unknown, reply: FastifyReply): unknown {
  if (err instanceof PharmacyBadRequestError) {
    return reply.status(400).send({ error: err.message });
  }
  if (err instanceof PharmacyForbiddenError) {
    return reply.status(403).send({ error: err.message });
  }
  if (err instanceof PharmacyNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof PharmacyConflictError) {
    return reply.status(409).send({ error: err.message });
  }
  throw err;
}

export async function registerPharmacyCommerceRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    requireProviderVerification?: boolean;
    allowSimulatedPayments?: boolean | undefined;
    paymentWebhookSecret?: string | undefined;
  },
): Promise<void> {
  app.get("/v1/pharmacy/products", async (request, reply) => {
    const parsed = ListPharmacyProductsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.includeInactive) {
      const claims = await authenticateRequest(
        request,
        reply,
        { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
        PRODUCT_MANAGER_ROLES,
        { requireVerifiedProvider: deps.requireProviderVerification },
      );
      if (!claims) return;
      const products = await listPharmacyProducts(
        deps.pool,
        parsed.data,
        deps.s3Config,
      );
      return {
        products,
        deliveryFeeMinor: resolveCourierFeeMinor(parsed.data.countryCode),
      };
    }

    const cacheKey = `pharmacy-products:${JSON.stringify(parsed.data)}`;
    const products = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listPharmacyProducts(deps.pool, parsed.data, deps.s3Config),
    );
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return {
      products,
      deliveryFeeMinor: resolveCourierFeeMinor(parsed.data.countryCode),
    };
  });

  app.post("/v1/pharmacy/products", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PRODUCT_MANAGER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = CreatePharmacyProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const product = await createPharmacyProduct(
        deps.pool,
        claims,
        parsed.data,
        deps.s3Config,
      );
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      return reply.status(201).send({ product });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  async function handleProductPatch(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PRODUCT_MANAGER_ROLES,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = UpdatePharmacyProductSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        ...(bodyParsed.success ? {} : { issues: bodyParsed.error.issues }),
      });
    }

    try {
      const product = await updatePharmacyProductStock(
        deps.pool,
        paramsParsed.data.id,
        claims,
        bodyParsed.data,
        deps.s3Config,
      );
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      return reply.status(200).send({ product });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  }

  app.patch("/v1/pharmacy/products/:id/stock", handleProductPatch);
  app.patch("/v1/pharmacy/products/:id", handleProductPatch);

  app.post("/v1/pharmacy/orders", async (request, reply) => {
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

    const parsed = CreatePharmacyOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const order = await createPharmacyOrderAtomic(
        deps.pool,
        claims,
        parsed.data,
      );
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      return reply.status(201).send({ order });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  app.post(
    "/v1/pharmacy/orders/:id/confirm-payment",
    async (request, reply) => {
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

      const paramsParsed = UuidParamSchema.safeParse(request.params);
      const bodyParsed = ConfirmOrderPaymentSchema.safeParse(
        request.body ?? {},
      );
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "INVALID_PAYLOAD" });
      }

      if (
        bodyParsed.data.paymentMethod === "CARD_SIMULATED" &&
        !isSimulatedCardAllowed(deps.allowSimulatedPayments)
      ) {
        return reply.status(403).send({
          error: "PAYMENT_PROVIDER_REQUIRED",
          message:
            "Simulated card checkout is disabled in production; complete payment via PSP webhook or choose Pay on Delivery / Insurance Copay.",
        });
      }

      try {
        const order = await confirmPharmacyOrderPayment(
          deps.pool,
          deps.redis,
          paramsParsed.data.id,
          claims,
          bodyParsed.data,
        );
        return reply.status(200).send({ order });
      } catch (err) {
        return mapPharmacyError(err, reply);
      }
    },
  );

  app.get("/v1/pharmacy/orders", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      {
        authSecret: deps.authSecret,
        pool: deps.pool,
        redis: deps.redis,
      },
      [
        "PATIENT",
        "CAREGIVER",
        "PHARMACIST",
        "HOSPITAL_ADMIN",
        "DRIVER",
        "OPS_ADMIN",
      ],
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const parsed = OrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    const orders = await listPharmacyOrdersScoped(deps.pool, claims, {
      ...(parsed.data.countryCode
        ? { countryCode: parsed.data.countryCode }
        : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      limit: parsed.data.limit,
    });
    return { orders };
  });

  app.patch("/v1/pharmacy/orders/:id/status", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      undefined,
      { requireVerifiedProvider: deps.requireProviderVerification },
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = UpdatePharmacyOrderStatusSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const order = await updatePharmacyOrderStatusAtomic(
        deps.pool,
        deps.redis,
        paramsParsed.data.id,
        claims,
        bodyParsed.data,
      );
      if (order.status === "CANCELLED") {
        await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      }
      return reply.status(200).send({ order });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  const MAX_WEBHOOK_BYTES = 1_048_576;

  app.post(
    "/v1/payments/webhook",
    {
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        for await (const chunk of payload) {
          const bufChunk = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk as string);
          totalBytes += bufChunk.byteLength;
          if (totalBytes > MAX_WEBHOOK_BYTES) {
            const limitErr = new Error("Payment webhook payload exceeds 1 MiB limit.") as Error & {
              statusCode: number;
              code: string;
            };
            limitErr.statusCode = 413;
            limitErr.code = "WEBHOOK_PAYLOAD_TOO_LARGE";
            throw limitErr;
          }
          chunks.push(bufChunk);
        }
        const buf = Buffer.concat(chunks);
        (request as typeof request & { rawWebhookBody?: string }).rawWebhookBody =
          buf.toString("utf8");
        const { Readable } = await import("node:stream");
        return Readable.from(buf);
      },
    },
    async (request, reply) => {
      const secret =
        deps.paymentWebhookSecret ?? process.env.PAYMENT_WEBHOOK_SECRET;
      if (!secret) {
        return reply.status(503).send({
          error: "PAYMENT_WEBHOOK_NOT_CONFIGURED",
          message: "Payment webhook signing secret is not configured.",
        });
      }

      const signatureHeader =
        typeof request.headers["x-medisync-signature"] === "string"
          ? request.headers["x-medisync-signature"]
          : undefined;
      const rawBody =
        (request as typeof request & { rawWebhookBody?: string }).rawWebhookBody ??
        JSON.stringify(request.body ?? {});
      if (!verifyPaymentWebhookSignature(rawBody, signatureHeader, secret)) {
        return reply.status(401).send({ error: "INVALID_WEBHOOK_SIGNATURE" });
      }

      const parsed = PaymentWebhookEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_WEBHOOK_PAYLOAD",
          issues: parsed.error.issues,
        });
      }

      try {
        const result = await settlePaymentWebhookAtomic(
          deps.pool,
          deps.redis,
          parsed.data,
        );
        return reply.status(200).send(result);
      } catch (err) {
        return mapPharmacyError(err, reply);
      }
    },
  );
}
