import { buildApiServer } from "./server.js";
import { loadApiEnv } from "./shared/env.js";

const env = loadApiEnv();
const server = await buildApiServer();
await server.listen({ port: env.PORT, host: env.HOST });
