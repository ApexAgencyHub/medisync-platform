import { Pool } from "pg";

export interface DbPoolOptions {
  max?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleInTransactionTimeoutMs?: number;
}

export function createDbPool(
  databaseUrl: string,
  options: DbPoolOptions = {},
): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: options.max ?? 25,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: options.statementTimeoutMs ?? 15_000,
    lock_timeout: options.lockTimeoutMs ?? 5_000,
    idle_in_transaction_session_timeout:
      options.idleInTransactionTimeoutMs ?? 10_000,
    keepAlive: true,
    maxUses: 7_500,
    application_name: "medisync-api",
  });

  // Prevent transient idle socket resets from crashing the Fastify process.
  pool.on("error", (err) => {
    if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
      process.stderr.write(
        `[medisync-db-pool] idle client error: ${err.message}\n`,
      );
    }
  });
  return pool;
}
