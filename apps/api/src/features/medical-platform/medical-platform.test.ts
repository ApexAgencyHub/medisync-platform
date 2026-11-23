import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  MedicalInvoiceSummary,
  MedicalServiceSummary,
  PatientInsurancePolicy,
  PatientMedicalProfile,
  PresignedUploadResponse,
  UserPresignedUploadResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import {
  deleteS3Object,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import { SEEDED_DEMO_PASSWORD } from "../directory/pg-store.js";
import { seedRealisticWorld } from "../directory/seed-world.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

const TEST_S3_CONFIG: S3PresignConfig = {
  endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9010",
  region: process.env.S3_REGION ?? "us-east-1",
  bucket: process.env.S3_BUCKET ?? "medisync-clinical-media",
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "medisync-dev-s3-access-key",
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY ??
    "medisync-dev-s3-secret-key-min-32-chars",
  expiresInSeconds: 900,
};

const SAMPLE_PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);
const SAMPLE_TIFF_BYTES = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
]);
const SAMPLE_DICOM_BYTES = Buffer.concat([
  Buffer.alloc(128, 0),
  Buffer.from("DICM\x02\x00\x00\x00UL\x04\x00\x00\x00\x00\x00", "latin1"),
]);
const SAMPLE_WAV_BYTES = Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt ", "latin1");
const SAMPLE_FHIR_BYTES = Buffer.from(
  JSON.stringify({ resourceType: "DiagnosticReport", status: "final" }),
  "utf8",
);
const SAMPLE_CSV_BYTES = Buffer.from(
  "date,systolic,diastolic,bpm\n2026-11-14,122,78,68\n",
  "utf8",
);
const MALICIOUS_HTML_BYTES = Buffer.from(
  "<!DOCTYPE html><html><script>alert(1)</script></html>",
  "utf8",
);

async function loginSeededAccount(
  app: FastifyInstance,
  email: string,
): Promise<AuthResponse> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: SEEDED_DEMO_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json<AuthResponse>();
}

