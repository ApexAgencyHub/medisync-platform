import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  FacilityMediaDocumentSchema,
  MAX_MEDIA_UPLOAD_BYTES,
  UserMediaDocumentSchema,
  type AdminFacilityMediaQuery,
  type FacilityMediaDocument,
  type FacilityPresignedUploadResponse,
  type PresignFacilityMediaInput,
  type PresignUserMediaInput,
  type ReviewFacilityDocumentInput,
  type UserMediaDocument,
  type UserPresignedUploadResponse,
} from "@medisync/contracts";
import {
  appendAuditLog,
  invalidateUserAuthCache,
  type AuthTokenClaims,
} from "../foundation/index.js";
import type { Redis } from "ioredis";
import {
  S3InvalidSignatureError,
  S3ObjectNotFoundError,
  createSigV4PresignedUrl,
  inspectUploadedS3Object,
  sanitizeUploadFileName,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";

export class MediaBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaBadRequestError";
  }
}

export class MediaForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaForbiddenError";
  }
}

export class MediaNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaNotFoundError";
  }
}

export class MediaInvalidSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaInvalidSignatureError";
  }
}

const FACILITY_MEDIA_SELECT = `
  d.id,
  d.country_code AS "countryCode",
  d.facility_id AS "facilityId",
  f.name AS "facilityName",
  d.uploaded_by_user_id AS "uploadedByUserId",
  d.category,
  d.object_key AS "objectKey",
  d.file_name AS "fileName",
  d.mime_type AS "mimeType",
  d.size_bytes AS "sizeBytes",
  d.confirmed_size_bytes AS "confirmedSizeBytes",
  d.upload_status AS "uploadStatus",
  d.review_status AS "reviewStatus",
  d.reviewer_note AS "reviewerNote",
  d.reviewed_by_user_id AS "reviewedByUserId",
  d.sha256_checksum AS "sha256Checksum",
  CASE WHEN d.reviewed_at IS NULL THEN NULL ELSE to_char(d.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "reviewedAtIso",
  to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
`;

const USER_MEDIA_SELECT = `
  id,
  country_code AS "countryCode",
  user_id AS "userId",
  category,
  object_key AS "objectKey",
  file_name AS "fileName",
  mime_type AS "mimeType",
  size_bytes AS "sizeBytes",
  confirmed_size_bytes AS "confirmedSizeBytes",
  upload_status AS "uploadStatus",
  review_status AS "reviewStatus",
  reviewer_note AS "reviewerNote",
  reviewed_by_user_id AS "reviewedByUserId",
  sha256_checksum AS "sha256Checksum",
  CASE WHEN reviewed_at IS NULL THEN NULL ELSE to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "reviewedAtIso",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
`;

function hydrateFacilityDocument(
  row: Record<string, unknown>,
  s3Config: S3PresignConfig,
): FacilityMediaDocument {
  const objectKey = String(row.objectKey);
  return FacilityMediaDocumentSchema.parse({
    ...row,
    downloadUrl: createSigV4PresignedUrl({
      config: s3Config,
      method: "GET",
      objectKey,
    }),
  });
}

function hydrateUserDocument(
  row: Record<string, unknown>,
  s3Config: S3PresignConfig,
): UserMediaDocument {
  const objectKey = String(row.objectKey);
  return UserMediaDocumentSchema.parse({
    ...row,
    downloadUrl: createSigV4PresignedUrl({
      config: s3Config,
      method: "GET",
      objectKey,
    }),
  });
}

async function assertFacilityManagePermission(
  db: Pick<Pool, "query"> | PoolClient,
  facilityId: string,
  actor: AuthTokenClaims,
): Promise<{ id: string; countryCode: string; ownerUserId: string }> {
  const res = await db.query<{
    id: string;
    countryCode: string;
    ownerUserId: string;
  }>(
    `SELECT id, country_code AS "countryCode", owner_user_id AS "ownerUserId"
     FROM facilities WHERE id = $1`,
    [facilityId],
  );
  const fac = res.rows[0];
  if (!fac) {
    throw new MediaNotFoundError("Facility not found.");
  }

  if (actor.role === "OPS_ADMIN") {
    return fac;
  }

  if (fac.countryCode !== actor.countryCode) {
    throw new MediaForbiddenError(
      "Cross-country facility media operations are forbidden.",
    );
  }

  const isOwner = fac.ownerUserId === actor.sub;
  const isAssignedStaff =
    actor.facilityId === fac.id &&
    (actor.role === "HOSPITAL_ADMIN" ||
      actor.role === "CLINIC_STAFF" ||
      actor.role === "DOCTOR" ||
      actor.role === "PHARMACIST" ||
      actor.role === "LAB_TECH");

  if (!isOwner && !isAssignedStaff) {
    throw new MediaForbiddenError(
      "Only the facility owner, assigned facility staff, or ops admin may upload facility certifications.",
    );
  }

  return fac;
}

