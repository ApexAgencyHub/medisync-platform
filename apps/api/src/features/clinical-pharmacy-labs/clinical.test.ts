import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  ClinicalMediaListResponse,
  FacilitySummary,
  LabOrderResponse,
  PresignedUploadResponse,
  PrescriptionResponse,
  VerifyPrescriptionQrResponse,
  VisitNoteResponse,
  VisitNotesListResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 4 clinical-pharmacy-labs: SOAP notes, QR e-prescriptions, lab orders & S3 SigV4", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseBase = Math.floor(300000 + crypto.randomInt(0, 600000));
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdVisitNoteIds: string[] = [];
  const createdPrescriptionIds: string[] = [];
  const createdLabOrderIds: string[] = [];
  const createdMediaIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    pool = createDbPool(databaseUrl);
    redis = createRedisClient(redisUrl);
    await runMigrations(pool);

    app = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      pool,
      redis,
      runDbMigrations: false,
    });
  });

  afterAll(async () => {
    if (createdMediaIds.length > 0) {
      await pool.query(
        "DELETE FROM clinical_media_objects WHERE id = ANY($1::uuid[])",
        [createdMediaIds],
      );
    }
    if (createdLabOrderIds.length > 0) {
      await pool.query("DELETE FROM lab_orders WHERE id = ANY($1::uuid[])", [
        createdLabOrderIds,
      ]);
    }
    if (createdPrescriptionIds.length > 0) {
      await pool.query("DELETE FROM prescriptions WHERE id = ANY($1::uuid[])", [
        createdPrescriptionIds,
      ]);
    }
    if (createdVisitNoteIds.length > 0) {
      await pool.query("DELETE FROM visit_notes WHERE id = ANY($1::uuid[])", [
        createdVisitNoteIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    if (createdFacilityIds.length > 0) {
      await pool.query("DELETE FROM facilities WHERE id = ANY($1::uuid[])", [
        createdFacilityIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }

    await app.close();
    await redis.quit();
    await pool.end();
  });

  async function registerAccount(input: {
    email: string;
    fullName: string;
    role: "PATIENT" | "DOCTOR" | "NURSE" | "PHARMACIST" | "LAB_TECH";
    countryCode: string;
  }): Promise<AuthResponse> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: input.email,
        password: "StrongPassword!123",
        fullName: input.fullName,
        role: input.role,
        countryCode: input.countryCode,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<AuthResponse>();
    createdUserIds.push(body.user.id);
    return body;
  }

  it("enforces clinical RBAC, verifies HMAC QR tokens, prevents concurrent double-dispensing, and signs S3 SigV4 uploads", async () => {
    const doctor = await registerAccount({
      email: `dr.clin.${runSuffix}@medisync.ma`,
      fullName: "Dr. Tariq Alami",
      role: "DOCTOR",
      countryCode: "MA",
    });
    const pharmacist = await registerAccount({
      email: `rx.pharm.${runSuffix}@medisync.ma`,
      fullName: "Salima Pharma",
      role: "PHARMACIST",
      countryCode: "MA",
    });
    const labTech = await registerAccount({
      email: `lab.tech.${runSuffix}@medisync.ma`,
      fullName: "Omar Diag",
      role: "LAB_TECH",
      countryCode: "MA",
    });
    const patient = await registerAccount({
      email: `pat.clin.${runSuffix}@medisync.ma`,
      fullName: "Aicha Benjelloun",
      role: "PATIENT",
      countryCode: "MA",
    });
    const otherPatient = await registerAccount({
      email: `pat.other.${runSuffix}@medisync.ma`,
      fullName: "Rachid Other",
      role: "PATIENT",
      countryCode: "MA",
    });
    const frPharmacist = await registerAccount({
      email: `rx.fr.${runSuffix}@medisync.fr`,
      fullName: "Jean Pharmacie",
      role: "PHARMACIST",
      countryCode: "FR",
    });

    const labRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${labTech.token}` },
      payload: {
        name: `Laboratoire Anfa ${runSuffix}`,
        kind: "DIAGNOSTIC_LAB",
        countryCode: "MA",
        licenseNumber: `MA-LAB-${licenseBase}`,
        lat: 33.575,
        lng: -7.61,
        address: "Rue Zerktouni, Casablanca",
      },
    });
    expect(labRes.statusCode).toBe(201);
    const labFacility = labRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(labFacility.id);

    const pharmacyRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${pharmacist.token}` },
      payload: {
        name: `Pharmacie Centrale ${runSuffix}`,
        kind: "PHARMACY",
        countryCode: "MA",
        licenseNumber: `MA-PHM-${licenseBase}`,
        lat: 33.571,
        lng: -7.59,
        address: "Avenue Hassan II, Casablanca",
      },
    });
    expect(pharmacyRes.statusCode).toBe(201);
    const pharmacyFacility = pharmacyRes.json<{ facility: FacilitySummary }>()
      .facility;
    createdFacilityIds.push(pharmacyFacility.id);

    // 1. Pharmacist cannot write SOAP visit notes (403)
    const forbiddenSoap = await app.inject({
      method: "POST",
      url: "/v1/clinical/visit-notes",
      headers: { authorization: `Bearer ${pharmacist.token}` },
      payload: {
        patientUserId: patient.user.id,
        subjective: "Unauthorized write",
        objective: "N/A",
        assessment: "N/A",
        plan: "N/A",
      },
    });
    expect(forbiddenSoap.statusCode).toBe(403);

    // 2. Doctor writes SOAP visit note for patient
    const noteRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/visit-notes",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        patientUserId: patient.user.id,
        icd10Codes: ["J06.9"],
        subjective: "Dry cough and mild fever for 48 hours.",
        objective: "Clear lung fields, SpO2 99%.",
        assessment: "Acute upper respiratory infection",
        plan: "Amoxicillin 1g BID x7d + CBC panel if persistent",
        vitals: { temperatureC: 37.9, systolicMmHg: 118, diastolicMmHg: 76 },
      },
    });
    expect(noteRes.statusCode).toBe(201);
    const note = noteRes.json<VisitNoteResponse>().visitNote;
    createdVisitNoteIds.push(note.id);

    // Patient reads own notes; cannot query another patient's records (403)
    const ownNotesRes = await app.inject({
      method: "GET",
      url: "/v1/clinical/visit-notes",
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(ownNotesRes.statusCode).toBe(200);
    expect(
      ownNotesRes
        .json<VisitNotesListResponse>()
        .visitNotes.some((n) => n.id === note.id),
    ).toBe(true);

    const snoopingRes = await app.inject({
      method: "GET",
      url: `/v1/clinical/visit-notes?patientUserId=${patient.user.id}`,
      headers: { authorization: `Bearer ${otherPatient.token}` },
    });
    expect(snoopingRes.statusCode).toBe(403);

    // 3. Doctor issues signed QR e-prescription
    const rxRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        patientUserId: patient.user.id,
        medications: [
          {
            name: "Amoxicillin",
            dosage: "1000 mg",
            frequency: "Twice daily",
            durationDays: 7,
          },
        ],
        notes: "Take after meals",
      },
    });
    expect(rxRes.statusCode).toBe(201);
    const rx = rxRes.json<PrescriptionResponse>().prescription;
    createdPrescriptionIds.push(rx.id);
    expect(rx.qrToken.startsWith("v1.")).toBe(true);

    // Tampered QR token rejected (400)
    const tamperedQr = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions/verify-qr",
      headers: { authorization: `Bearer ${pharmacist.token}` },
      payload: {
        qrToken: `${rx.qrToken.slice(0, -4)}ffff`,
      },
    });
    expect(tamperedQr.statusCode).toBe(400);

    // Cross-country pharmacist (FR) blocked from MA prescription (403)
    const crossCountryQr = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions/verify-qr",
      headers: { authorization: `Bearer ${frPharmacist.token}` },
      payload: { qrToken: rx.qrToken },
    });
    expect(crossCountryQr.statusCode).toBe(403);

    // Valid MA pharmacist QR verification succeeds
    const validQr = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions/verify-qr",
      headers: { authorization: `Bearer ${pharmacist.token}` },
      payload: { qrToken: rx.qrToken },
    });
    expect(validQr.statusCode).toBe(200);
    expect(validQr.json<VerifyPrescriptionQrResponse>().valid).toBe(true);

    // Concurrent double-dispensing race: 3 simultaneous requests -> exactly 1 200 and 2 409!
    const dispenseRace = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/clinical/prescriptions/${rx.id}/dispense`,
        headers: { authorization: `Bearer ${pharmacist.token}` },
        payload: {
          pharmacyFacilityId: pharmacyFacility.id,
          dispensingNote: "Batch #112A",
        },
      }),
      app.inject({
        method: "POST",
        url: `/v1/clinical/prescriptions/${rx.id}/dispense`,
        headers: { authorization: `Bearer ${pharmacist.token}` },
        payload: {
          pharmacyFacilityId: pharmacyFacility.id,
          dispensingNote: "Batch #112B",
        },
      }),
      app.inject({
        method: "POST",
        url: `/v1/clinical/prescriptions/${rx.id}/dispense`,
        headers: { authorization: `Bearer ${pharmacist.token}` },
        payload: {
          pharmacyFacilityId: pharmacyFacility.id,
          dispensingNote: "Batch #112C",
        },
      }),
    ]);

    expect(dispenseRace.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(dispenseRace.filter((r) => r.statusCode === 409)).toHaveLength(2);

    // 4. Lab order + S3 SigV4 presigned URL + Lab Tech completion
    const orderRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/lab-orders",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        patientUserId: patient.user.id,
        facilityId: labFacility.id,
        panelName: "Complete Blood Count + CRP",
        urgency: "URGENT",
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const labOrder = orderRes.json<LabOrderResponse>().labOrder;
    createdLabOrderIds.push(labOrder.id);

    // Disallowed MIME rejected cleanly (400)
    const badMime = await app.inject({
      method: "POST",
      url: "/v1/clinical/media/presign-upload",
      headers: { authorization: `Bearer ${labTech.token}` },
      payload: {
        patientUserId: patient.user.id,
        labOrderId: labOrder.id,
        fileName: "script.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 2048,
      },
    });
    expect(badMime.statusCode).toBe(400);

    // Valid S3 SigV4 presign generated for PDF report
    const presignRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/media/presign-upload",
      headers: { authorization: `Bearer ${labTech.token}` },
      payload: {
        patientUserId: patient.user.id,
        labOrderId: labOrder.id,
        fileName: "cbc-crp-report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 420_000,
      },
    });
    expect(presignRes.statusCode).toBe(201);
    const presigned = presignRes.json<PresignedUploadResponse>();
    createdMediaIds.push(presigned.mediaObject.id);

    const parsedUploadUrl = new URL(presigned.uploadUrl);
    expect(parsedUploadUrl.searchParams.get("X-Amz-Algorithm")).toBe(
      "AWS4-HMAC-SHA256",
    );
    expect(parsedUploadUrl.searchParams.get("X-Amz-Signature")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(parsedUploadUrl.pathname).toContain(presigned.mediaObject.objectKey);

    // Patient lists media objects (sees download URL)
    const patientMediaRes = await app.inject({
      method: "GET",
      url: "/v1/clinical/media",
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(patientMediaRes.statusCode).toBe(200);
    expect(
      patientMediaRes
        .json<ClinicalMediaListResponse>()
        .mediaObjects.some((m) => m.id === presigned.mediaObject.id),
    ).toBe(true);

    // Lab Tech transitions lab order to COMPLETED with S3 report key
    const completeLabRes = await app.inject({
      method: "PATCH",
      url: `/v1/clinical/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${labTech.token}` },
      payload: {
        status: "COMPLETED",
        resultSummary: "WBC mildly elevated at 11.4 x10^9/L, CRP 18 mg/L",
        reportObjectKey: presigned.mediaObject.objectKey,
      },
    });
    expect(completeLabRes.statusCode).toBe(200);
    expect(completeLabRes.json<LabOrderResponse>().labOrder.status).toBe(
      "COMPLETED",
    );

    // 5. Nurse (NURSE) role writes nursing vitals/care notes and lab orders, while Doctor-only E-Rx remains 403
    const nurse = await registerAccount({
      email: `rn.care.${runSuffix}@medisync.ma`,
      fullName: "Kenza HomeCare RN",
      role: "NURSE",
      countryCode: "MA",
    });

    const nurseNoteRes = await app.inject({
      method: "POST",
      url: "/v1/clinical/visit-notes",
      headers: { authorization: `Bearer ${nurse.token}` },
      payload: {
        patientUserId: patient.user.id,
        subjective: "Post-op dressing check & vital signs",
        objective: "BP 118/76 mmHg, SpO2 98%, Afebrile",
        assessment: "Clean incision healing",
        plan: "Continue sterile dressing in 48h",
        icd10Codes: ["Z48.0"],
      },
    });
    expect(nurseNoteRes.statusCode).toBe(201);
    createdVisitNoteIds.push(nurseNoteRes.json<VisitNoteResponse>().visitNote.id);

    const nurseForbiddenRx = await app.inject({
      method: "POST",
      url: "/v1/clinical/prescriptions",
      headers: { authorization: `Bearer ${nurse.token}` },
      payload: {
        patientUserId: patient.user.id,
        medications: [
          {
            name: "Amoxicillin",
            dosage: "500 mg",
            frequency: "Twice daily",
            durationDays: 5,
          },
        ],
      },
    });
    expect(nurseForbiddenRx.statusCode).toBe(403);
  });
});
