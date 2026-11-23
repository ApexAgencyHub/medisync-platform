import type { FastifyInstance } from "fastify";
import { registerClinicalRoutes as registerRawClinicalRoutes } from "./routes.js";
import { findMedicationAllergyWarnings } from "./pg-store.js";

export { signPrescriptionQr } from "./qr-crypto.js";

export async function registerClinicalRoutes(
  app: FastifyInstance,
  deps: Parameters<typeof registerRawClinicalRoutes>[1],
): Promise<void> {
  await app.register(async (clinicalScope) => {
    clinicalScope.addHook(
      "preSerialization",
      async (request, reply, payload) => {
        if (
          request.method === "POST" &&
          reply.statusCode >= 200 &&
          reply.statusCode < 300 &&
          (request.url.startsWith("/v1/clinical/prescriptions") &&
            !request.url.includes("/dispense")) &&
          typeof payload === "object" &&
          payload !== null &&
          "prescription" in payload
        ) {
          const record = payload as {
            prescription?: {
              patientUserId?: string;
              medications?: Array<{ name: string }>;
            };
          };
          if (
            record.prescription?.patientUserId &&
            Array.isArray(record.prescription.medications)
          ) {
            const allergyWarnings = await findMedicationAllergyWarnings(
              deps.pool,
              record.prescription.patientUserId,
              record.prescription.medications,
            );
            if (allergyWarnings.length > 0) {
              return { ...record, allergyWarnings };
            }
          }
        }
        return payload;
      },
    );

    await registerRawClinicalRoutes(clinicalScope, deps);
  });
}
