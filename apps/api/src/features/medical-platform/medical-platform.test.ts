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
});
