import type { Redis } from "ioredis";
import type { Pool, PoolClient } from "pg";
import {
  AdminOverviewMetricsSchema,
  AuditEventSchema,
  AuthenticatedUserSchema,
  DispatchRequestSummarySchema,
  DisputeSummarySchema,
  type AdminAuditQuery,
  type AdminCreateUserInput,
  type AdminOverviewMetrics,
  type AdminOverviewQuery,
  type AdminOverrideDispatchInput,
  type AdminUpdateUserStatusInput,
  type AdminUsersQuery,
  type AuditEvent,
  type AuthenticatedUser,
  type CreateDisputeInput,
  type DispatchRequestSummary,
  type DisputeSummary,
  type ResolveDisputeInput,
  type UpdateUserRoleInput,
} from "@medisync/contracts";
import {
  appendAuditLog,
  DuplicateConflictError,
  hashPassword,
  insertUser,
  invalidateUserAuthCache,
  type AuthTokenClaims,
} from "../foundation/index.js";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";

function withUserAvatarUrl(
  row: Record<string, unknown>,
  s3Config?: S3PresignConfig,
): Record<string, unknown> {
  const objectKey =
    typeof row.avatarObjectKey === "string" && row.avatarObjectKey.length > 0
      ? row.avatarObjectKey
      : null;
  return {
    ...row,
    avatarUrl:
      objectKey && s3Config
        ? createSigV4PresignedUrl({
            config: s3Config,
            method: "GET",
            objectKey,
          })
        : null,
  };
}

export class AdminForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminForbiddenError";
  }
}

export class AdminNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminNotFoundError";
  }
}

export class AdminConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminConflictError";
    this.code = code;
  }
}

export class AdminBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminBadRequestError";
  }
}

const DISPATCH_SELECT_COLUMNS = `
  id,
  country_code AS "countryCode",
  patient_user_id AS "patientUserId",
  driver_user_id AS "driverUserId",
  target_facility_id AS "targetFacilityId",
  pickup_lat AS "pickupLat",
  pickup_lng AS "pickupLng",
  pickup_address AS "pickupAddress",
  urgency,
  status,
  notes,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

const DISPUTE_SELECT_COLUMNS = `
  d.id,
  d.country_code AS "countryCode",
  d.reporter_user_id AS "reporterUserId",
  u.full_name AS "reporterName",
  d.reporter_role AS "reporterRole",
  d.category,
  d.subject,
  d.description,
  d.target_resource_id AS "targetResourceId",
  d.status,
  d.resolution_note AS "resolutionNote",
  d.resolved_by_user_id AS "resolvedByUserId",
  to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
  to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

function resolveScopedCountry(
  actor: Pick<AuthTokenClaims, "role" | "countryCode">,
  requestedCountry?: string | undefined,
): string | null {
  const normalized = requestedCountry?.trim().toUpperCase();
  if (actor.role === "OPS_ADMIN") {
    return normalized ?? null;
  }
  if (normalized && normalized !== actor.countryCode) {
    throw new AdminForbiddenError(
      "Hospital admins cannot query or modify records outside their assigned country.",
    );
  }
  return actor.countryCode;
}

async function fetchDisputeById(
  db: Pick<Pool, "query">,
  disputeId: string,
): Promise<DisputeSummary | null> {
  const res = await db.query(
    `SELECT ${DISPUTE_SELECT_COLUMNS}
     FROM platform_disputes d
     JOIN users u ON u.id = d.reporter_user_id
     WHERE d.id = $1
     LIMIT 1`,
    [disputeId],
  );
  if (res.rowCount === 0) return null;
  return DisputeSummarySchema.parse(res.rows[0]);
}