describe("phase 8 enterprise medical backend: EHR, insurance, billing, MinIO formats & security governance", () => {
  let pool: Pool;
  let redis: Redis;
  let openApp: FastifyInstance;
  let strictApp: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdClinicalMediaIds: string[] = [];
  const createdUserMediaIds: string[] = [];
  const uploadedS3Keys: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    pool = createDbPool(databaseUrl);
    redis = createRedisClient(redisUrl);
    await runMigrations(pool);

    openApp = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: true,
    });

    strictApp = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      allowPublicRegistration: false,
      requireProviderVerification: true,
    });
  });

  afterAll(async () => {
    for (const key of uploadedS3Keys) {
      await deleteS3Object(TEST_S3_CONFIG, key);
    }
    if (createdInvoiceIds.length > 0) {
      await pool.query(
        "DELETE FROM medical_invoices WHERE id = ANY($1::uuid[])",
        [createdInvoiceIds],
      );
    }
    if (createdPolicyIds.length > 0) {
      await pool.query(
        "DELETE FROM patient_insurance_policies WHERE id = ANY($1::uuid[])",
        [createdPolicyIds],
      );
    }
    if (createdServiceIds.length > 0) {
      await pool.query(
        "DELETE FROM medical_services WHERE id = ANY($1::uuid[])",
        [createdServiceIds],
      );
    }
    if (createdClinicalMediaIds.length > 0) {
      await pool.query(
        "DELETE FROM clinical_media_objects WHERE id = ANY($1::uuid[])",
        [createdClinicalMediaIds],
      );
    }
    if (createdUserMediaIds.length > 0) {
      await pool.query(
        "DELETE FROM user_media_documents WHERE id = ANY($1::uuid[])",
        [createdUserMediaIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM patient_medical_profiles WHERE user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query(
        "DELETE FROM doctor_schedules WHERE doctor_user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR resource_id = ANY($2::text[])",
        [createdUserIds, createdUserIds],
      );
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    await strictApp.close();
    await openApp.close();
    await redis.quit();
    await pool.end();
  });

  it("exposes deep readiness check and hardened security response headers", async () => {
    await seedRealisticWorld(pool, redis, TEST_AUTH_SECRET);

    const readyRes = await openApp.inject({
      method: "GET",
      url: "/ready",
    });
    expect(readyRes.statusCode).toBe(200);
    expect(readyRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(readyRes.headers["x-frame-options"]).toBe("DENY");
    expect(readyRes.headers["x-request-id"]).toBeTruthy();
    expect(readyRes.headers["content-security-policy"]).toContain("frame-ancestors 'none'");

    const readyBody = readyRes.json<{
      status: string;
      checks: {
        postgres: string;
        redis: string;
        minio: string;
        minioBucketReady: boolean;
      };
    }>();
    expect(readyBody.status).toBe("ready");
    expect(readyBody.checks.postgres).toBe("OK");
    expect(readyBody.checks.redis).toBe("OK");
    expect(readyBody.checks.minio).toBe("OK");
    expect(readyBody.checks.minioBucketReady).toBe(true);
  });

  it("supports Patient EHR profiles, Insurance Policies, Medical Services Marketplace & Idempotent Billing", async () => {
    const opsAuth = await loginSeededAccount(openApp, "ops.admin@medisync.global");
    const maDoctorAuth = await loginSeededAccount(openApp, "doctor.ma@medisync.global");
    const intlDoctorAuth = await loginSeededAccount(openApp, "doctor.intl@medisync.global");
    const maDriverAuth = await loginSeededAccount(openApp, "driver.ma@medisync.global");
    const maPatientAuth = await loginSeededAccount(openApp, "patient.ma@medisync.global");

    // 1. Create a fresh test patient in MA so test state stays isolated
    const testPatientRes = await openApp.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `p8-patient-${runSuffix}@medisync.test`,
        password: "StrongPassword!123",
        fullName: "Nadia Phase8 Patient",
        role: "PATIENT",
        countryCode: "MA",
      },
    });
    expect(testPatientRes.statusCode).toBe(201);
    const patientAuth = testPatientRes.json<AuthResponse>();
    createdUserIds.push(patientAuth.user.id);

    // 2. Patient upserts their own EHR medical profile
    const putProfileRes = await openApp.inject({
      method: "PUT",
      url: "/v1/clinical/patients/me/profile",
      headers: { authorization: `Bearer ${patientAuth.token}` },
      payload: {
        dateOfBirth: "1992-05-14",
        biologicalSex: "FEMALE",
        bloodType: "O+",
        nationalHealthId: `AMO-${runSuffix}`,
        emergencyContactName: "Karim Test",
        emergencyContactPhone: "+212600001122",
        heightCm: 168.5,
        weightKg: 62.0,
        allergies: [
          {
            allergen: "Penicillin",
            severity: "SEVERE",
            reaction: "Urticaria rash",
          },
        ],
        chronicConditions: ["Mild Asthma"],
        currentMedications: ["Salbutamol Inhaler"],
      },
    });
    expect(putProfileRes.statusCode).toBe(200);
    const putProfileBody = putProfileRes.json<{ profile: PatientMedicalProfile }>();
    expect(putProfileBody.profile.bloodType).toBe("O+");
    expect(putProfileBody.profile.heightCm).toBe(168.5);
    expect(putProfileBody.profile.allergies[0]?.allergen).toBe("Penicillin");

    // Same-country doctor can view EHR; DRIVER and cross-country INTL doctor are blocked (403)
    const docReadRes = await openApp.inject({
      method: "GET",
      url: `/v1/clinical/patients/${patientAuth.user.id}/profile`,
      headers: { authorization: `Bearer ${maDoctorAuth.token}` },
    });
    expect(docReadRes.statusCode).toBe(200);

    const driverBlockedRes = await openApp.inject({
      method: "GET",
      url: `/v1/clinical/patients/${patientAuth.user.id}/profile`,
      headers: { authorization: `Bearer ${maDriverAuth.token}` },
    });
    expect(driverBlockedRes.statusCode).toBe(403);

    const crossCountryBlockedRes = await openApp.inject({
      method: "GET",
      url: `/v1/clinical/patients/${patientAuth.user.id}/profile`,
      headers: { authorization: `Bearer ${intlDoctorAuth.token}` },
    });
    expect(crossCountryBlockedRes.statusCode).toBe(403);

    // 3. Patient adds an insurance policy -> OPS_ADMIN marks it VERIFIED
    const createPolRes = await openApp.inject({
      method: "POST",
      url: "/v1/clinical/patients/me/insurances",
      headers: { authorization: `Bearer ${patientAuth.token}` },
      payload: {
        providerName: "CNOPS Mutuelle",
        policyNumber: `POL-${runSuffix}`,
        memberId: `MEM-${runSuffix}`,
        coveragePlan: "PREMIUM_AMO",
        coveragePercent: 80,
        validUntil: "2028-12-31",
        isPrimary: true,
      },
    });
    expect(createPolRes.statusCode).toBe(201);
    const createdPolicy = createPolRes.json<{ policy: PatientInsurancePolicy }>().policy;
    createdPolicyIds.push(createdPolicy.id);
    expect(createdPolicy.verificationStatus).toBe("PENDING");

    const verifyPolRes = await openApp.inject({
      method: "PATCH",
      url: `/v1/clinical/patients/${patientAuth.user.id}/insurances/${createdPolicy.id}`,
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: { verificationStatus: "VERIFIED" },
    });
    expect(verifyPolRes.statusCode).toBe(200);
    expect(verifyPolRes.json<{ policy: PatientInsurancePolicy }>().policy.verificationStatus).toBe("VERIFIED");

    // 4. Expanded Directory filters + Medical Services Catalog + Redis cache invalidation
    const docsFilterRes = await openApp.inject({
      method: "GET",
      url: "/v1/directory/doctors?countryCode=MA&specialty=Cardio&insurance=AMO&language=ar&telehealthOnly=true",
    });
    expect(docsFilterRes.statusCode).toBe(200);
    expect(docsFilterRes.json<{ doctors: unknown[] }>().doctors.length).toBeGreaterThanOrEqual(1);

    const servicesList1 = await openApp.inject({
      method: "GET",
      url: "/v1/directory/services?countryCode=MA&homeServiceOnly=true",
    });
    expect(servicesList1.statusCode).toBe(200);
    const initialServices = servicesList1.json<{ services: MedicalServiceSummary[] }>().services;
    expect(initialServices.length).toBeGreaterThanOrEqual(1);
    const maClinicId = initialServices[0]!.facilityId;
    // Actually fetch an MA facility ID via public facilities endpoint for clean service creation
    const facRes = await openApp.inject({
      method: "GET",
      url: "/v1/directory/facilities?countryCode=MA&kind=CLINIC",
    });
    expect(facRes.statusCode).toBe(200);
    const clinicId = facRes.json<{ facilities: Array<{ id: string }> }>().facilities[0]?.id ?? maClinicId;

    const createSvcRes = await openApp.inject({
      method: "POST",
      url: "/v1/directory/services",
      headers: { authorization: `Bearer ${maDoctorAuth.token}` },
      payload: {
        facilityId: clinicId,
        category: "TELEHEALTH",
        serviceCode: `P8-SVC-${runSuffix}`.toUpperCase(),
        name: `Phase8 Telehealth Stress Echo ${runSuffix}`,
        specialty: "Cardiology",
        priceMinor: 50000,
        durationMinutes: 30,
        homeServiceAvailable: false,
        telehealthAvailable: true,
      },
    });
    expect(createSvcRes.statusCode).toBe(201);
    const createdService = createSvcRes.json<{ service: MedicalServiceSummary }>().service;
    createdServiceIds.push(createdService.id);
    expect(createdService.currencyCode).toBe("MAD");

    // Immediately visible through Redis-cached catalog after generation bump
    const servicesList2 = await openApp.inject({
      method: "GET",
      url: `/v1/directory/services?countryCode=MA&q=Phase8&telehealthOnly=true`,
    });
    expect(servicesList2.statusCode).toBe(200);
    expect(
      servicesList2
        .json<{ services: MedicalServiceSummary[] }>()
        .services.some((s) => s.id === createdService.id),
    ).toBe(true);

    // 5. Idempotent Unified Invoice issuance + auto-insurance deduction + settlement
    const idemKey = `inv-${runSuffix}-1`;
    const issuePayload = {
      patientUserId: patientAuth.user.id,
      facilityId: clinicId,
      sourceType: "SERVICE",
      sourceId: createdService.id,
      description: "Phase8 Cardiology Teleconsultation",
      subtotalMinor: 50000,
      idempotencyKey: idemKey,
    };

    const invRes1 = await openApp.inject({
      method: "POST",
      url: "/v1/billing/invoices",
      headers: { authorization: `Bearer ${maDoctorAuth.token}` },
      payload: issuePayload,
    });
    expect(invRes1.statusCode).toBe(201);
    const invoice1 = invRes1.json<{ invoice: MedicalInvoiceSummary }>().invoice;
    createdInvoiceIds.push(invoice1.id);
    expect(invoice1.insuranceCoveredMinor).toBe(40000); // 80% of 50000
    expect(invoice1.patientPayableMinor).toBe(10000);
    expect(invoice1.status).toBe("PARTIALLY_COVERED");

    const invRes2 = await openApp.inject({
      method: "POST",
      url: "/v1/billing/invoices",
      headers: { authorization: `Bearer ${maDoctorAuth.token}` },
      payload: issuePayload,
    });
    expect(invRes2.statusCode).toBe(200);
    expect(invRes2.json<{ invoice: MedicalInvoiceSummary }>().invoice.id).toBe(invoice1.id);

    // Unrelated patient cannot pay another patient's invoice
    const wrongPayerRes = await openApp.inject({
      method: "POST",
      url: `/v1/billing/invoices/${invoice1.id}/pay`,
      headers: { authorization: `Bearer ${maPatientAuth.token}` },
      payload: { paymentMethod: "CARD" },
    });
    expect(wrongPayerRes.statusCode).toBe(403);

    // Owning patient pays atomically
    const payRes = await openApp.inject({
      method: "POST",
      url: `/v1/billing/invoices/${invoice1.id}/pay`,
      headers: { authorization: `Bearer ${patientAuth.token}` },
      payload: { paymentMethod: "CARD", paymentReference: `CMI-${runSuffix}` },
    });
    expect(payRes.statusCode).toBe(200);
    expect(payRes.json<{ invoice: MedicalInvoiceSummary }>().invoice.status).toBe("PAID");
  });

  it("accepts expanded clinical MinIO formats with SHA-256 verification and rejects & purges spoofed HTML payloads", async () => {
    const doctorAuth = await loginSeededAccount(openApp, "doctor.ma@medisync.global");
    const patientAuth = await loginSeededAccount(openApp, "patient.ma@medisync.global");

    const validUploads = [
      {
        fileName: "xray-scan.tiff",
        mimeType: "image/tiff",
        mediaCategory: "RADIOLOGY_SCAN",
        bytes: SAMPLE_TIFF_BYTES,
      },
      {
        fileName: "mri-slice.dcm",
        mimeType: "application/dicom",
        mediaCategory: "RADIOLOGY_SCAN",
        bytes: SAMPLE_DICOM_BYTES,
      },
      {
        fileName: "fhir-bundle.json",
        mimeType: "application/fhir+json",
        mediaCategory: "FHIR_BUNDLE",
        bytes: SAMPLE_FHIR_BYTES,
      },
      {
        fileName: "vitals-log.csv",
        mimeType: "text/csv",
        mediaCategory: "LAB_REPORT",
        bytes: SAMPLE_CSV_BYTES,
      },
      {
        fileName: "voice-note.wav",
        mimeType: "audio/wav",
        mediaCategory: "VOICE_NOTE",
        bytes: SAMPLE_WAV_BYTES,
      },
    ] as const;

    for (const item of validUploads) {
      const presignRes = await openApp.inject({
        method: "POST",
        url: "/v1/clinical/media/presign-upload",
        headers: { authorization: `Bearer ${doctorAuth.token}` },
        payload: {
          patientUserId: patientAuth.user.id,
          mediaCategory: item.mediaCategory,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.bytes.length,
        },
      });
      expect(presignRes.statusCode).toBe(201);
      const presigned = presignRes.json<PresignedUploadResponse>();
      createdClinicalMediaIds.push(presigned.mediaObject.id);
      uploadedS3Keys.push(presigned.mediaObject.objectKey);

      const putRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: presigned.requiredHeaders,
        body: new Uint8Array(item.bytes),
      });
      expect(putRes.ok).toBe(true);

      const confirmRes = await openApp.inject({
        method: "POST",
        url: `/v1/clinical/media/${presigned.mediaObject.id}/confirm`,
        headers: { authorization: `Bearer ${doctorAuth.token}` },
      });
      expect(confirmRes.statusCode).toBe(200);
      const confirmed = confirmRes.json<{
        mediaObject: {
          uploadStatus: string;
          mediaCategory: string;
          sha256Checksum?: string | null;
        };
      }>().mediaObject;
      expect(confirmed.uploadStatus).toBe("UPLOADED");
      expect(confirmed.mediaCategory).toBe(item.mediaCategory);
      expect(confirmed.sha256Checksum).toMatch(/^[a-f0-9]{64}$/);
    }

    // Spoofed XSS/HTML payload claiming to be text/csv must be rejected 422 AND deleted from MinIO
    const spoofPresign = await openApp.inject({
      method: "POST",
      url: "/v1/clinical/media/presign-upload",
      headers: { authorization: `Bearer ${doctorAuth.token}` },
      payload: {
        patientUserId: patientAuth.user.id,
        mediaCategory: "LAB_REPORT",
        fileName: "xss.csv",
        mimeType: "text/csv",
        sizeBytes: MALICIOUS_HTML_BYTES.length,
      },
    });
    expect(spoofPresign.statusCode).toBe(201);
    const spoofData = spoofPresign.json<PresignedUploadResponse>();
    createdClinicalMediaIds.push(spoofData.mediaObject.id);

    const spoofPut = await fetch(spoofData.uploadUrl, {
      method: "PUT",
      headers: spoofData.requiredHeaders,
      body: new Uint8Array(MALICIOUS_HTML_BYTES),
    });
    expect(spoofPut.ok).toBe(true);

    const spoofConfirm = await openApp.inject({
      method: "POST",
      url: `/v1/clinical/media/${spoofData.mediaObject.id}/confirm`,
      headers: { authorization: `Bearer ${doctorAuth.token}` },
    });
    expect(spoofConfirm.statusCode).toBe(422);

    // Object must have been purged from MinIO
    const downloadAfterReject = await fetch(spoofData.mediaObject.downloadUrl);
    expect(downloadAfterReject.status).toBe(404);
  });

  it("enforces single-admin lock, provider verification gate, immediate JWT revocation, suspension & OTP brute-force lockout", async () => {
    // 1. Public registration blocked when allowPublicRegistration=false
    const blockedReg = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `blocked-${runSuffix}@medisync.test`,
        password: "Password!123",
        fullName: "Blocked Public User",
        role: "PATIENT",
        countryCode: "MA",
      },
    });
    expect(blockedReg.statusCode).toBe(403);
    expect(blockedReg.json<{ error: string }>().error).toBe(
      "PUBLIC_REGISTRATION_DISABLED",
    );

    const opsAuth = await loginSeededAccount(strictApp, "ops.admin@medisync.global");

    // 2. OPS_ADMIN provisions unverified DOCTOR and unverified DRIVER
    const unverifiedDriverEmail = `p8-drv-${runSuffix}@medisync.test`;
    const drvCreateRes = await strictApp.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: {
        email: unverifiedDriverEmail,
        password: "DriverPassword!123",
        fullName: "Strict Mode Driver",
        role: "DRIVER",
        countryCode: "MA",
        accountStatus: "ACTIVE",
        credentialVerified: false,
      },
    });
    expect(drvCreateRes.statusCode).toBe(201);
    const createdDriver = drvCreateRes.json<{ user: AuthResponse["user"] }>().user;
    createdUserIds.push(createdDriver.id);

    const driverLoginRes = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: unverifiedDriverEmail, password: "DriverPassword!123" },
    });
    expect(driverLoginRes.statusCode).toBe(200);
    const driverJwt = driverLoginRes.json<AuthResponse>().token;

    // 3. Hard verification gate blocks unverified DRIVER ping
    const blockedPing = await strictApp.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverJwt}` },
      payload: { lat: 33.58, lng: -7.62, status: "AVAILABLE", headingDeg: 90 },
    });
    expect(blockedPing.statusCode).toBe(403);
    expect(blockedPing.json<{ error: string }>().error).toBe(
      "PROVIDER_VERIFICATION_REQUIRED",
    );

    // 4. Driver uploads DRIVER_LICENSE to MinIO -> OPS_ADMIN approves -> immediate dispatch access unlocked!
    const licensePresign = await strictApp.inject({
      method: "POST",
      url: "/v1/users/me/media/presign-upload",
      headers: { authorization: `Bearer ${driverJwt}` },
      payload: {
        category: "DRIVER_LICENSE",
        fileName: "permis-conduire.png",
        mimeType: "image/png",
        sizeBytes: SAMPLE_PNG_BYTES.length,
      },
    });
    expect(licensePresign.statusCode).toBe(201);
    const licenseData = licensePresign.json<UserPresignedUploadResponse>();
    createdUserMediaIds.push(licenseData.document.id);
    uploadedS3Keys.push(licenseData.document.objectKey);

    const putLicense = await fetch(licenseData.uploadUrl, {
      method: "PUT",
      headers: licenseData.requiredHeaders,
      body: new Uint8Array(SAMPLE_PNG_BYTES),
    });
    expect(putLicense.ok).toBe(true);

    const confirmLicense = await strictApp.inject({
      method: "POST",
      url: `/v1/users/me/media/${licenseData.document.id}/confirm`,
      headers: { authorization: `Bearer ${driverJwt}` },
    });
    expect(confirmLicense.statusCode).toBe(200);

    const approveLicense = await strictApp.inject({
      method: "PATCH",
      url: `/v1/admin/user-media/${licenseData.document.id}/review`,
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: { reviewStatus: "APPROVED", reviewerNote: "Permis C verified" },
    });
    expect(approveLicense.statusCode).toBe(200);

    // Immediately unblocked WITHOUT re-login because auth cache was evicted & guard reads live DB/cache!
    const allowedPing = await strictApp.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverJwt}` },
      payload: { lat: 33.58, lng: -7.62, status: "AVAILABLE", headingDeg: 90 },
    });
    expect(allowedPing.statusCode).toBe(200);

    // 5. Immediate JWT revocation on POST /v1/auth/logout
    const logoutRes = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { authorization: `Bearer ${driverJwt}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    const meAfterLogout = await strictApp.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${driverJwt}` },
    });
    expect(meAfterLogout.statusCode).toBe(401);
    expect(meAfterLogout.json<{ error: string }>().error).toBe("TOKEN_REVOKED");

    // 6. Fresh login -> OPS_ADMIN suspends account -> live token immediately rejected 403 & login rejected 403
    const freshLogin = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: unverifiedDriverEmail, password: "DriverPassword!123" },
    });
    expect(freshLogin.statusCode).toBe(200);
    const freshJwt = freshLogin.json<AuthResponse>().token;

    const suspendRes = await strictApp.inject({
      method: "PATCH",
      url: `/v1/admin/users/${createdDriver.id}/status`,
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: { accountStatus: "SUSPENDED", reason: "Compliance audit hold" },
    });
    expect(suspendRes.statusCode).toBe(200);

    const meSuspended = await strictApp.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${freshJwt}` },
    });
    expect(meSuspended.statusCode).toBe(403);
    expect(meSuspended.json<{ error: string }>().error).toBe("ACCOUNT_SUSPENDED");

    const loginSuspended = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: unverifiedDriverEmail, password: "DriverPassword!123" },
    });
    expect(loginSuspended.statusCode).toBe(403);

    // Reactivate driver to test OTP lockout & password reset session invalidation
    const reactivateRes = await strictApp.inject({
      method: "PATCH",
      url: `/v1/admin/users/${createdDriver.id}/status`,
      headers: { authorization: `Bearer ${opsAuth.token}` },
      payload: { accountStatus: "ACTIVE", credentialVerified: true },
    });
    expect(reactivateRes.statusCode).toBe(200);

    const activeAgain = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: unverifiedDriverEmail, password: "DriverPassword!123" },
    });
    expect(activeAgain.statusCode).toBe(200);
    const activeTokenBeforeReset = activeAgain.json<AuthResponse>().token;

    // 7. OTP brute-force 5-attempt lockout -> 429
    const otpReq1 = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email: unverifiedDriverEmail, purpose: "RESET_PASSWORD" },
    });
    expect(otpReq1.statusCode).toBe(200);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const badReset = await strictApp.inject({
        method: "POST",
        url: "/v1/auth/password-reset",
        payload: {
          email: unverifiedDriverEmail,
          code: "000000",
          newPassword: "RotatedPassword!999",
        },
      });
      expect(badReset.statusCode).toBe(400);
    }

    const fifthLockedReset = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: {
        email: unverifiedDriverEmail,
        code: "000000",
        newPassword: "RotatedPassword!999",
      },
    });
    expect(fifthLockedReset.statusCode).toBe(429);
    expect(fifthLockedReset.json<{ error: string }>().error).toBe(
      "OTP_ATTEMPTS_EXCEEDED",
    );

    // 8. Valid password reset bumps token_version and invalidates prior active JWTs
    const otpReq2 = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email: unverifiedDriverEmail, purpose: "RESET_PASSWORD" },
    });
    expect(otpReq2.statusCode).toBe(200);
    const validOtp = otpReq2.json<{ devPreviewCode?: string }>().devPreviewCode;
    expect(validOtp).toMatch(/^\d{6}$/);

    const goodReset = await strictApp.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: {
        email: unverifiedDriverEmail,
        code: validOtp,
        newPassword: "RotatedPassword!999",
      },
    });
    expect(goodReset.statusCode).toBe(200);

    const oldTokenAfterReset = await strictApp.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${activeTokenBeforeReset}` },
    });
    expect(oldTokenAfterReset.statusCode).toBe(401);
    expect(oldTokenAfterReset.json<{ error: string }>().error).toBe(
      "SESSION_INVALIDATED",
    );

    // 9. Explicit auth rate-limiter sub-bucket enforces 429 AUTH_RATE_LIMIT_EXCEEDED
    const throttledApp = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      rateLimitMaxPerMinute: 100,
      authRateLimitMaxPerMinute: 2,
      rateLimitKeyPrefix: `medisync:test:auth-rl:${runSuffix}`,
    });
    try {
      const r1 = await throttledApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: unverifiedDriverEmail, password: "wrong" },
      });
      expect(r1.statusCode).toBe(401);
      const r2 = await throttledApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: unverifiedDriverEmail, password: "wrong" },
      });
      expect(r2.statusCode).toBe(401);
      const r3 = await throttledApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: unverifiedDriverEmail, password: "wrong" },
      });
      expect(r3.statusCode).toBe(429);
      expect(r3.headers["x-ratelimit-tier"]).toBe("auth");
      expect(r3.headers["retry-after"]).toBeTruthy();
      expect(r3.json<{ error: string }>().error).toBe(
        "AUTH_RATE_LIMIT_EXCEEDED",
      );
    } finally {
      await throttledApp.close();
    }
  });

  it("allows public staff self-registration by field while blocking functional actions until OPS_ADMIN verification", async () => {
    const publicStaffGateApp = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      allowPublicRegistration: true,
      requireProviderVerification: true,
      rateLimitKeyPrefix: `medisync:test:staff-gate:${runSuffix}`,
    });

    try {
      const opsAuth = await loginSeededAccount(
        publicStaffGateApp,
        "ops.admin@medisync.global",
      );
      const patientSeedAuth = await loginSeededAccount(
        publicStaffGateApp,
        "patient.ma@medisync.global",
      );

      // Fetch a seeded MA facility ID for staff functional probes
      const facRes = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/directory/facilities?countryCode=MA&limit=5",
      });
      expect(facRes.statusCode).toBe(200);
      const maFacilityId = facRes.json<{
        facilities: Array<{ id: string }>;
      }>().facilities[0]!.id;

      // 1. Patient public registration activates immediately
      const patientRegRes = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `p9-patient-${runSuffix}@medisync.test`,
          password: "StrongPassword!123",
          fullName: "Yasmine Public Patient",
          role: "PATIENT",
          countryCode: "MA",
        },
      });
      expect(patientRegRes.statusCode).toBe(201);
      const patientReg = patientRegRes.json<AuthResponse>();
      createdUserIds.push(patientReg.user.id);
      expect(patientReg.user.accountStatus).toBe("ACTIVE");

      // 2. All 6 healthcare worker fields register publicly & authenticate,
      //    starting in PENDING_APPROVAL until verified by administration.
      const staffFields = [
        "DOCTOR",
        "CLINIC_STAFF",
        "HOSPITAL_ADMIN",
        "DRIVER",
        "PHARMACIST",
        "LAB_TECH",
      ] as const;

      const registeredStaff: Record<string, AuthResponse> = {};
      for (const roleField of staffFields) {
        const email = `p9-${roleField.toLowerCase()}-${runSuffix}@medisync.test`;
        const regRes = await publicStaffGateApp.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: {
            email,
            password: "StrongPassword!123",
            fullName: `Staff ${roleField}`,
            role: roleField,
            countryCode: "MA",
          },
        });
        expect(regRes.statusCode).toBe(201);
        const body = regRes.json<AuthResponse>();
        createdUserIds.push(body.user.id);
        expect(body.user.accountStatus).toBe("PENDING_APPROVAL");
        expect(body.user.credentialVerified).toBe(false);
        registeredStaff[roleField] = body;

        // Pending staff member can still sign in & read /v1/auth/me normally
        const loginRes = await publicStaffGateApp.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: { email, password: "StrongPassword!123" },
        });
        expect(loginRes.statusCode).toBe(200);
        const meRes = await publicStaffGateApp.inject({
          method: "GET",
          url: "/v1/auth/me",
          headers: {
            authorization: `Bearer ${loginRes.json<AuthResponse>().token}`,
          },
        });
        expect(meRes.statusCode).toBe(200);
        expect(
          meRes.json<{ user: { accountStatus: string } }>().user.accountStatus,
        ).toBe("PENDING_APPROVAL");
      }

      const pendingDoctor = registeredStaff.DOCTOR!;
      const pendingPharmacist = registeredStaff.PHARMACIST!;
      const pendingLabTech = registeredStaff.LAB_TECH!;
      const pendingHospitalAdmin = registeredStaff.HOSPITAL_ADMIN!;

      // 3. Pending doctor CAN upload practitioner credentials for admin review
      const credPresign = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/users/me/media/presign-upload",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: {
          category: "PRACTITIONER_LICENSE",
          fileName: "national-board-license.png",
          mimeType: "image/png",
          sizeBytes: SAMPLE_PNG_BYTES.length,
        },
      });
      expect(credPresign.statusCode).toBe(201);
      const credData = credPresign.json<UserPresignedUploadResponse>();
      createdUserMediaIds.push(credData.document.id);
      uploadedS3Keys.push(credData.document.objectKey);

      const credPut = await fetch(credData.uploadUrl, {
        method: "PUT",
        headers: credData.requiredHeaders,
        body: new Uint8Array(SAMPLE_PNG_BYTES),
      });
      expect(credPut.ok).toBe(true);

      const credConfirm = await publicStaffGateApp.inject({
        method: "POST",
        url: `/v1/users/me/media/${credData.document.id}/confirm`,
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
      });
      expect(credConfirm.statusCode).toBe(200);

      // 4. Functional actions remain blocked 403 PROVIDER_VERIFICATION_REQUIRED while PENDING_APPROVAL
      const blockedDoctorProfile = await publicStaffGateApp.inject({
        method: "PUT",
        url: "/v1/booking/profiles",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: {
          specialty: "Cardiology",
          licenseNumber: `MA-DOC-${runSuffix}`,
          consultationFeeMinor: 35000,
        },
      });
      expect(blockedDoctorProfile.statusCode).toBe(403);
      expect(blockedDoctorProfile.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedDoctorUpload = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/clinical/media/presign-upload",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: {
          patientUserId: patientSeedAuth.user.id,
          mediaCategory: "LAB_REPORT",
          fileName: "blocked.csv",
          mimeType: "text/csv",
          sizeBytes: SAMPLE_CSV_BYTES.length,
        },
      });
      expect(blockedDoctorUpload.statusCode).toBe(403);
      expect(blockedDoctorUpload.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedPharmQr = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/clinical/prescriptions/verify-qr",
        headers: { authorization: `Bearer ${pendingPharmacist.token}` },
        payload: { qrToken: "dummy-qr-token-min-16-chars" },
      });
      expect(blockedPharmQr.statusCode).toBe(403);
      expect(blockedPharmQr.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedPharmProduct = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/pharmacy/products",
        headers: { authorization: `Bearer ${pendingPharmacist.token}` },
        payload: {
          sku: `SKU-BLOCKED-${runSuffix}`,
          name: "Blocked Unverified Item",
          category: "OTC_MEDICATION",
          dosageForm: "Tablet",
          strength: "500mg",
          requiresPrescription: false,
          priceMinor: 2500,
          stockQty: 10,
        },
      });
      expect(blockedPharmProduct.statusCode).toBe(403);
      expect(blockedPharmProduct.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedDoctorLabOrder = await publicStaffGateApp.inject({
        method: "POST",
        url: "/v1/clinical/lab-orders",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: {
          patientUserId: patientSeedAuth.user.id,
          facilityId: maFacilityId,
          panelName: "Complete Blood Count",
          urgency: "ROUTINE",
        },
      });
      expect(blockedDoctorLabOrder.statusCode).toBe(403);
      expect(blockedDoctorLabOrder.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedLabTechRead = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/clinical/lab-orders",
        headers: { authorization: `Bearer ${pendingLabTech.token}` },
      });
      expect(blockedLabTechRead.statusCode).toBe(403);
      expect(blockedLabTechRead.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedLabTechUpdate = await publicStaffGateApp.inject({
        method: "PATCH",
        url: "/v1/clinical/lab-orders/11111111-1111-4111-8111-111111111111/status",
        headers: { authorization: `Bearer ${pendingLabTech.token}` },
        payload: { status: "SAMPLE_COLLECTED" },
      });
      expect(blockedLabTechUpdate.statusCode).toBe(403);
      expect(blockedLabTechUpdate.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedPatientsDirectory = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/directory/patients?countryCode=MA",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
      });
      expect(blockedPatientsDirectory.statusCode).toBe(403);
      expect(blockedPatientsDirectory.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedHospitalStatus = await publicStaffGateApp.inject({
        method: "PATCH",
        url: `/v1/maps/facilities/${maFacilityId}/operational-status`,
        headers: { authorization: `Bearer ${pendingHospitalAdmin.token}` },
        payload: { openStatus: "OPEN" },
      });
      expect(blockedHospitalStatus.statusCode).toBe(403);
      expect(blockedHospitalStatus.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      // 4b. Unverified staff are ALSO blocked from operational patient reads & can link their workplace
      const blockedApptsRead = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/booking/appointments",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
      });
      expect(blockedApptsRead.statusCode).toBe(403);
      expect(blockedApptsRead.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedDispatchRead = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${registeredStaff.DRIVER!.token}` },
      });
      expect(blockedDispatchRead.statusCode).toBe(403);
      expect(blockedDispatchRead.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const linkWorkplaceRes = await publicStaffGateApp.inject({
        method: "PATCH",
        url: "/v1/auth/profile",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: { facilityId: maFacilityId },
      });
      expect(linkWorkplaceRes.statusCode).toBe(200);
      expect(
        linkWorkplaceRes.json<{ user: { facilityId: string | null } }>().user
          .facilityId,
      ).toBe(maFacilityId);

      // 5. OPS_ADMIN verifies & activates the doctor -> doctor functionality unlocks immediately
      const approveRes = await publicStaffGateApp.inject({
        method: "PATCH",
        url: `/v1/admin/users/${pendingDoctor.user.id}/status`,
        headers: { authorization: `Bearer ${opsAuth.token}` },
        payload: {
          accountStatus: "ACTIVE",
          credentialVerified: true,
          reason: "Verified national medical credentials by OPS_ADMIN",
        },
      });
      expect(approveRes.statusCode).toBe(200);
      expect(
        approveRes.json<{
          user: { accountStatus: string; credentialVerified: boolean };
        }>().user,
      ).toMatchObject({
        accountStatus: "ACTIVE",
        credentialVerified: true,
      });

      const unlockedProfile = await publicStaffGateApp.inject({
        method: "PUT",
        url: "/v1/booking/profiles",
        headers: { authorization: `Bearer ${pendingDoctor.token}` },
        payload: {
          specialty: "Cardiology",
          licenseNumber: `MA-DOC-${runSuffix}`,
          consultationFeeMinor: 35000,
        },
      });
      expect(unlockedProfile.statusCode).toBe(200);

      const unlockedDoctors = await publicStaffGateApp.inject({
        method: "GET",
        url: "/v1/directory/doctors?countryCode=MA&limit=50",
      });
      expect(unlockedDoctors.statusCode).toBe(200);
      expect(
        unlockedDoctors
          .json<{ doctors: Array<{ id: string }> }>()
          .doctors.some((d) => d.id === pendingDoctor.user.id),
      ).toBe(true);
    } finally {
      await publicStaffGateApp.close();
    }
  });

  it("enforces separated Patient Auth (Phone password, Phone OTP, Google) vs Healthcare Staff Auth", async () => {
    const separatedAuthApp = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      allowPublicRegistration: true,
      requireProviderVerification: true,
      rateLimitKeyPrefix: `medisync:test:auth-sep:${runSuffix}`,
    });

    try {
      // 1. Google auth fails closed with 503 when not configured on server
      const unconfiguredGoogle = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/google",
        payload: {
          idToken: "valid-looking-mock-google-token-123456",
          countryCode: "MA",
        },
      });
      expect(unconfiguredGoogle.statusCode).toBe(503);
      expect(unconfiguredGoogle.json<{ error: string }>().error).toBe(
        "GOOGLE_OAUTH_NOT_CONFIGURED",
      );

      // 2. Staff registration rejects phone-only without email
      const staffWithoutEmail = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          phone: `+212600${runSuffix.slice(0, 6)}`,
          password: "StrongPassword!123",
          fullName: "Missing Email Doctor",
          role: "DOCTOR",
          countryCode: "MA",
        },
      });
      expect(staffWithoutEmail.statusCode).toBe(400);

      // 3. Patient registers via Phone Number only (no email required) -> ACTIVE immediately
      const patientPhone = `+212661${Math.floor(100000 + Math.random() * 899999)}`;
      const phoneRegRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          phone: patientPhone,
          password: "StrongPassword!123",
          fullName: "Salma Phone Patient",
          role: "PATIENT",
          countryCode: "MA",
        },
      });
      expect(phoneRegRes.statusCode).toBe(201);
      const phoneReg = phoneRegRes.json<AuthResponse>();
      createdUserIds.push(phoneReg.user.id);
      expect(phoneReg.user.email).toBeNull();
      expect(phoneReg.user.phone).toBe(patientPhone);
      expect(phoneReg.user.accountStatus).toBe("ACTIVE");

      // Patient signs in using phone identifier + PATIENT track
      const phoneLoginRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          identifier: patientPhone,
          password: "StrongPassword!123",
          portalTrack: "PATIENT",
        },
      });
      expect(phoneLoginRes.statusCode).toBe(200);

      // Cross-portal isolation: Patient cannot login via STAFF track, Doctor cannot login via PATIENT track
      const patientOnStaffRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          identifier: patientPhone,
          password: "StrongPassword!123",
          portalTrack: "STAFF",
        },
      });
      expect(patientOnStaffRes.statusCode).toBe(403);
      expect(patientOnStaffRes.json<{ error: string }>().error).toBe(
        "USE_PATIENT_PORTAL",
      );

      const doctorOnPatientRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          identifier: "doctor.ma@medisync.global",
          password: SEEDED_DEMO_PASSWORD,
          portalTrack: "PATIENT",
        },
      });
      expect(doctorOnPatientRes.statusCode).toBe(403);
      expect(doctorOnPatientRes.json<{ error: string }>().error).toBe(
        "USE_STAFF_PORTAL",
      );

      // 4. Passwordless SMS OTP sign-up / sign-in for Patient
      const otpPhone = `+212662${Math.floor(100000 + Math.random() * 899999)}`;
      const reqOtpRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/phone/request-otp",
        payload: { phone: otpPhone, countryCode: "MA" },
      });
      expect(reqOtpRes.statusCode).toBe(200);
      const otpMeta = reqOtpRes.json<{
        sent: boolean;
        devPreviewCode?: string;
      }>();
      expect(otpMeta.sent).toBe(true);
      expect(otpMeta.devPreviewCode).toMatch(/^\d{6}$/);

      // Rejects wrong OTP code
      const badOtpRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/phone/verify-otp",
        payload: {
          phone: otpPhone,
          code: otpMeta.devPreviewCode === "000000" ? "111111" : "000000",
          countryCode: "MA",
        },
      });
      expect(badOtpRes.statusCode).toBe(400);

      // Accepts valid OTP code & creates active PATIENT with email: null, authProvider: PHONE
      const okOtpRes = await separatedAuthApp.inject({
        method: "POST",
        url: "/v1/auth/phone/verify-otp",
        payload: {
          phone: otpPhone,
          code: otpMeta.devPreviewCode,
          fullName: "Youssef OTP Patient",
          countryCode: "MA",
        },
      });
      expect(okOtpRes.statusCode).toBe(201);
      const otpUser = okOtpRes.json<AuthResponse>();
      createdUserIds.push(otpUser.user.id);
      expect(otpUser.user.email).toBeNull();
      expect(otpUser.user.phoneVerified).toBe(true);
      expect(otpUser.user.authProvider).toBe("PHONE");
      expect(otpUser.user.accountStatus).toBe("ACTIVE");
    } finally {
      await separatedAuthApp.close();
    }

    // 5. Verified Google OAuth Patient flow + Staff portal isolation
    const googleEnabledApp = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      allowPublicRegistration: true,
      requireProviderVerification: true,
      rateLimitKeyPrefix: `medisync:test:google-auth:${runSuffix}`,
      googleClientId: "test-google-client-id.apps.googleusercontent.com",
      googleTokenVerifier: async (idToken: string) => {
        if (idToken === "valid-patient-google-token") {
          return {
            sub: `google-sub-patient-${runSuffix}`,
            email: `google.patient.${runSuffix}@medisync.test`,
            emailVerified: true,
            fullName: "Kenza Google Patient",
          };
        }
        if (idToken === "valid-staff-email-google-token") {
          return {
            sub: `google-sub-staff-${runSuffix}`,
            email: "doctor.ma@medisync.global",
            emailVerified: true,
            fullName: "Doctor Spoof Attempt",
          };
        }
        return null;
      },
    });

    try {
      const invalidGoogleRes = await googleEnabledApp.inject({
        method: "POST",
        url: "/v1/auth/google",
        payload: {
          idToken: "forged-google-token-value-123456",
          countryCode: "MA",
        },
      });
      expect(invalidGoogleRes.statusCode).toBe(401);

      const validGoogleRes = await googleEnabledApp.inject({
        method: "POST",
        url: "/v1/auth/google",
        payload: {
          idToken: "valid-patient-google-token",
          countryCode: "MA",
        },
      });
      expect(validGoogleRes.statusCode).toBe(201);
      const gUser = validGoogleRes.json<AuthResponse>();
      createdUserIds.push(gUser.user.id);
      expect(gUser.user.authProvider).toBe("GOOGLE");
      expect(gUser.user.emailVerified).toBe(true);
      expect(gUser.user.role).toBe("PATIENT");

      const spoofStaffGoogle = await googleEnabledApp.inject({
        method: "POST",
        url: "/v1/auth/google",
        payload: {
          idToken: "valid-staff-email-google-token",
          countryCode: "MA",
        },
      });
      expect(spoofStaffGoogle.statusCode).toBe(403);
      expect(spoofStaffGoogle.json<{ error: string }>().error).toBe(
        "USE_STAFF_PORTAL",
      );
    } finally {
      await googleEnabledApp.close();
    }
  });

  it("exposes PATCH/PUT/DELETE CORS methods, blocks unverified providers on bookings, and accepts browser-origin MinIO PUT", async () => {
    const corsOrigin = "http://127.0.0.1:3000";
    const verifyServer = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: [corsOrigin],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      seedDemoWorld: false,
      allowPublicRegistration: true,
      requireProviderVerification: true,
      rateLimitKeyPrefix: `medisync:test:cors-and-gate:${runSuffix}`,
    });

    let uploadedObjectKey: string | null = null;
    let uploadedMediaId: string | null = null;

    try {
      const preflightRes = await verifyServer.inject({
        method: "OPTIONS",
        url: "/v1/auth/profile",
        headers: {
          origin: corsOrigin,
          "access-control-request-method": "PATCH",
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(preflightRes.statusCode).toBe(204);
      expect(preflightRes.headers["access-control-allow-origin"]).toBe(corsOrigin);
      const allowMethods = String(
        preflightRes.headers["access-control-allow-methods"] ?? "",
      );
      expect(allowMethods).toContain("PATCH");
      expect(allowMethods).toContain("PUT");
      expect(allowMethods).toContain("DELETE");

      const facListRes = await verifyServer.inject({
        method: "GET",
        url: "/v1/directory/facilities?countryCode=MA&limit=1",
      });
      expect(facListRes.statusCode).toBe(200);
      const facility = facListRes.json<{
        facilities: Array<{ id: string; name: string }>;
      }>().facilities[0];
      expect(facility).toBeTruthy();

      const pendingHospRes = await verifyServer.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `pending.hosp.${runSuffix}@medisync.test`,
          password: "StrongPassword!123",
          fullName: "Pending Hospital Admin",
          role: "HOSPITAL_ADMIN",
          countryCode: "MA",
        },
      });
      expect(pendingHospRes.statusCode).toBe(201);
      const pendingHosp = pendingHospRes.json<AuthResponse>();
      createdUserIds.push(pendingHosp.user.id);

      const profilePatchRes = await verifyServer.inject({
        method: "PATCH",
        url: "/v1/auth/profile",
        headers: {
          authorization: `Bearer ${pendingHosp.token}`,
        },
        payload: {
          facilityId: facility!.id,
          workplaceName: facility!.name,
        },
      });
      expect(profilePatchRes.statusCode).toBe(200);
      expect(
        profilePatchRes.json<{ user: AuthResponse["user"] }>().user.facilityId,
      ).toBe(facility!.id);

      const schedRes = await verifyServer.inject({
        method: "GET",
        url: "/v1/booking/schedules?countryCode=MA",
      });
      expect(schedRes.statusCode).toBe(200);
      const schedule = schedRes.json<{
        schedules: Array<{ id: string }>;
      }>().schedules[0];
      expect(schedule).toBeTruthy();

      const blockedBookingRes = await verifyServer.inject({
        method: "POST",
        url: "/v1/booking/appointments",
        headers: {
          authorization: `Bearer ${pendingHosp.token}`,
        },
        payload: {
          scheduleId: schedule!.id,
          slotStartIso: "2026-11-20T09:00:00.000Z",
        },
      });
      expect(blockedBookingRes.statusCode).toBe(403);
      expect(blockedBookingRes.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      // Pending HOSPITAL_ADMIN is also gated out of admin governance & media oversight until verified
      const blockedAdminOverview = await verifyServer.inject({
        method: "GET",
        url: "/v1/admin/overview",
        headers: {
          authorization: `Bearer ${pendingHosp.token}`,
        },
      });
      expect(blockedAdminOverview.statusCode).toBe(403);
      expect(blockedAdminOverview.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const blockedAdminMedia = await verifyServer.inject({
        method: "GET",
        url: "/v1/admin/facility-media",
        headers: {
          authorization: `Bearer ${pendingHosp.token}`,
        },
      });
      expect(blockedAdminMedia.statusCode).toBe(403);
      expect(blockedAdminMedia.json<{ error: string }>().error).toBe(
        "PROVIDER_VERIFICATION_REQUIRED",
      );

      const opsAdminAuth = await loginSeededAccount(
        verifyServer,
        "ops.admin@medisync.global",
      );
      const okAdminOverview = await verifyServer.inject({
        method: "GET",
        url: "/v1/admin/overview",
        headers: {
          authorization: `Bearer ${opsAdminAuth.token}`,
        },
      });
      expect(okAdminOverview.statusCode).toBe(200);

      const okAdminMedia = await verifyServer.inject({
        method: "GET",
        url: "/v1/admin/facility-media",
        headers: {
          authorization: `Bearer ${opsAdminAuth.token}`,
        },
      });
      expect(okAdminMedia.statusCode).toBe(200);

      const patientAuth = await loginSeededAccount(
        verifyServer,
        "patient.ma@medisync.global",
      );
      const presignRes = await verifyServer.inject({
        method: "POST",
        url: "/v1/clinical/media/presign-upload",
        headers: {
          authorization: `Bearer ${patientAuth.token}`,
        },
        payload: {
          patientUserId: patientAuth.user.id,
          mediaCategory: "OTHER",
          fileName: `cors-probe-${runSuffix}.png`,
          mimeType: "image/png",
          sizeBytes: SAMPLE_PNG_BYTES.byteLength,
        },
      });
      expect(presignRes.statusCode).toBe(201);
      const presigned = presignRes.json<PresignedUploadResponse>();
      uploadedObjectKey = presigned.mediaObject.objectKey;
      uploadedMediaId = presigned.mediaObject.id;

      const s3Preflight = await fetch(presigned.uploadUrl, {
        method: "OPTIONS",
        headers: {
          Origin: corsOrigin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      expect([200, 204]).toContain(s3Preflight.status);
      expect(s3Preflight.headers.get("access-control-allow-origin")).toBe(
        corsOrigin,
      );

      const s3PutRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: {
          Origin: corsOrigin,
          "Content-Type": "image/png",
        },
        body: SAMPLE_PNG_BYTES,
      });
      expect(s3PutRes.ok).toBe(true);
      expect(s3PutRes.headers.get("access-control-allow-origin")).toBe(
        corsOrigin,
      );

      const confirmRes = await verifyServer.inject({
        method: "POST",
        url: `/v1/clinical/media/${uploadedMediaId}/confirm`,
        headers: {
          authorization: `Bearer ${patientAuth.token}`,
        },
      });
      expect(confirmRes.statusCode).toBe(200);
    } finally {
      if (uploadedObjectKey) {
        await deleteS3Object(TEST_S3_CONFIG, uploadedObjectKey).catch(
          () => undefined,
        );
      }
      if (uploadedMediaId) {
        await pool
          .query("DELETE FROM clinical_media_objects WHERE id = $1", [
            uploadedMediaId,
          ])
          .catch(() => undefined);
      }
      await verifyServer.close();
    }
  });

  it("enforces HttpOnly cookie/CSRF, strict PHI separation, allergy alerts, GDPR/CNDP rights, webhook payments & Prometheus metrics", async () => {
    const webhookSecret = "prod-hmac-webhook-secret-min-32-chars";
    const prodLikeApp = await buildApiServer({
      databaseUrl: process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL,
      redisUrl: process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
      allowPublicRegistration: true,
      requireProviderVerification: false,
      allowSimulatedPayments: false,
      paymentWebhookSecret: webhookSecret,
    });

    const createdLocalIds: string[] = [];
    const createdLocalOrderIds: string[] = [];
    const createdLocalRxIds: string[] = [];

    try {
      // 1. Self-registration sets HttpOnly session cookie + records TERMS_PRIVACY consent
      const patRes = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `gdpr-pat-${runSuffix}@medisync.test`,
          password: "StrongPassword!123",
          fullName: "Salma GDPR Compliance",
          role: "PATIENT",
          countryCode: "MA",
          acceptedTerms: true,
          consentVersion: "2026-11",
        },
      });
      expect(patRes.statusCode).toBe(201);
      const setCookieHeader = patRes.headers["set-cookie"];
      const rawCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : typeof setCookieHeader === "string"
          ? [setCookieHeader]
          : [];
      const sessionCookie = rawCookies.find((c) =>
        c.startsWith("medisync_session="),
      );
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie?.toLowerCase()).toContain("httponly");

      const cookiePair = sessionCookie!.split(";")[0]!;
      const patBody = patRes.json<AuthResponse>();
      createdLocalIds.push(patBody.user.id);

      // 2. Cookie authentication works for GET /v1/auth/me without Bearer header
      const cookieMe = await prodLikeApp.inject({
        method: "GET",
        url: "/v1/auth/me",
        headers: { cookie: cookiePair },
      });
      expect(cookieMe.statusCode).toBe(200);
      expect(cookieMe.json<{ user: { id: string } }>().user.id).toBe(
        patBody.user.id,
      );

      // 3. Cross-site Origin on cookie-authenticated mutation is rejected with 403 CSRF_ORIGIN_REJECTED
      const csrfReject = await prodLikeApp.inject({
        method: "PUT",
        url: "/v1/users/me/consents",
        headers: {
          cookie: cookiePair,
          origin: "https://evil-attacker.example",
        },
        payload: {
          consentType: "DATA_SHARING",
          granted: false,
        },
      });
      expect(csrfReject.statusCode).toBe(403);
      expect(csrfReject.json<{ error: string }>().error).toBe(
        "CSRF_ORIGIN_REJECTED",
      );

      // Valid origin updates legal consent ledger and syncs EHR telehealth_consent
      const okConsent = await prodLikeApp.inject({
        method: "PUT",
        url: "/v1/users/me/consents",
        headers: {
          cookie: cookiePair,
          origin: "http://127.0.0.1:3000",
        },
        payload: {
          consentType: "TELEHEALTH_CONSENT",
          granted: true,
          sourcePortal: "PROFILE",
        },
      });
      expect(okConsent.statusCode).toBe(200);

      const listConsentsRes = await prodLikeApp.inject({
        method: "GET",
        url: "/v1/users/me/consents",
        headers: { authorization: `Bearer ${patBody.token}` },
      });
      expect(listConsentsRes.statusCode).toBe(200);
      const consentsList = listConsentsRes.json<{
        consents: Array<{ consentType: string; granted: boolean }>;
      }>().consents;
      expect(consentsList.some((c) => c.consentType === "TERMS_PRIVACY")).toBe(true);
      expect(
        consentsList.some((c) => c.consentType === "TELEHEALTH_CONSENT"),
      ).toBe(true);

      // 4. Record severe Penicillin allergy on patient's EHR profile
      const ehrPut = await prodLikeApp.inject({
        method: "PUT",
        url: "/v1/clinical/patients/me/profile",
        headers: { authorization: `Bearer ${patBody.token}` },
        payload: {
          bloodType: "A+",
          allergies: [{ allergen: "Penicillin", severity: "SEVERE" }],
        },
      });
      expect(ehrPut.statusCode).toBe(200);

      // 5. Minimum-necessary PHI isolation: HOSPITAL_ADMIN & CLINIC_STAFF cannot read patient EHR or SOAP notes
      const docAuth = await loginSeededAccount(prodLikeApp, "doctor.ma@medisync.global");
      const pharmAuth = await loginSeededAccount(
        prodLikeApp,
        "pharmacist.ma@medisync.global",
      );
      const clinicStaffRes = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `reception-phi-${runSuffix}@medisync.test`,
          password: "StrongPassword!123",
          fullName: "Reception Isolation",
          role: "CLINIC_STAFF",
          countryCode: "MA",
        },
      });
      expect(clinicStaffRes.statusCode).toBe(201);
      const clinicStaffAuth = clinicStaffRes.json<AuthResponse>();
      createdLocalIds.push(clinicStaffAuth.user.id);

      const receptionEhrDenied = await prodLikeApp.inject({
        method: "GET",
        url: `/v1/clinical/patients/${patBody.user.id}/profile`,
        headers: { authorization: `Bearer ${clinicStaffAuth.token}` },
      });
      expect(receptionEhrDenied.statusCode).toBe(403);

      const receptionNotesDenied = await prodLikeApp.inject({
        method: "GET",
        url: `/v1/clinical/visit-notes?patientUserId=${patBody.user.id}`,
        headers: { authorization: `Bearer ${clinicStaffAuth.token}` },
      });
      expect(receptionNotesDenied.statusCode).toBe(403);

      // Hospital admin remains blocked from sensitive EHR charts, while allowed to inspect insurance coverage for billing
      const hospitalAuth = await loginSeededAccount(
        prodLikeApp,
        "hospital.ma@medisync.global",
      );
      const hospitalEhrDenied = await prodLikeApp.inject({
        method: "GET",
        url: `/v1/clinical/patients/${patBody.user.id}/profile`,
        headers: { authorization: `Bearer ${hospitalAuth.token}` },
      });
      expect(hospitalEhrDenied.statusCode).toBe(403);

      const hospitalInsuranceAllowed = await prodLikeApp.inject({
        method: "GET",
        url: `/v1/clinical/patients/${patBody.user.id}/insurances`,
        headers: { authorization: `Bearer ${hospitalAuth.token}` },
      });
      expect(hospitalInsuranceAllowed.statusCode).toBe(200);

      // 6. Drug-Allergy safety cross-check triggers for BOTH Doctor issuing Rx & Pharmacist verifying QR
      const rxIssue = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/clinical/prescriptions",
        headers: { authorization: `Bearer ${docAuth.token}` },
        payload: {
          patientUserId: patBody.user.id,
          medications: [
            {
              name: "Amoxicillin 1000mg",
              dosage: "1000 mg",
              frequency: "Twice daily",
              durationDays: 7,
            },
          ],
        },
      });
      expect(rxIssue.statusCode).toBe(201);
      const rxBody = rxIssue.json<{
        prescription: { id: string; qrToken: string };
        allergyWarnings?: Array<{ allergen: string }>;
      }>();
      createdLocalRxIds.push(rxBody.prescription.id);
      expect(rxBody.allergyWarnings?.length).toBeGreaterThanOrEqual(1);
      expect(rxBody.allergyWarnings?.[0]?.allergen).toBe("Penicillin");

      const qrCheck = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/clinical/prescriptions/verify-qr",
        headers: { authorization: `Bearer ${pharmAuth.token}` },
        payload: { qrToken: rxBody.prescription.qrToken },
      });
      expect(qrCheck.statusCode).toBe(200);
      expect(
        qrCheck.json<{ allergyWarnings?: Array<{ allergen: string }> }>()
          .allergyWarnings?.[0]?.allergen,
      ).toBe("Penicillin");

      // Verify SENSITIVE_PHI_READ audit entry recorded on Pharmacist QR inspection
      const phiAudit = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM audit_logs
         WHERE actor_id = $1 AND action = 'SENSITIVE_PHI_READ'`,
        [pharmAuth.user.id],
      );
      expect(Number(phiAudit.rows[0]?.count ?? "0")).toBeGreaterThanOrEqual(1);

      // 7. Payment hardening: CARD_SIMULATED rejected when allowSimulatedPayments=false; HMAC webhook settles idempotently
      const productsRes = await prodLikeApp.inject({
        method: "GET",
        url: "/v1/pharmacy/products?countryCode=MA&inStockOnly=true",
      });
      expect(productsRes.statusCode).toBe(200);
      expect(productsRes.headers["cache-control"]).toContain("public");
      const otcProduct = productsRes
        .json<{
          products: Array<{
            id: string;
            facilityId: string;
            requiresPrescription: boolean;
            priceMinor: number;
          }>;
        }>()
        .products.find((p) => !p.requiresPrescription);
      expect(otcProduct).toBeTruthy();

      const createOrderRes = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/pharmacy/orders",
        headers: { authorization: `Bearer ${patBody.token}` },
        payload: {
          facilityId: otcProduct!.facilityId,
          items: [{ productId: otcProduct!.id, quantity: 1 }],
          fulfillmentMode: "PHARMACY_PICKUP",
        },
      });
      expect(createOrderRes.statusCode).toBe(201);
      const order = createOrderRes.json<{
        order: { id: string; totalMinor: number; currencyCode: string };
      }>().order;
      createdLocalOrderIds.push(order.id);

      const blockedSimPay = await prodLikeApp.inject({
        method: "POST",
        url: `/v1/pharmacy/orders/${order.id}/confirm-payment`,
        headers: { authorization: `Bearer ${patBody.token}` },
        payload: { paymentMethod: "CARD_SIMULATED" },
      });
      expect(blockedSimPay.statusCode).toBe(403);
      expect(blockedSimPay.json<{ error: string }>().error).toBe(
        "PAYMENT_PROVIDER_REQUIRED",
      );

      const webhookEvent = {
        eventId: `evt-${runSuffix}`,
        provider: "CMI_MAROC",
        resourceType: "PHARMACY_ORDER",
        resourceId: order.id,
        amountMinor: order.totalMinor,
        currencyCode: order.currencyCode,
        paymentReference: `CMI-TX-${runSuffix}`,
        status: "SUCCEEDED",
      };
      const webhookSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(webhookEvent), "utf8")
        .digest("hex");

      const okWebhook = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/payments/webhook",
        headers: { "x-medisync-signature": `sha256=${webhookSig}` },
        payload: webhookEvent,
      });
      expect(okWebhook.statusCode).toBe(200);
      expect(
        okWebhook.json<{ processed: boolean; deduplicated: boolean }>()
          .deduplicated,
      ).toBe(false);

      const replayWebhook = await prodLikeApp.inject({
        method: "POST",
        url: "/v1/payments/webhook",
        headers: { "x-medisync-signature": `sha256=${webhookSig}` },
        payload: webhookEvent,
      });
      expect(replayWebhook.statusCode).toBe(200);
      expect(
        replayWebhook.json<{ deduplicated: boolean }>().deduplicated,
      ).toBe(true);

      // 8. GDPR/CNDP Data Portability Export + Erasure & Anonymization + Prometheus /metrics
      const exportRes = await prodLikeApp.inject({
        method: "GET",
        url: "/v1/users/me/data-export",
        headers: { authorization: `Bearer ${patBody.token}` },
      });
      expect(exportRes.statusCode).toBe(200);
      expect(exportRes.json<{ standard: string }>().standard).toBe(
        "CNDP-09-08/GDPR-ART20",
      );

      const eraseRes = await prodLikeApp.inject({
        method: "DELETE",
        url: "/v1/users/me/account",
        headers: { authorization: `Bearer ${patBody.token}` },
        payload: { confirmation: "DELETE_MY_ACCOUNT" },
      });
      expect(eraseRes.statusCode).toBe(200);
      expect(eraseRes.json<{ deleted: boolean }>().deleted).toBe(true);

      const metricsRes = await prodLikeApp.inject({
        method: "GET",
        url: "/metrics",
      });
      expect(metricsRes.statusCode).toBe(200);
      expect(metricsRes.body).toContain("medisync_http_requests_total");
      expect(metricsRes.body).toContain('medisync_dependency_up{dependency="postgres"} 1');
    } finally {
      if (createdLocalOrderIds.length > 0) {
        await pool.query(
          "DELETE FROM pharmacy_order_items WHERE order_id = ANY($1::uuid[])",
          [createdLocalOrderIds],
        );
        await pool.query(
          "DELETE FROM pharmacy_orders WHERE id = ANY($1::uuid[])",
          [createdLocalOrderIds],
        );
      }
      if (createdLocalRxIds.length > 0) {
        await pool.query("DELETE FROM prescriptions WHERE id = ANY($1::uuid[])", [
          createdLocalRxIds,
        ]);
      }
      await pool.query("DELETE FROM payment_webhook_events WHERE event_id = $1", [
        `evt-${runSuffix}`,
      ]);
      if (createdLocalIds.length > 0) {
        await pool.query(
          "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
          [createdLocalIds],
        );
        await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
          createdLocalIds,
        ]);
      }
      await prodLikeApp.close();
    }
  });
});
