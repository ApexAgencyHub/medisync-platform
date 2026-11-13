import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApiServer } from "../../server.js";

describe("api foundation & country-packs", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApiServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health status with all 9 roles registered", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; rolesCount: number }>();
    expect(body.status).toBe("ok");
    expect(body.rolesCount).toBe(9);
  });

  it("lists country packs and validates facility license formats", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/country-packs",
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json<{ packs: Array<{ code: string }> }>();
    expect(listBody.packs.length).toBeGreaterThanOrEqual(4);

    const checkRes = await app.inject({
      method: "POST",
      url: "/v1/country-packs/validate-license",
      payload: { countryCode: "MA", licenseNumber: "MA-CLIN-90812" },
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json<{ valid: boolean }>().valid).toBe(true);
  });
});
