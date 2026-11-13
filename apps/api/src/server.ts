import Fastify, { type FastifyInstance } from "fastify";
import { registerFoundationRoutes } from "./features/foundation/index.js";
import { registerCountryPackRoutes } from "./features/country-packs/index.js";

export async function buildApiServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await registerFoundationRoutes(app);
  await registerCountryPackRoutes(app);
  return app;
}