export async function listAuditEventsFiltered(
  pool: Pick<Pool, "query">,
  actor: Pick<AuthTokenClaims, "role" | "countryCode">,
  query: AdminAuditQuery,
): Promise<AuditEvent[]> {
  const effectiveCountry = resolveScopedCountry(actor, query.countryCode);

  const res = await pool.query(
    `SELECT
       event_id::text AS "eventId",
       country_code AS "countryCode",
       actor_id::text AS "actorId",
       actor_role AS "actorRole",
       action,
       resource_type AS "resourceType",
       resource_id::text AS "resourceId",
       to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAtIso"
     FROM audit_logs
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR action = $2)
       AND ($3::text IS NULL OR resource_type = $3)
     ORDER BY occurred_at DESC
     LIMIT $4`,
    [
      effectiveCountry,
      query.action ?? null,
      query.resourceType ?? null,
      query.limit,
    ],
  );

  return res.rows.map((row) => AuditEventSchema.parse(row));
}

export async function getAdminOverview(
  pool: Pool,
  actor: Pick<AuthTokenClaims, "role" | "countryCode">,
  query: AdminOverviewQuery,
): Promise<AdminOverviewMetrics> {
  const effectiveCountry = resolveScopedCountry(actor, query.countryCode);

  const [countsRes, recentAuditLogs] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE ($1::text IS NULL OR country_code = $1)) AS "totalUsers",
         (SELECT COUNT(*)::int FROM facilities WHERE ($1::text IS NULL OR country_code = $1)) AS "totalFacilities",
         (SELECT COUNT(*)::int FROM facilities WHERE ($1::text IS NULL OR country_code = $1) AND verification_status = 'PENDING_REVIEW') AS "pendingVerificationFacilities",
         (SELECT COUNT(*)::int FROM dispatch_requests WHERE ($1::text IS NULL OR country_code = $1) AND status NOT IN ('COMPLETED', 'CANCELLED')) AS "activeDispatches",
         (SELECT COUNT(*)::int FROM appointments WHERE ($1::text IS NULL OR country_code = $1) AND status IN ('CONFIRMED', 'CHECKED_IN')) AS "activeAppointments",
         (SELECT COUNT(*)::int FROM prescriptions WHERE ($1::text IS NULL OR country_code = $1) AND status = 'ISSUED') AS "openPrescriptions",
         (SELECT COUNT(*)::int FROM lab_orders WHERE ($1::text IS NULL OR country_code = $1) AND status IN ('ORDERED', 'SAMPLE_COLLECTED')) AS "pendingLabOrders",
         (SELECT COUNT(*)::int FROM platform_disputes WHERE ($1::text IS NULL OR country_code = $1) AND status IN ('OPEN', 'UNDER_REVIEW')) AS "openDisputes"`,
      [effectiveCountry],
    ),
    listAuditEventsFiltered(pool, actor, {
      countryCode: effectiveCountry ?? undefined,
      limit: 12,
    }),
  ]);

  const countsRow = countsRes.rows[0] as Record<string, unknown> | undefined;
  return AdminOverviewMetricsSchema.parse({
    countryCode: effectiveCountry,
    ...(countsRow ?? {}),
    recentAuditLogs,
  });
}

const USER_RETURNING_COLUMNS = `
  id,
  email,
  full_name AS "fullName",
  role,
  country_code AS "countryCode",
  facility_id AS "facilityId",
  avatar_object_key AS "avatarObjectKey",
  email_verified AS "emailVerified",
  phone,
  phone_verified AS "phoneVerified",
  account_status AS "accountStatus",
  credential_verified AS "credentialVerified",
  CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