export async function presignFacilityMediaUpload(
  pool: Pool,
  facilityId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  input: PresignFacilityMediaInput,
): Promise<FacilityPresignedUploadResponse> {
  const client = await pool.connect();
  const objectId = crypto.randomUUID();
  const safeName = sanitizeUploadFileName(input.fileName);

  try {
    await client.query("BEGIN");
    const facility = await assertFacilityManagePermission(
      client,
      facilityId,
      actor,
    );

    const objectKey = `facilities/${facility.countryCode}/${facilityId}/${input.category.toLowerCase()}/${objectId}-${safeName}`;

    await client.query(
      `INSERT INTO facility_media_documents (
         id,
         country_code,
         facility_id,
         uploaded_by_user_id,
         category,
         object_key,
         file_name,
         mime_type,
         size_bytes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        objectId,
        facility.countryCode,
        facilityId,
        actor.sub,
        input.category,
        objectKey,
        safeName,
        input.mimeType,
        input.sizeBytes,
      ],
    );

    await appendAuditLog(client, {
      countryCode: facility.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "FACILITY_MEDIA_PRESIGNED",
      resourceType: "facility_media",
      resourceId: objectId,
      metadata: {
        facilityId,
        category: input.category,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });

    await client.query("COMMIT");

    const fetchRes = await pool.query(
      `SELECT ${FACILITY_MEDIA_SELECT}
       FROM facility_media_documents d
       JOIN facilities f ON f.id = d.facility_id
       WHERE d.id = $1`,
      [objectId],
    );
    const document = hydrateFacilityDocument(
      fetchRes.rows[0] as Record<string, unknown>,
      s3Config,
    );

    const uploadUrl = createSigV4PresignedUrl({
      config: s3Config,
      method: "PUT",
      objectKey,
      contentType: input.mimeType,
    });

    return {
      document,
      uploadUrl,
      method: "PUT",
      expiresInSeconds: s3Config.expiresInSeconds,
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      requiredHeaders: {
        "content-type": input.mimeType,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmFacilityMediaUpload(
  pool: Pool,
  facilityId: string,
  mediaId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
): Promise<FacilityMediaDocument> {
  await assertFacilityManagePermission(pool, facilityId, actor);

  const rowRes = await pool.query<{
    id: string;
    countryCode: string;
    objectKey: string;
    mimeType: string;
  }>(
    `SELECT
       id,
       country_code AS "countryCode",
       object_key AS "objectKey",
       mime_type AS "mimeType"
     FROM facility_media_documents
     WHERE id = $1 AND facility_id = $2`,
    [mediaId, facilityId],
  );
  const existing = rowRes.rows[0];
  if (!existing) {
    throw new MediaNotFoundError("Facility document record not found.");
  }

  let observedSizeBytes: number;
  let sha256Checksum: string;
  try {
    const inspected = await inspectUploadedS3Object({
      config: s3Config,
      objectKey: existing.objectKey,
      expectedMimeType: existing.mimeType,
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
    });
    observedSizeBytes = inspected.observedSizeBytes;
    sha256Checksum = inspected.sha256Checksum;
  } catch (err) {
    if (err instanceof S3ObjectNotFoundError) {
      throw new MediaNotFoundError(err.message);
    }
    if (err instanceof S3InvalidSignatureError) {
      await pool.query(
        `UPDATE facility_media_documents SET upload_status = 'FAILED' WHERE id = $1`,
        [mediaId],
      );
      throw new MediaInvalidSignatureError(err.message);
    }
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE facility_media_documents
       SET upload_status = 'UPLOADED',
           confirmed_size_bytes = $2,
           sha256_checksum = $3
       WHERE id = $1`,
      [mediaId, observedSizeBytes, sha256Checksum],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "FACILITY_MEDIA_CONFIRMED",
      resourceType: "facility_media",
      resourceId: mediaId,
      metadata: {
        facilityId,
        observedSizeBytes,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const refreshed = await pool.query(
    `SELECT ${FACILITY_MEDIA_SELECT}
     FROM facility_media_documents d
     JOIN facilities f ON f.id = d.facility_id
     WHERE d.id = $1`,
    [mediaId],
  );
  return hydrateFacilityDocument(
    refreshed.rows[0] as Record<string, unknown>,
    s3Config,
  );
}

export async function listFacilityMediaScoped(
  pool: Pool,
  facilityId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
): Promise<FacilityMediaDocument[]> {
  const facRes = await pool.query<{
    id: string;
    countryCode: string;
    ownerUserId: string;
  }>(
    `SELECT id, country_code AS "countryCode", owner_user_id AS "ownerUserId"
     FROM facilities WHERE id = $1`,
    [facilityId],
  );
  const fac = facRes.rows[0];
  if (!fac) {
    throw new MediaNotFoundError("Facility not found.");
  }

  if (actor.role !== "OPS_ADMIN" && fac.countryCode !== actor.countryCode) {
    throw new MediaForbiddenError(
      "Cross-country facility document access is forbidden.",
    );
  }

  const canViewSensitiveDocs =
    actor.role === "OPS_ADMIN" ||
    (actor.role === "HOSPITAL_ADMIN" &&
      (actor.facilityId === fac.id || fac.ownerUserId === actor.sub)) ||
    fac.ownerUserId === actor.sub;

  const res = await pool.query(
    `SELECT ${FACILITY_MEDIA_SELECT}
     FROM facility_media_documents d
     JOIN facilities f ON f.id = d.facility_id
     WHERE d.facility_id = $1
       AND (
         $2::boolean = TRUE
         OR (d.category = 'FACILITY_PHOTO' AND d.upload_status = 'UPLOADED')
       )
     ORDER BY d.created_at DESC
     LIMIT 50`,
    [facilityId, canViewSensitiveDocs],
  );

  return res.rows.map((row) =>
    hydrateFacilityDocument(row as Record<string, unknown>, s3Config),
  );
}

export async function listAdminFacilityMediaScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  query: AdminFacilityMediaQuery,
): Promise<FacilityMediaDocument[]> {
  const effectiveCountry =
    actor.role === "OPS_ADMIN"
      ? (query.countryCode?.trim().toUpperCase() ?? null)
      : actor.countryCode;

  if (
    actor.role !== "OPS_ADMIN" &&
    query.countryCode &&
    query.countryCode.trim().toUpperCase() !== actor.countryCode
  ) {
    throw new MediaForbiddenError(
      "Hospital admins may only inspect documents in their assigned CountryPack.",
    );
  }

  const res = await pool.query(
    `SELECT ${FACILITY_MEDIA_SELECT}
     FROM facility_media_documents d
     JOIN facilities f ON f.id = d.facility_id
     WHERE ($1::text IS NULL OR d.country_code = $1)
       AND ($2::uuid IS NULL OR d.facility_id = $2)
       AND ($3::text IS NULL OR d.review_status = $3)
     ORDER BY d.created_at DESC
     LIMIT $4`,
    [
      effectiveCountry,
      query.facilityId ?? null,
      query.reviewStatus ?? null,
      query.limit,
    ],
  );

  return res.rows.map((row) =>
    hydrateFacilityDocument(row as Record<string, unknown>, s3Config),
  );
}

export async function reviewFacilityDocumentAdmin(
  pool: Pool,
  mediaId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  input: ReviewFacilityDocumentInput,
): Promise<FacilityMediaDocument> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query<{
      id: string;
      countryCode: string;
      facilityId: string;
      uploadStatus: string;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         upload_status AS "uploadStatus"
       FROM facility_media_documents
       WHERE id = $1
       FOR UPDATE`,
      [mediaId],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new MediaNotFoundError("Facility document not found.");
    }

    if (
      input.reviewStatus === "APPROVED" &&
      existing.uploadStatus !== "UPLOADED"
    ) {
      throw new MediaBadRequestError(
        "Cannot approve a document before binary upload confirmation succeeds.",
      );
    }

    await client.query(
      `UPDATE facility_media_documents
       SET review_status = $2,
           reviewer_note = $3,
           reviewed_by_user_id = $4,
           reviewed_at = NOW()
       WHERE id = $1`,
      [
        mediaId,
        input.reviewStatus,
        input.reviewerNote?.trim() ?? null,
        actor.sub,
      ],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "FACILITY_MEDIA_REVIEWED",
      resourceType: "facility_media",
      resourceId: mediaId,
      metadata: {
        facilityId: existing.facilityId,
        reviewStatus: input.reviewStatus,
        reviewerNote: input.reviewerNote?.trim() ?? null,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const refreshed = await pool.query(
    `SELECT ${FACILITY_MEDIA_SELECT}
     FROM facility_media_documents d
     JOIN facilities f ON f.id = d.facility_id
     WHERE d.id = $1`,
    [mediaId],
  );
  return hydrateFacilityDocument(
    refreshed.rows[0] as Record<string, unknown>,
    s3Config,
  );
}

export async function presignUserMediaUpload(
  pool: Pool,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  input: PresignUserMediaInput,
): Promise<UserPresignedUploadResponse> {
  const client = await pool.connect();
  const objectId = crypto.randomUUID();
  const safeName = sanitizeUploadFileName(input.fileName);

  try {
    await client.query("BEGIN");
    const objectKey = `users/${actor.countryCode}/${actor.sub}/${input.category.toLowerCase()}/${objectId}-${safeName}`;

    await client.query(
      `INSERT INTO user_media_documents (
         id,
         country_code,
         user_id,
         category,
         object_key,
         file_name,
         mime_type,
         size_bytes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        objectId,
        actor.countryCode,
        actor.sub,
        input.category,
        objectKey,
        safeName,
        input.mimeType,
        input.sizeBytes,
      ],
    );

    await appendAuditLog(client, {
      countryCode: actor.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "USER_MEDIA_PRESIGNED",
      resourceType: "user_media",
      resourceId: objectId,
      metadata: {
        category: input.category,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });

    await client.query("COMMIT");

    const fetchRes = await pool.query(
      `SELECT ${USER_MEDIA_SELECT} FROM user_media_documents WHERE id = $1`,
      [objectId],
    );
    const document = hydrateUserDocument(
      fetchRes.rows[0] as Record<string, unknown>,
      s3Config,
    );

    const uploadUrl = createSigV4PresignedUrl({
      config: s3Config,
      method: "PUT",
      objectKey,
      contentType: input.mimeType,
    });

    return {
      document,
      uploadUrl,
      method: "PUT",
      expiresInSeconds: s3Config.expiresInSeconds,
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      requiredHeaders: {
        "content-type": input.mimeType,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmUserMediaUpload(
  pool: Pool,
  mediaId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
): Promise<{ document: UserMediaDocument; avatarUrl: string | null }> {
  const rowRes = await pool.query<{
    id: string;
    userId: string;
    countryCode: string;
    category: string;
    objectKey: string;
    mimeType: string;
  }>(
    `SELECT
       id,
       user_id AS "userId",
       country_code AS "countryCode",
       category,
       object_key AS "objectKey",
       mime_type AS "mimeType"
     FROM user_media_documents
     WHERE id = $1`,
    [mediaId],
  );
  const existing = rowRes.rows[0];
  if (!existing) {
    throw new MediaNotFoundError("User media document not found.");
  }
  if (existing.userId !== actor.sub && actor.role !== "OPS_ADMIN") {
    throw new MediaForbiddenError(
      "Cannot confirm another user's uploaded media.",
    );
  }

  let observedSizeBytes: number;
  let sha256Checksum: string;
  try {
    const inspected = await inspectUploadedS3Object({
      config: s3Config,
      objectKey: existing.objectKey,
      expectedMimeType: existing.mimeType,
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
    });
    observedSizeBytes = inspected.observedSizeBytes;
    sha256Checksum = inspected.sha256Checksum;
  } catch (err) {
    if (err instanceof S3ObjectNotFoundError) {
      throw new MediaNotFoundError(err.message);
    }
    if (err instanceof S3InvalidSignatureError) {
      await pool.query(
        `UPDATE user_media_documents SET upload_status = 'FAILED' WHERE id = $1`,
        [mediaId],
      );
      throw new MediaInvalidSignatureError(err.message);
    }
    throw err;
  }

  const client = await pool.connect();
  let avatarUrl: string | null = null;
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE user_media_documents
       SET upload_status = 'UPLOADED',
           confirmed_size_bytes = $2,
           sha256_checksum = $3
       WHERE id = $1`,
      [mediaId, observedSizeBytes, sha256Checksum],
    );

    if (existing.category === "AVATAR") {
      await client.query(
        `UPDATE users SET avatar_object_key = $2 WHERE id = $1`,
        [existing.userId, existing.objectKey],
      );
      avatarUrl = createSigV4PresignedUrl({
        config: s3Config,
        method: "GET",
        objectKey: existing.objectKey,
      });
    }

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action:
        existing.category === "AVATAR"
          ? "USER_AVATAR_UPDATED"
          : "USER_MEDIA_CONFIRMED",
      resourceType: "user_media",
      resourceId: mediaId,
      metadata: {
        category: existing.category,
        observedSizeBytes,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const refreshed = await pool.query(
    `SELECT ${USER_MEDIA_SELECT} FROM user_media_documents WHERE id = $1`,
    [mediaId],
  );
  return {
    document: hydrateUserDocument(
      refreshed.rows[0] as Record<string, unknown>,
      s3Config,
    ),
    avatarUrl,
  };
}

export async function listUserMediaScoped(
  pool: Pool,
  targetUserId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
): Promise<UserMediaDocument[]> {
  if (actor.sub !== targetUserId) {
    if (actor.role !== "OPS_ADMIN" && actor.role !== "HOSPITAL_ADMIN") {
      throw new MediaForbiddenError(
        "Cannot view another user's identity documents or credentials.",
      );
    }
    if (actor.role === "HOSPITAL_ADMIN") {
      const userRes = await pool.query<{ countryCode: string }>(
        `SELECT country_code AS "countryCode" FROM users WHERE id = $1`,
        [targetUserId],
      );
      const targetUser = userRes.rows[0];
      if (!targetUser) {
        throw new MediaNotFoundError("User account not found.");
      }
      if (targetUser.countryCode !== actor.countryCode) {
        throw new MediaForbiddenError(
          "Cross-country user credential access is forbidden.",
        );
      }
    }
  }

  const res = await pool.query(
    `SELECT ${USER_MEDIA_SELECT}
     FROM user_media_documents
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [targetUserId],
  );

  return res.rows.map((row) =>
    hydrateUserDocument(row as Record<string, unknown>, s3Config),
  );
}

const PROVIDER_CREDENTIAL_CATEGORIES = new Set<string>([
  "MEDICAL_DEGREE",
  "PRACTITIONER_LICENSE",
  "DRIVER_LICENSE",
  "VEHICLE_INSPECTION",
  "BOARD_CERTIFICATION",
]);

export async function reviewUserDocumentAdmin(
  pool: Pool,
  mediaId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  input: ReviewFacilityDocumentInput,
  redis?: Redis,
): Promise<UserMediaDocument> {
  const client = await pool.connect();
  let targetUserId = "";
  try {
    await client.query("BEGIN");
    const existingRes = await client.query<{
      id: string;
      userId: string;
      countryCode: string;
      category: string;
      uploadStatus: string;
    }>(
      `SELECT
         id,
         user_id AS "userId",
         country_code AS "countryCode",
         category,
         upload_status AS "uploadStatus"
       FROM user_media_documents
       WHERE id = $1
       FOR UPDATE`,
      [mediaId],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new MediaNotFoundError("User credential document not found.");
    }
    targetUserId = existing.userId;
    if (
      input.reviewStatus === "APPROVED" &&
      existing.uploadStatus !== "UPLOADED"
    ) {
      throw new MediaBadRequestError(
        "Cannot approve a user credential before upload confirmation succeeds.",
      );
    }

    await client.query(
      `UPDATE user_media_documents
       SET review_status = $2,
           reviewer_note = $3,
           reviewed_by_user_id = $4,
           reviewed_at = NOW()
       WHERE id = $1`,
      [
        mediaId,
        input.reviewStatus,
        input.reviewerNote?.trim() ?? null,
        actor.sub,
      ],
    );

    if (
      input.reviewStatus === "APPROVED" &&
      PROVIDER_CREDENTIAL_CATEGORIES.has(existing.category)
    ) {
      await client.query(
        `UPDATE users
         SET credential_verified = TRUE,
             account_status = CASE WHEN account_status = 'PENDING_APPROVAL' THEN 'ACTIVE' ELSE account_status END
         WHERE id = $1`,
        [existing.userId],
      );
    }

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "USER_MEDIA_REVIEWED",
      resourceType: "user_media",
      resourceId: mediaId,
      metadata: {
        targetUserId: existing.userId,
        category: existing.category,
        reviewStatus: input.reviewStatus,
        reviewerNote: input.reviewerNote?.trim() ?? null,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  if (targetUserId) {
    await invalidateUserAuthCache(redis, targetUserId);
  }

  const refreshed = await pool.query(
    `SELECT ${USER_MEDIA_SELECT} FROM user_media_documents WHERE id = $1`,
    [mediaId],
  );
  return hydrateUserDocument(
    refreshed.rows[0] as Record<string, unknown>,
    s3Config,
  );
}
