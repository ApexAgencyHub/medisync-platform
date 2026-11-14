import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  ConfirmOrderPaymentSchema,
  CreatePharmacyOrderSchema,
  CreatePharmacyProductSchema,
  ListPharmacyProductsQuerySchema,
  UpdatePharmacyOrderStatusSchema,
  type UserRole,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
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
  updatePharmacyOrderStatusAtomic,
  updatePharmacyProductStock,
} from "./pg-store.js";

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const UpdateStockBodySchema = z.object({
  stockQty: z.coerce.number().int().min(0).max(100_000).optional(),
  priceMinor: z.coerce.number().int().min(10).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
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

    const cacheKey = `pharmacy-products:${JSON.stringify(parsed.data)}`;
    const products = await withGenerationCache(
      deps.redis,
      DIRECTORY_CACHE_GEN_KEY,
      cacheKey,
      30,
      () => listPharmacyProducts(deps.pool, parsed.data, deps.s3Config),
    );
    return { products };
  });

  app.post("/v1/pharmacy/products", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PRODUCT_MANAGER_ROLES,
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
      await deps.redis.incr("medisync:cache:gen:directory").catch(() => undefined);
      return reply.status(201).send({ product });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  app.patch("/v1/pharmacy/products/:id/stock", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      PRODUCT_MANAGER_ROLES,
    );
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = UpdateStockBodySchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const patch = {
        ...(bodyParsed.data.stockQty !== undefined
          ? { stockQty: bodyParsed.data.stockQty }
          : {}),
        ...(bodyParsed.data.priceMinor !== undefined
          ? { priceMinor: bodyParsed.data.priceMinor }
          : {}),
        ...(bodyParsed.data.isActive !== undefined
          ? { isActive: bodyParsed.data.isActive }
          : {}),
      };
      const product = await updatePharmacyProductStock(
        deps.pool,
        paramsParsed.data.id,
        claims,
        patch,
        deps.s3Config,
      );
      await deps.redis.incr("medisync:cache:gen:directory").catch(() => undefined);
      return reply.status(200).send({ product });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  app.post("/v1/pharmacy/orders", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
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
      await deps.redis.incr("medisync:cache:gen:directory").catch(() => undefined);
      return reply.status(201).send({ order });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });

  app.post(
    "/v1/pharmacy/orders/:id/confirm-payment",
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply, {
        authSecret: deps.authSecret,
        pool: deps.pool,
        redis: deps.redis,
      });
      if (!claims) return;

      const paramsParsed = UuidParamSchema.safeParse(request.params);
      const bodyParsed = ConfirmOrderPaymentSchema.safeParse(
        request.body ?? {},
      );
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "INVALID_PAYLOAD" });
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
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
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
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const paramsParsed = UuidParamSchema.safeParse(request.params);
    const bodyParsed = UpdatePharmacyOrderStatusSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    try {
      const order = await updatePharmacyOrderStatusAtomic(
        deps.pool,
        paramsParsed.data.id,
        claims,
        bodyParsed.data,
      );
      return reply.status(200).send({ order });
    } catch (err) {
      return mapPharmacyError(err, reply);
    }
  });
}
