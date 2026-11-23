import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  AuthenticatedUser,
  ClinicalMediaObjectResponse,
  DeleteUserMediaResponse,
  FacilityMediaDocumentResponse,
  FacilityMediaListResponse,
  FacilityPresignedUploadResponse,
  FacilitySummary,
  PresignedUploadResponse,
  UserMediaDocumentResponse,
  UserMediaListResponse,
  UserPresignedUploadResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import { deleteS3Object, type S3PresignConfig } from "../../shared/storage/s3-presign.js";

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

// Minimal valid 1x1 transparent PNG binary with true magic signature
const SAMPLE_PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

// Minimal valid PDF header payload
const SAMPLE_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  "utf8",
);

describe("api slice 6 media-certifications: real MinIO S3 PUT, magic-byte validation, avatars & licenses", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseBase = Math.floor(400000 + crypto.randomInt(0, 500000));
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdClinicalMediaIds: string[] = [];
  const uploadedS3Keys: string[] = [];

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
      s3Config: TEST_S3_CONFIG,
      pool,
      redis,
      runDbMigrations: false,
    });
  });

  afterAll(async () => {
    for (const key of uploadedS3Keys) {
      await deleteS3Object(TEST_S3_CONFIG, key);
    }

    if (createdClinicalMediaIds.length > 0) {
      await pool.query(
        "DELETE FROM clinical_media_objects WHERE id = ANY($1::uuid[])",
        [createdClinicalMediaIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM user_media_documents WHERE user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
        [createdUserIds],
      );
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
    role: "PATIENT" | "DOCTOR" | "CLINIC_STAFF" | "HOSPITAL_ADMIN";
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

  async function promoteToOpsAdmin(email: string, fullName: string): Promise<string> {
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email,
        password: "StrongPassword!123",
        fullName,
        role: "HOSPITAL_ADMIN",
        countryCode: "MA",
      },
    });
    expect(reg.statusCode).toBe(201);
    const created = reg.json<AuthResponse>();
    createdUserIds.push(created.user.id);

    await pool.query("UPDATE users SET role = 'OPS_ADMIN' WHERE id = $1", [
      created.user.id,
    ]);

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "StrongPassword!123" },
    });
    expect(loginRes.statusCode).toBe(200);
    return loginRes.json<AuthResponse>().token;
  }

  it("uploads real binaries to MinIO, validates magic bytes, stores facility licenses, and serves avatars", async () => {
    const doctor = await registerAccount({
      email: `dr.media.${runSuffix}@medisync.ma`,
      fullName: "Dr. Nadia Benali",
      role: "DOCTOR",
      countryCode: "MA",
    });
    const patient = await registerAccount({
      email: `pat.media.${runSuffix}@medisync.ma`,
      fullName: "Youssef El Fassi",
      role: "PATIENT",
      countryCode: "MA",
    });
    const frPatient = await registerAccount({
      email: `pat.fr.${runSuffix}@medisync.fr`,
      fullName: "Claire Moreau",
      role: "PATIENT",
      countryCode: "FR",
    });
    const opsToken = await promoteToOpsAdmin(
      `ops.media.${runSuffix}@medisync.global`,
      "Ops Verifier",
    );

    // Create clinic owned by doctor
    const facRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        name: `Clinique Anfa Media ${runSuffix}`,
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: `MA-CLIN-${licenseBase}`,
        lat: 33.588,
        lng: -7.632,
        address: "Rue Jean Jaures, Casablanca",
      },
    });
    expect(facRes.statusCode).toBe(201);
    const clinic = facRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(clinic.id);

    // 1. Facility Ministry License PDF -> PUT real bytes -> confirm -> ops review
    const presignLicenseRes = await app.inject({
      method: "POST",
      url: `/v1/facilities/${clinic.id}/media/presign-upload`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        category: "MINISTRY_LICENSE",
        fileName: "ministry-license.pdf",
        mimeType: "application/pdf",
        sizeBytes: SAMPLE_PDF_BYTES.length,
      },
    });
    expect(presignLicenseRes.statusCode).toBe(201);
    const licensePresign =
      presignLicenseRes.json<FacilityPresignedUploadResponse>();
    uploadedS3Keys.push(licensePresign.document.objectKey);

    const putLicenseRes = await fetch(licensePresign.uploadUrl, {
      method: "PUT",
      headers: licensePresign.requiredHeaders,
      body: new Uint8Array(SAMPLE_PDF_BYTES),
    });
    expect(putLicenseRes.ok).toBe(true);

    const confirmLicenseRes = await app.inject({
      method: "POST",
      url: `/v1/facilities/${clinic.id}/media/${licensePresign.document.id}/confirm`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(confirmLicenseRes.statusCode).toBe(200);
    const confirmedLicense =
      confirmLicenseRes.json<FacilityMediaDocumentResponse>().document;
    expect(confirmedLicense.uploadStatus).toBe("UPLOADED");
    expect(confirmedLicense.confirmedSizeBytes).toBe(SAMPLE_PDF_BYTES.length);

    // Upload a public FACILITY_PHOTO PNG as well
    const presignPhotoRes = await app.inject({
      method: "POST",
      url: `/v1/facilities/${clinic.id}/media/presign-upload`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        category: "FACILITY_PHOTO",
        fileName: "lobby.png",
        mimeType: "image/png",
        sizeBytes: SAMPLE_PNG_BYTES.length,
      },
    });
    expect(presignPhotoRes.statusCode).toBe(201);
    const photoPresign = presignPhotoRes.json<FacilityPresignedUploadResponse>();
    uploadedS3Keys.push(photoPresign.document.objectKey);

    const putPhotoRes = await fetch(photoPresign.uploadUrl, {
      method: "PUT",
      headers: photoPresign.requiredHeaders,
      body: new Uint8Array(SAMPLE_PNG_BYTES),
    });
    expect(putPhotoRes.ok).toBe(true);

    const confirmPhotoRes = await app.inject({
      method: "POST",
      url: `/v1/facilities/${clinic.id}/media/${photoPresign.document.id}/confirm`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(confirmPhotoRes.statusCode).toBe(200);

    // Visibility rule: MA patient sees FACILITY_PHOTO only, not MINISTRY_LICENSE; ops admin sees both; FR patient -> 403
    const patientListRes = await app.inject({
      method: "GET",
      url: `/v1/facilities/${clinic.id}/media`,
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(patientListRes.statusCode).toBe(200);
    const patientDocs = patientListRes.json<FacilityMediaListResponse>().documents;
    expect(patientDocs.map((d) => d.category)).toEqual(["FACILITY_PHOTO"]);

    const frForbiddenRes = await app.inject({
      method: "GET",
      url: `/v1/facilities/${clinic.id}/media`,
      headers: { authorization: `Bearer ${frPatient.token}` },
    });
    expect(frForbiddenRes.statusCode).toBe(403);

    // Ops admin views via /v1/admin/facility-media and approves license
    const adminDocsRes = await app.inject({
      method: "GET",
      url: `/v1/admin/facility-media?facilityId=${clinic.id}`,
      headers: { authorization: `Bearer ${opsToken}` },
    });
    expect(adminDocsRes.statusCode).toBe(200);
    expect(
      adminDocsRes.json<FacilityMediaListResponse>().documents.length,
    ).toBeGreaterThanOrEqual(2);

    const approveDocRes = await app.inject({
      method: "PATCH",
      url: `/v1/admin/facility-media/${confirmedLicense.id}/review`,
      headers: { authorization: `Bearer ${opsToken}` },
      payload: {
        reviewStatus: "APPROVED",
        reviewerNote: "Verified stamp matches Ministry registry.",
      },
    });
    expect(approveDocRes.statusCode).toBe(200);
    expect(
      approveDocRes.json<FacilityMediaDocumentResponse>().document.reviewStatus,
    ).toBe("APPROVED");

    // 2. Clinical Media real upload + spoofed PNG magic-byte rejection
    const presignClinicalOk = await app.inject({
      method: "POST",
      url: "/v1/clinical/media/presign-upload",
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        patientUserId: patient.user.id,
        fileName: "prior-xray.png",
        mimeType: "image/png",
        sizeBytes: SAMPLE_PNG_BYTES.length,
      },
    });
    expect(presignClinicalOk.statusCode).toBe(201);
    const clinOk = presignClinicalOk.json<PresignedUploadResponse>();
    createdClinicalMediaIds.push(clinOk.mediaObject.id);
    uploadedS3Keys.push(clinOk.mediaObject.objectKey);

    const putClinOk = await fetch(clinOk.uploadUrl, {
      method: "PUT",
      headers: clinOk.requiredHeaders,
      body: new Uint8Array(SAMPLE_PNG_BYTES),
    });
    expect(putClinOk.ok).toBe(true);

    const confirmClinOk = await app.inject({
      method: "POST",
      url: `/v1/clinical/media/${clinOk.mediaObject.id}/confirm`,
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(confirmClinOk.statusCode).toBe(200);
    const confirmedClin =
      confirmClinOk.json<ClinicalMediaObjectResponse>().mediaObject;
    expect(confirmedClin.uploadStatus).toBe("UPLOADED");

    const downloadedBytes = Buffer.from(
      await (await fetch(confirmedClin.downloadUrl)).arrayBuffer(),
    );
    expect(downloadedBytes.equals(SAMPLE_PNG_BYTES)).toBe(true);

    // Spoofed upload: declared image/png, actually plain text -> 422 INVALID_FILE_SIGNATURE & S3 deleted
    const presignSpoof = await app.inject({
      method: "POST",
      url: "/v1/clinical/media/presign-upload",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        patientUserId: patient.user.id,
        fileName: "fake-scan.png",
        mimeType: "image/png",
        sizeBytes: 32,
      },
    });
    expect(presignSpoof.statusCode).toBe(201);
    const spoofed = presignSpoof.json<PresignedUploadResponse>();
    createdClinicalMediaIds.push(spoofed.mediaObject.id);
    uploadedS3Keys.push(spoofed.mediaObject.objectKey);

    const fakePayload = Buffer.from("not-a-real-png-binary-payload!!!", "utf8");
    await fetch(spoofed.uploadUrl, {
      method: "PUT",
      headers: spoofed.requiredHeaders,
      body: new Uint8Array(fakePayload),
    });

    const confirmSpoofRes = await app.inject({
      method: "POST",
      url: `/v1/clinical/media/${spoofed.mediaObject.id}/confirm`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(confirmSpoofRes.statusCode).toBe(422);
    const deletedCheck = await fetch(spoofed.mediaObject.downloadUrl);
    expect(deletedCheck.status).toBe(404);

    // 3. User Avatar + Medical Degree upload -> hydrates /v1/auth/me & /v1/admin/users
    const presignAvatar = await app.inject({
      method: "POST",
      url: "/v1/users/me/media/presign-upload",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        category: "AVATAR",
        fileName: "dr-nadia.png",
        mimeType: "image/png",
        sizeBytes: SAMPLE_PNG_BYTES.length,
      },
    });
    expect(presignAvatar.statusCode).toBe(201);
    const avatarPresign = presignAvatar.json<UserPresignedUploadResponse>();
    uploadedS3Keys.push(avatarPresign.document.objectKey);

    await fetch(avatarPresign.uploadUrl, {
      method: "PUT",
      headers: avatarPresign.requiredHeaders,
      body: new Uint8Array(SAMPLE_PNG_BYTES),
    });

    const confirmAvatarRes = await app.inject({
      method: "POST",
      url: `/v1/users/me/media/${avatarPresign.document.id}/confirm`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(confirmAvatarRes.statusCode).toBe(200);
    const confirmAvatarBody =
      confirmAvatarRes.json<UserMediaDocumentResponse>();
    expect(confirmAvatarBody.avatarUrl).toContain(
      avatarPresign.document.objectKey,
    );

    const meRes = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const meUser = meRes.json<{ user: AuthenticatedUser }>().user;
    expect(meUser.avatarUrl).toBeTruthy();

    const adminUserMediaRes = await app.inject({
      method: "GET",
      url: `/v1/admin/users/${doctor.user.id}/media`,
      headers: { authorization: `Bearer ${opsToken}` },
    });
    expect(adminUserMediaRes.statusCode).toBe(200);
    expect(
      adminUserMediaRes
        .json<UserMediaListResponse>()
        .documents.some((doc) => doc.id === avatarPresign.document.id),
    ).toBe(true);

    // 4. OPS_ADMIN global /v1/admin/user-media feed includes practitioner licenses (excluding AVATAR) & user deletes pending doc
    const presignLicense = await app.inject({
      method: "POST",
      url: "/v1/users/me/media/presign-upload",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        category: "PRACTITIONER_LICENSE",
        fileName: "dr-nadia-license.png",
        mimeType: "image/png",
        sizeBytes: SAMPLE_PNG_BYTES.length,
      },
    });
    expect(presignLicense.statusCode).toBe(201);
    const practitionerLicensePresign = presignLicense.json<UserPresignedUploadResponse>();
    uploadedS3Keys.push(practitionerLicensePresign.document.objectKey);

    await fetch(practitionerLicensePresign.uploadUrl, {
      method: "PUT",
      headers: practitionerLicensePresign.requiredHeaders,
      body: new Uint8Array(SAMPLE_PNG_BYTES),
    });

    const confirmPractitionerLicenseRes = await app.inject({
      method: "POST",
      url: `/v1/users/me/media/${practitionerLicensePresign.document.id}/confirm`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(confirmPractitionerLicenseRes.statusCode).toBe(200);

    const globalUserMediaRes = await app.inject({
      method: "GET",
      url: "/v1/admin/user-media?countryCode=MA",
      headers: { authorization: `Bearer ${opsToken}` },
    });
    expect(globalUserMediaRes.statusCode).toBe(200);
    const globalDocs = globalUserMediaRes.json<UserMediaListResponse>().documents;
    expect(globalDocs.some((doc) => doc.id === practitionerLicensePresign.document.id)).toBe(true);
    expect(globalDocs.some((doc) => doc.id === avatarPresign.document.id)).toBe(false);

    const deleteOwnDocRes = await app.inject({
      method: "DELETE",
      url: `/v1/users/me/media/${practitionerLicensePresign.document.id}`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(deleteOwnDocRes.statusCode).toBe(200);
    expect(deleteOwnDocRes.json<DeleteUserMediaResponse>().deleted).toBe(true);
  });
});
