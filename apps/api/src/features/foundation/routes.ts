import type { FastifyInstance } from "fastify";
import { UserRoleSchema } from "@medisync/contracts";

export async function registerFoundationRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "medisync-api",
      rolesCount: UserRoleSchema.options.length,
      timestamp: new Date().toISOString(),
    };
  });
}
