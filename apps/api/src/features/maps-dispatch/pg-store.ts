import type { Pool } from "pg";
import { z } from "zod";
import {
  DispatchRequestSummarySchema,
  ViewportFacilityItemSchema,
  type CreateDispatchRequestInput,
  type DispatchListQuery,
  type DispatchRequestSummary,
  type DispatchStatus,
  type FacilityViewportQuery,
  type UpdateFacilityOperationalStatusInput,
  type UserRole,
  type ViewportFacilityItem,
} from "@medisync/contracts";

export class TargetFacilityInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TargetFacilityInvalidError";
  }
}

export class DispatchNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchNotFoundError";
  }
}

export class DispatchForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchForbiddenError";
  }
}

export class DispatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchConflictError";
  }
}

const FacilityOwnerRowSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string(),
  ownerUserId: z.string().uuid(),
});

const ALLOWED_TRANSITIONS: Record<DispatchStatus, readonly DispatchStatus[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function queryFacilitiesInViewport(
  pool: Pool,
  query: FacilityViewportQuery,
): Promise<{ facilities: ViewportFacilityItem[]; queryMs: number }> {
  const startNs = process.hrtime.bigint();
  const centerLng = (query.minLng + query.maxLng) / 2;
  const centerLat = (query.minLat + query.maxLat) / 2;

  const res = await pool.query(
    `SELECT
       id,
       name,
       kind,
       country_code AS "countryCode",
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       lat,
       lng,
       address,
       owner_user_id AS "ownerUserId",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
       open_status AS "openStatus",
       is_24_7 AS "is24_7",
       accepts_emergency AS "acceptsEmergency",
       specialties,
       phone,
       ROUND(
         ST_Distance(
           location,
           ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography
         )::numeric,
         1
       )::double precision AS "distanceMeters"
     FROM facilities
     WHERE country_code = $1
       AND verification_status = 'VERIFIED'
       AND location && ST_MakeEnvelope($2, $3, $4, $5, 4326)::geography
       AND ($8::text IS NULL OR kind = $8)
       AND ($9::boolean IS NULL OR ($9 = FALSE OR open_status = 'OPEN'))
       AND ($10::boolean IS NULL OR ($10 = FALSE OR accepts_emergency = TRUE))
     ORDER BY location <-> ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography ASC
     LIMIT $11`,
    [
      query.countryCode,
      query.minLng,
      query.minLat,
      query.maxLng,
      query.maxLat,
      centerLng,
      centerLat,
      query.kind ?? null,
      query.openNow ?? null,
      query.acceptsEmergency ?? null,
      query.limit,
    ],
  );

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  return {
    facilities: res.rows.map((row) => ViewportFacilityItemSchema.parse(row)),
    queryMs: Number(elapsedMs.toFixed(2)),
  };
}

export async function updateFacilityOperationalStatus(
  pool: Pool,
  facilityId: string,
  actor: { userId: string; role: UserRole; countryCode: string },
  input: UpdateFacilityOperationalStatusInput,
): Promise<ViewportFacilityItem | null> {
  const existing = await pool.query(
    `SELECT id, country_code AS "countryCode", owner_user_id AS "ownerUserId"
     FROM facilities
     WHERE id = $1
     LIMIT 1`,
    [facilityId],
  );

  if (existing.rowCount === 0) return null;
  const meta = FacilityOwnerRowSchema.parse(existing.rows[0]);

  const isAuthorized =
    actor.role === "OPS_ADMIN" ||
    (meta.ownerUserId === actor.userId &&
      meta.countryCode === actor.countryCode);

  if (!isAuthorized) {
    throw new DispatchForbiddenError(
      "Insufficient permissions to update this facility.",
    );
  }

  const res = await pool.query(
    `UPDATE facilities
     SET
       open_status = $2,
       is_24_7 = COALESCE($3, is_24_7),
       accepts_emergency = COALESCE($4, accepts_emergency),
       specialties = COALESCE($5, specialties),
       phone = CASE WHEN $6::boolean THEN $7 ELSE phone END
     WHERE id = $1
     RETURNING
       id,
       name,
       kind,
       country_code AS "countryCode",
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       lat,
       lng,
       address,
       owner_user_id AS "ownerUserId",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
       open_status AS "openStatus",
       is_24_7 AS "is24_7",
       accepts_emergency AS "acceptsEmergency",
       specialties,
       phone,
       NULL::double precision AS "distanceMeters"`,
    [
      facilityId,
      input.openStatus,
      input.is24_7 ?? null,
      input.acceptsEmergency ?? null,
      input.specialties ?? null,
      input.phone !== undefined,
      input.phone ?? null,
    ],
  );

  if (res.rowCount === 0) return null;
  return ViewportFacilityItemSchema.parse(res.rows[0]);
}

export async function createDispatchRequest(
  pool: Pool,
  patientUserId: string,
  countryCode: string,
  input: CreateDispatchRequestInput,
): Promise<DispatchRequestSummary> {
  if (input.targetFacilityId) {
    const facilityCheck = await pool.query<{ id: string }>(
      `SELECT id
       FROM facilities
       WHERE id = $1
         AND country_code = $2
         AND verification_status = 'VERIFIED'
       LIMIT 1`,
      [input.targetFacilityId, countryCode],
    );
    if (facilityCheck.rowCount === 0) {
      throw new TargetFacilityInvalidError(
        "Target facility must exist in your country jurisdiction and be verified.",
      );
    }
  }

  const res = await pool.query(
    `INSERT INTO dispatch_requests (
       country_code,
       patient_user_id,
       target_facility_id,
       pickup_location,
       pickup_lat,
       pickup_lng,
       pickup_address,
       urgency,
       notes
     )
     VALUES (
       $1,
       $2,
       $3,
       ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
       $4,
       $5,
       $6,
       $7,
       $8
     )
     RETURNING
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
       to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"`,
    [
      countryCode,
      patientUserId,
      input.targetFacilityId ?? null,
      input.pickupLat,
      input.pickupLng,
      input.pickupAddress.trim(),
      input.urgency,
      input.notes?.trim() ?? null,
    ],
  );

  return DispatchRequestSummarySchema.parse(res.rows[0]);
}

export async function listDispatchRequestsScoped(
  pool: Pool,
  query: DispatchListQuery,
  viewer: { userId: string; role: UserRole; countryCode: string },
): Promise<DispatchRequestSummary[]> {
  const effectiveCountry =
    viewer.role === "OPS_ADMIN"
      ? (query.countryCode ?? null)
      : viewer.countryCode;

  const res = await pool.query(
    `SELECT
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
     FROM dispatch_requests
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR status = $2)
       AND (
         $3 IN ('OPS_ADMIN', 'CLINIC_STAFF', 'HOSPITAL_ADMIN')
         OR ($3 = 'DRIVER' AND (driver_user_id = $4::uuid OR status = 'REQUESTED'))
         OR ($3 IN ('PATIENT', 'CAREGIVER') AND patient_user_id = $4::uuid)
       )
     ORDER BY created_at DESC
     LIMIT $5`,
    [
      effectiveCountry,
      query.status ?? null,
      viewer.role,
      viewer.userId,
      query.limit,
    ],
  );

  return res.rows.map((row) => DispatchRequestSummarySchema.parse(row));
}

export async function transitionDispatchStatus(
  pool: Pool,
  actor: { userId: string; role: UserRole; countryCode: string },
  dispatchId: string,
  nextStatus: DispatchStatus,
  requestedDriverId?: string,
): Promise<DispatchRequestSummary> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const currentRes = await client.query(
      `SELECT
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
       FROM dispatch_requests
       WHERE id = $1
       FOR UPDATE`,
      [dispatchId],
    );

    if (currentRes.rowCount === 0) {
      throw new DispatchNotFoundError("Dispatch request not found.");
    }

    const current = DispatchRequestSummarySchema.parse(currentRes.rows[0]);

    if (
      actor.role !== "OPS_ADMIN" &&
      current.countryCode !== actor.countryCode
    ) {
      throw new DispatchForbiddenError(
        "Cross-country dispatch mutation forbidden.",
      );
    }

    const allowedNext = ALLOWED_TRANSITIONS[current.status];
    if (!allowedNext.includes(nextStatus)) {
      throw new DispatchConflictError(
        `Cannot transition dispatch from ${current.status} to ${nextStatus}.`,
      );
    }

    let nextDriverId: string | null = current.driverUserId;

    if (nextStatus === "ASSIGNED") {
      if (actor.role === "DRIVER") {
        if (current.driverUserId && current.driverUserId !== actor.userId) {
          throw new DispatchConflictError("Dispatch already claimed.");
        }
        nextDriverId = actor.userId;
      } else if (
        actor.role === "OPS_ADMIN" ||
        actor.role === "CLINIC_STAFF" ||
        actor.role === "HOSPITAL_ADMIN"
      ) {
        if (!requestedDriverId) {
          throw new DispatchConflictError(
            "Coordinator assignment requires driverUserId.",
          );
        }
        const driverCheck = await client.query<{ id: string }>(
          `SELECT id
           FROM users
           WHERE id = $1 AND role = 'DRIVER' AND country_code = $2
           LIMIT 1`,
          [requestedDriverId, current.countryCode],
        );
        if (driverCheck.rowCount === 0) {
          throw new DispatchForbiddenError(
            "Target driver does not belong to this country jurisdiction.",
          );
        }
        nextDriverId = requestedDriverId;
      } else {
        throw new DispatchForbiddenError("Role cannot assign dispatch.");
      }
    } else if (nextStatus === "EN_ROUTE" || nextStatus === "ARRIVED") {
      const isAssignedDriver =
        actor.role === "DRIVER" && current.driverUserId === actor.userId;
      if (!isAssignedDriver && actor.role !== "OPS_ADMIN") {
        throw new DispatchForbiddenError(
          "Only the assigned driver or ops admin can advance en-route status.",
        );
      }
    } else if (nextStatus === "COMPLETED") {
      const canComplete =
        (actor.role === "DRIVER" && current.driverUserId === actor.userId) ||
        actor.role === "CLINIC_STAFF" ||
        actor.role === "HOSPITAL_ADMIN" ||
        actor.role === "OPS_ADMIN";
      if (!canComplete) {
        throw new DispatchForbiddenError(
          "Role cannot complete this dispatch.",
        );
      }
    } else if (nextStatus === "CANCELLED") {
      const canCancel =
        ((actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
          current.patientUserId === actor.userId &&
          current.status === "REQUESTED") ||
        actor.role === "HOSPITAL_ADMIN" ||
        actor.role === "OPS_ADMIN";
      if (!canCancel) {
        throw new DispatchForbiddenError(
          "Only owning patient (while pending), hospital admin, or ops admin can cancel.",
        );
      }
    }

    const updatedRes = await client.query(
      `UPDATE dispatch_requests
       SET status = $2,
           driver_user_id = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING
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
         to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"`,
      [dispatchId, nextStatus, nextDriverId],
    );

    await client.query("COMMIT");
    return DispatchRequestSummarySchema.parse(updatedRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