`;

export async function listUsersAdmin(
  pool: Pool,
  actor: Pick<AuthTokenClaims, "role" | "countryCode">,
  query: AdminUsersQuery,
  s3Config?: S3PresignConfig,
): Promise<AuthenticatedUser[]> {
  const effectiveCountry = resolveScopedCountry(actor, query.countryCode);
  const qPattern =
    query.q && query.q.trim().length > 0 ? `%${query.q.trim()}%` : null;

  const res = await pool.query(
    `SELECT
       ${USER_RETURNING_COLUMNS}
     FROM users
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR role = $2)
       AND ($3::text IS NULL OR account_status = $3)
       AND ($4::text IS NULL OR full_name ILIKE $4 OR email ILIKE $4)
     ORDER BY created_at DESC
     LIMIT $5`,
    [
      effectiveCountry,
      query.role ?? null,
      query.accountStatus ?? null,
      qPattern,
      query.limit,
    ],
  );

  return res.rows.map((row) =>
    AuthenticatedUserSchema.parse(
      withUserAvatarUrl(row as Record<string, unknown>, s3Config),
    ),
  );
}

export async function createUserAdmin(
  pool: Pool,
  actor: AuthTokenClaims,
  input: AdminCreateUserInput,
): Promise<AuthenticatedUser> {
  resolveScopedCountry(actor, input.countryCode);
  const passwordHash = await hashPassword(input.password);

  let created: AuthenticatedUser;
  try {
    created = await insertUser(
      pool,
      {
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        role: input.role,
        countryCode: input.countryCode,
        ...(input.facilityId ? { facilityId: input.facilityId } : {}),
      },
      passwordHash,
      {
        accountStatus: input.accountStatus,
        credentialVerified: input.credentialVerified,
        phone: input.phone ?? null,
      },
    );
  } catch (err) {
    if (err instanceof DuplicateConflictError) {
      throw new AdminConflictError(
        "EMAIL_ALREADY_REGISTERED",
        "Email is already registered.",
      );
    }
    throw err;
  }

  await appendAuditLog(pool, {
    countryCode: created.countryCode,
    actorId: actor.sub,
    actorRole: actor.role,
    action: "USER_PROVISIONED_BY_ADMIN",
    resourceType: "user",
    resourceId: created.id,
    metadata: {
      role: created.role,
      accountStatus: created.accountStatus,
      credentialVerified: created.credentialVerified,
    },
  });

  return created;
}

export async function updateUserRoleAdmin(
  pool: Pool,
  targetUserId: string,
  actor: AuthTokenClaims,
  input: UpdateUserRoleInput,
  s3Config?: S3PresignConfig,
  redis?: Redis,
): Promise<AuthenticatedUser> {
  if (actor.sub === targetUserId && input.role !== "OPS_ADMIN") {
    throw new AdminConflictError(
      "CANNOT_SELF_DEMOTE_OPS_ADMIN",
      "An active OPS_ADMIN cannot demote their own role.",
    );
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query(
      `SELECT
         id,
         email,
         full_name AS "fullName",
         role,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         avatar_object_key AS "avatarObjectKey",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [targetUserId],
    );

    if (existingRes.rowCount === 0) {
      throw new AdminNotFoundError("Target user not found.");
    }

    const existingUser = AuthenticatedUserSchema.parse(
      withUserAvatarUrl(existingRes.rows[0] as Record<string, unknown>, s3Config),
    );
    const nextCountryCode =
      input.countryCode?.trim().toUpperCase() ?? existingUser.countryCode;

    const updatedRes = await client.query(
      `UPDATE users
       SET role = $2,
           country_code = $3,
           token_version = token_version + 1
       WHERE id = $1
       RETURNING
         id,
         email,
         full_name AS "fullName",
         role,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         avatar_object_key AS "avatarObjectKey",
         email_verified AS "emailVerified",
         phone,
         phone_verified AS "phoneVerified",
         account_status AS "accountStatus",
         credential_verified AS "credentialVerified",
         CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [targetUserId, input.role, nextCountryCode],
    );

    const updatedUser = AuthenticatedUserSchema.parse(
      withUserAvatarUrl(updatedRes.rows[0] as Record<string, unknown>, s3Config),
    );

    await appendAuditLog(client, {
      countryCode: updatedUser.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "USER_ROLE_UPDATED",
      resourceType: "user",
      resourceId: updatedUser.id,
      metadata: {
        previousRole: existingUser.role,
        nextRole: updatedUser.role,
        previousCountryCode: existingUser.countryCode,
        nextCountryCode: updatedUser.countryCode,
        reason: input.reason?.trim() ?? null,
      },
    });

    await client.query("COMMIT");
    await invalidateUserAuthCache(redis, updatedUser.id);
    return updatedUser;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUserStatusAdmin(
  pool: Pool,
  targetUserId: string,
  actor: AuthTokenClaims,
  input: AdminUpdateUserStatusInput,
  s3Config?: S3PresignConfig,
  redis?: Redis,
): Promise<AuthenticatedUser> {
  if (actor.sub === targetUserId && input.accountStatus === "SUSPENDED") {
    throw new AdminConflictError(
      "CANNOT_SELF_SUSPEND_ADMIN",
      "An active OPS_ADMIN cannot suspend their own account.",
    );
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query(
      `SELECT ${USER_RETURNING_COLUMNS}
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [targetUserId],
    );

    if (existingRes.rowCount === 0) {
      throw new AdminNotFoundError("Target user not found.");
    }

    const existingUser = AuthenticatedUserSchema.parse(
      withUserAvatarUrl(existingRes.rows[0] as Record<string, unknown>, s3Config),
    );
    const shouldBumpVersion = input.accountStatus === "SUSPENDED";

    const updatedRes = await client.query(
      `UPDATE users
       SET account_status = $2,
           credential_verified = COALESCE($3, credential_verified),
           token_version = token_version + CASE WHEN $4::boolean THEN 1 ELSE 0 END
       WHERE id = $1
       RETURNING ${USER_RETURNING_COLUMNS}`,
      [
        targetUserId,
        input.accountStatus,
        input.credentialVerified ?? null,
        shouldBumpVersion,
      ],
    );

    const updatedUser = AuthenticatedUserSchema.parse(
      withUserAvatarUrl(updatedRes.rows[0] as Record<string, unknown>, s3Config),
    );

    await appendAuditLog(client, {
      countryCode: updatedUser.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "USER_STATUS_UPDATED",
      resourceType: "user",
      resourceId: updatedUser.id,
      metadata: {
        previousStatus: existingUser.accountStatus,
        nextStatus: updatedUser.accountStatus,
        credentialVerified: updatedUser.credentialVerified,
        reason: input.reason?.trim() ?? null,
      },
    });

    await client.query("COMMIT");
    await invalidateUserAuthCache(redis, updatedUser.id);
    return updatedUser;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function overrideDispatchAdmin(
  pool: Pool,
  dispatchId: string,
  actor: AuthTokenClaims,
  input: AdminOverrideDispatchInput,
): Promise<DispatchRequestSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentRes = await client.query(
      `SELECT ${DISPATCH_SELECT_COLUMNS}
       FROM dispatch_requests
       WHERE id = $1
       FOR UPDATE`,
      [dispatchId],
    );

    if (currentRes.rowCount === 0) {
      throw new AdminNotFoundError("Dispatch request not found.");
    }

    const currentDispatch = DispatchRequestSummarySchema.parse(
      currentRes.rows[0],
    );
    resolveScopedCountry(actor, currentDispatch.countryCode);

    if (input.driverUserId) {
      const driverRes = await client.query(
        `SELECT id, role, country_code AS "countryCode"
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [input.driverUserId],
      );
      if (driverRes.rowCount === 0) {
        throw new AdminBadRequestError(
          "Assigned driver user account was not found.",
        );
      }
      const driverRow = driverRes.rows[0] as {
        role: string;
        countryCode: string;
      };
      if (driverRow.role !== "DRIVER") {
        throw new AdminBadRequestError(
          "Assigned user must hold the DRIVER role.",
        );
      }
      if (driverRow.countryCode !== currentDispatch.countryCode) {
        throw new AdminBadRequestError(
          "Assigned driver must belong to the same CountryPack jurisdiction.",
        );
      }
    }

    const nextDriverId =
      input.status === "REQUESTED"
        ? (input.driverUserId ?? null)
        : (input.driverUserId ?? currentDispatch.driverUserId);

    if (
      (input.status === "ASSIGNED" ||
        input.status === "EN_ROUTE" ||
        input.status === "ARRIVED") &&
      !nextDriverId
    ) {
      throw new AdminBadRequestError(
        `Dispatch override to ${input.status} requires an assigned driver.`,
      );
    }

    const overrideLine = `[ADMIN OVERRIDE -> ${input.status}]: ${input.note.trim()}`;
    const mergedNotes = (
      currentDispatch.notes
        ? `${currentDispatch.notes} | ${overrideLine}`
        : overrideLine
    ).slice(0, 500);

    const updatedRes = await client.query(
      `UPDATE dispatch_requests
       SET status = $2,
           driver_user_id = $3,
           notes = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${DISPATCH_SELECT_COLUMNS}`,
      [dispatchId, input.status, nextDriverId, mergedNotes],
    );

    const updatedDispatch = DispatchRequestSummarySchema.parse(
      updatedRes.rows[0],
    );

    await appendAuditLog(client, {
      countryCode: updatedDispatch.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "ADMIN_DISPATCH_OVERRIDE",
      resourceType: "dispatch_request",
      resourceId: updatedDispatch.id,
      metadata: {
        previousStatus: currentDispatch.status,
        nextStatus: updatedDispatch.status,
        previousDriverUserId: currentDispatch.driverUserId,
        nextDriverUserId: updatedDispatch.driverUserId,
        note: input.note.trim(),
      },
    });

    await client.query("COMMIT");
    return updatedDispatch;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function createDispute(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateDisputeInput,
): Promise<DisputeSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO platform_disputes (
         country_code,
         reporter_user_id,
         reporter_role,
         category,
         subject,
         description,
         target_resource_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        actor.countryCode,
        actor.sub,
        actor.role,
        input.category,
        input.subject.trim(),
        input.description.trim(),
        input.targetResourceId?.trim() || null,
      ],
    );

    const insertedId = (inserted.rows[0] as { id: string }).id;
    const dispute = await fetchDisputeById(client, insertedId);
    if (!dispute) {
      throw new Error("Created dispute could not be reloaded.");
    }

    await appendAuditLog(client, {
      countryCode: dispute.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DISPUTE_CREATED",
      resourceType: "platform_dispute",
      resourceId: dispute.id,
      metadata: {
        category: dispute.category,
        targetResourceId: dispute.targetResourceId,
      },
    });

    await client.query("COMMIT");
    return dispute;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listDisputesScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  options: {
    countryCode?: string | undefined;
    status?: string | undefined;
    limit: number;
  },
): Promise<DisputeSummary[]> {
  const isGlobalOrHospitalAdmin =
    actor.role === "OPS_ADMIN" || actor.role === "HOSPITAL_ADMIN";
  const effectiveCountry = isGlobalOrHospitalAdmin
    ? resolveScopedCountry(actor, options.countryCode)
    : actor.countryCode;

  const res = await pool.query(
    `SELECT ${DISPUTE_SELECT_COLUMNS}
     FROM platform_disputes d
     JOIN users u ON u.id = d.reporter_user_id
     WHERE ($1::text IS NULL OR d.country_code = $1)
       AND ($2::text IS NULL OR d.status = $2)
       AND ($3::boolean = true OR d.reporter_user_id = $4::uuid)
     ORDER BY d.created_at DESC
     LIMIT $5`,
    [
      effectiveCountry,
      options.status ?? null,
      isGlobalOrHospitalAdmin,
      actor.sub,
      options.limit,
    ],
  );

  return res.rows.map((row) => DisputeSummarySchema.parse(row));
}

export async function resolveDisputeAdmin(
  pool: Pool,
  disputeId: string,
  actor: AuthTokenClaims,
  input: ResolveDisputeInput,
): Promise<DisputeSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query(
      `SELECT id, country_code AS "countryCode", status
       FROM platform_disputes
       WHERE id = $1
       FOR UPDATE`,
      [disputeId],
    );

    if (existingRes.rowCount === 0) {
      throw new AdminNotFoundError("Dispute ticket not found.");
    }

    const existingRow = existingRes.rows[0] as {
      countryCode: string;
      status: string;
    };
    resolveScopedCountry(actor, existingRow.countryCode);

    await client.query(
      `UPDATE platform_disputes
       SET status = $2,
           resolution_note = $3,
           resolved_by_user_id = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [disputeId, input.status, input.resolutionNote.trim(), actor.sub],
    );

    const updated = await fetchDisputeById(client, disputeId);
    if (!updated) {
      throw new Error("Updated dispute could not be reloaded.");
    }

    await appendAuditLog(client, {
      countryCode: updated.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DISPUTE_STATUS_UPDATED",
      resourceType: "platform_dispute",
      resourceId: updated.id,
      metadata: {
        previousStatus: existingRow.status,
        nextStatus: updated.status,
      },
    });

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
