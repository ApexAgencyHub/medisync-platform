import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listCountryPacks,
  resolveCountryPack,
  validateFacilityLicense,
} from "@medisync/country-packs";

const LicenseCheckSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  licenseNumber: z.string().min(2),
});

export async function registerCountryPackRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/v1/country-packs", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { packs: listCountryPacks() };
  });

  app.get<{ Params: { code: string } }>(
    "/v1/country-packs/:code",
    async (request, reply) => {
      reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return { pack: resolveCountryPack(request.params.code) };
    },
  );

  app.post("/v1/country-packs/validate-license", async (request, reply) => {
    const parsed = LicenseCheckSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const valid = validateFacilityLicense(
      parsed.data.countryCode,
      parsed.data.licenseNumber,
    );
    return { valid, countryCode: parsed.data.countryCode };
  });
}
