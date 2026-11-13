import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Pool } from "pg";
import { registerFoundationRoutes } from "./features/foundation/index.js";
import { registerCountryPackRoutes } from "./features/country-packs/index.js";
import { createDbPool } from "./shared/db/pool.js";
import { runMigrations } from "./shared/db/migrate.js";

export interface BuildServerOptions {
  databaseUrl: string;
  authSecret: string;
  corsOrigins?: readonly string[];
  pool?: Pool;
  runDbMigrations?: boolean;
}

export async function buildApiServer(
  options: BuildServerOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const ownsPool = !options.pool;
  const pool = options.pool ?? createDbPool(options.databaseUrl);

  if (options.runDbMigrations !== false) {
    await runMigrations(pool);
  }

  const allowedOrigins = options.corsOrigins ?? [];
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
  });

  await registerFoundationRoutes(app, {
    pool,
    authSecret: options.authSecret,
  });
  await registerCountryPackRoutes(app);

  if (ownsPool) {
    app.addHook("onClose", async () => {
      await pool.end();
    });
  }

  return app;
}
