import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  ClinicalMediaObjectSummarySchema,
  LabOrderSummarySchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  PrescriptionSummarySchema,
  VisitNoteSummarySchema,
  type ClinicalFilterQuery,
  type ClinicalMediaObjectSummary,
  type CreateLabOrderInput,
  type CreatePrescriptionInput,
  type CreateVisitNoteInput,
  type DispensePrescriptionInput,
  type LabOrderStatus,
  type LabOrderSummary,
  type PresignClinicalUploadInput,
  type PresignedUploadResponse,
  type PrescriptionSummary,
  type UpdateLabOrderStatusInput,
  type VisitNoteSummary,
} from "@medisync/contracts";
import { appendAuditLog, type AuthTokenClaims } from "../foundation/index.js";
import {
  S3InvalidSignatureError,
  S3ObjectNotFoundError,
  createSigV4PresignedUrl,
  inspectUploadedS3Object,
  sanitizeUploadFileName,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import {
  signPrescriptionQr,
  verifyPrescriptionQr,
} from "./qr-crypto.js";

export class ClinicalBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalBadRequestError";
  }
}

export class ClinicalForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalForbiddenError";
  }
}

export class ClinicalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalNotFoundError";
  }
}

export class ClinicalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalConflictError";
  }
}

export class ClinicalInvalidMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalInvalidMediaError";
  }
}

const LAB_TRANSITIONS: Record<LabOrderStatus, readonly LabOrderStatus[]> = {
  ORDERED: ["SAMPLE_COLLECTED", "COMPLETED", "CANCELLED"],
  SAMPLE_COLLECTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

async function validatePatientAndCountry(
  db: Pick<Pool, "query"> | PoolClient,
  actor: AuthTokenClaims,
  patientUserId: string,
  facilityId?: string,
): Promise<{ countryCode: string }> {
  const patientRes = await db.query<{
    id: string;
    countryCode: string;
  }>(
    `SELECT id, country_code AS "countryCode" FROM users WHERE id = $1`,
    [patientUserId],
  );
  const patient = patientRes.rows[0];
  if (!patient) {
    throw new ClinicalNotFoundError("Patient account not found.");
  }

  if (
    actor.role !== "OPS_ADMIN" &&
    actor.countryCode !== patient.countryCode
  ) {
    throw new ClinicalForbiddenError(
      "Cross-country clinical record access is forbidden.",
    );
  }

  if (facilityId) {
    const facRes = await db.query<{
      id: string;
      countryCode: string;
      verificationStatus: string;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         verification_status AS "verificationStatus"
       FROM facilities WHERE id = $1`,
      [facilityId],
    );
    const fac = facRes.rows[0];
    if (!fac) {
      throw new ClinicalNotFoundError("Facility not found.");
    }
    if (fac.verificationStatus === "SUSPENDED") {
      throw new ClinicalForbiddenError("Facility is suspended.");
    }
    if (fac.countryCode !== patient.countryCode) {
      throw new ClinicalForbiddenError(
        "Facility and patient must belong to the same CountryPack jurisdiction.",
      );
    }
  }

  return { countryCode: patient.countryCode };
}

function resolveScopedPatientAndCountry(
  actor: AuthTokenClaims,
  query: ClinicalFilterQuery,
): { countryCode: string | null; patientUserId: string | null } {
  if (actor.role === "PATIENT" || actor.role === "CAREGIVER") {
    if (query.patientUserId && query.patientUserId !== actor.sub) {
      throw new ClinicalForbiddenError(
        "Patients may only access their own medical records.",
      );
    }
    return {
      countryCode: actor.countryCode,
      patientUserId: actor.sub,
    };
  }

  if (actor.role === "OPS_ADMIN") {
    return {
      countryCode: query.countryCode ?? null,
      patientUserId: query.patientUserId ?? null,
    };
  }

  if (query.countryCode && query.countryCode !== actor.countryCode) {
    throw new ClinicalForbiddenError(
      "Cross-country query blocked by CountryPack tenancy.",
    );
  }

  return {
    countryCode: actor.countryCode,
    patientUserId: query.patientUserId ?? null,
  };
}

export async function createVisitNote(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateVisitNoteInput,
): Promise<VisitNoteSummary> {
  const client = await pool.connect();
  let insertedId: string;

  try {
    await client.query("BEGIN");
    const { countryCode } = await validatePatientAndCountry(
      client,
      actor,
      input.patientUserId,
      input.facilityId,
    );

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO visit_notes (
         country_code,
         patient_user_id,
         doctor_user_id,
         appointment_id,
         facility_id,
         icd10_codes,
         subjective,
         objective,
         assessment,
         plan,
         vitals
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id`,
      [
        countryCode,
        input.patientUserId,
        actor.sub,
        input.appointmentId ?? null,
        input.facilityId ?? null,
        input.icd10Codes,
        input.subjective,
        input.objective,
        input.assessment,
        input.plan,
        input.vitals ? JSON.stringify(input.vitals) : null,
      ],
    );

    insertedId = insertRes.rows[0]!.id;

    await appendAuditLog(client, {
      countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "VISIT_NOTE_CREATED",
      resourceType: "visit_note",
      resourceId: insertedId,
      metadata: {
        patientUserId: input.patientUserId,
        icd10Count: input.icd10Codes.length,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const res = await pool.query(
    `SELECT
       vn.id,
       vn.country_code AS "countryCode",
       vn.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       vn.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       vn.appointment_id AS "appointmentId",
       vn.facility_id AS "facilityId",
       vn.icd10_codes AS "icd10Codes",
       vn.subjective,
       vn.objective,
       vn.assessment,
       vn.plan,
       vn.vitals,
       to_char(vn.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM visit_notes vn
     JOIN users pat ON pat.id = vn.patient_user_id
     JOIN users doc ON doc.id = vn.doctor_user_id
     WHERE vn.id = $1`,
    [insertedId],
  );
  return VisitNoteSummarySchema.parse(res.rows[0]);
}

export async function listVisitNotesScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: ClinicalFilterQuery,
): Promise<VisitNoteSummary[]> {
  const scope = resolveScopedPatientAndCountry(actor, query);
  const res = await pool.query(
    `SELECT
       vn.id,
       vn.country_code AS "countryCode",
       vn.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       vn.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       vn.appointment_id AS "appointmentId",
       vn.facility_id AS "facilityId",
       vn.icd10_codes AS "icd10Codes",
       vn.subjective,
       vn.objective,
       vn.assessment,
       vn.plan,
       vn.vitals,
       to_char(vn.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM visit_notes vn
     JOIN users pat ON pat.id = vn.patient_user_id
     JOIN users doc ON doc.id = vn.doctor_user_id
     WHERE ($1::text IS NULL OR vn.country_code = $1)
       AND ($2::uuid IS NULL OR vn.patient_user_id = $2)
     ORDER BY vn.created_at DESC
     LIMIT $3`,
    [scope.countryCode, scope.patientUserId, query.limit],
  );
  return res.rows.map((row) => VisitNoteSummarySchema.parse(row));
}

async function fetchPrescriptionById(
  db: Pick<Pool, "query"> | PoolClient,
  id: string,
): Promise<PrescriptionSummary | null> {
  const res = await db.query(
    `SELECT
       p.id,
       p.country_code AS "countryCode",
       p.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       p.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       p.facility_id AS "facilityId",
       p.medications,
       p.notes,
       p.qr_token AS "qrToken",
       p.qr_signature AS "qrSignature",
       p.status,
       p.dispensed_by_user_id AS "dispensedByUserId",
       p.pharmacy_facility_id AS "pharmacyFacilityId",
       to_char(p.dispensed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dispensedAtIso",
       p.dispensing_note AS "dispensingNote",
       to_char(p.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "issuedAtIso"
     FROM prescriptions p
     JOIN users pat ON pat.id = p.patient_user_id
     JOIN users doc ON doc.id = p.doctor_user_id
     WHERE p.id = $1`,
    [id],
  );
  if (res.rowCount === 0) return null;
  return PrescriptionSummarySchema.parse(res.rows[0]);
}

export async function createPrescription(
  pool: Pool,
  actor: AuthTokenClaims,
  authSecret: string,
  input: CreatePrescriptionInput,
): Promise<PrescriptionSummary> {
  const client = await pool.connect();
  const rxId = crypto.randomUUID();
  const nonce = crypto.randomBytes(12).toString("hex");

  try {
    await client.query("BEGIN");
    const { countryCode } = await validatePatientAndCountry(
      client,
      actor,
      input.patientUserId,
      input.facilityId,
    );

    const { qrToken, qrSignature } = signPrescriptionQr(
      {
        rxId,
        countryCode,
        patientUserId: input.patientUserId,
        doctorUserId: actor.sub,
        nonce,
      },
      authSecret,
    );

    await client.query(
      `INSERT INTO prescriptions (
         id,
         country_code,
         patient_user_id,
         doctor_user_id,
         appointment_id,
         facility_id,
         medications,
         notes,
         qr_nonce,
         qr_token,
         qr_signature
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)`,
      [
        rxId,
        countryCode,
        input.patientUserId,
        actor.sub,
        input.appointmentId ?? null,
        input.facilityId ?? null,
        JSON.stringify(input.medications),
        input.notes ?? null,
        nonce,
        qrToken,
        qrSignature,
      ],
    );

    await appendAuditLog(client, {
      countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PRESCRIPTION_ISSUED",
      resourceType: "prescription",
      resourceId: rxId,
      metadata: {
        patientUserId: input.patientUserId,
        medicationCount: input.medications.length,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const hydrated = await fetchPrescriptionById(pool, rxId);
  if (!hydrated) {
    throw new Error("Created prescription could not be retrieved.");
  }
  return hydrated;
}

export async function listPrescriptionsScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: ClinicalFilterQuery,
): Promise<PrescriptionSummary[]> {
  const scope = resolveScopedPatientAndCountry(actor, query);
  const res = await pool.query(
    `SELECT
       p.id,
       p.country_code AS "countryCode",
       p.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       p.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       p.facility_id AS "facilityId",
       p.medications,
       p.notes,
       p.qr_token AS "qrToken",
       p.qr_signature AS "qrSignature",
       p.status,
       p.dispensed_by_user_id AS "dispensedByUserId",
       p.pharmacy_facility_id AS "pharmacyFacilityId",
       to_char(p.dispensed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dispensedAtIso",
       p.dispensing_note AS "dispensingNote",
       to_char(p.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "issuedAtIso"
     FROM prescriptions p
     JOIN users pat ON pat.id = p.patient_user_id
     JOIN users doc ON doc.id = p.doctor_user_id
     WHERE ($1::text IS NULL OR p.country_code = $1)
       AND ($2::uuid IS NULL OR p.patient_user_id = $2)
       AND ($3::text IS NULL OR p.status = $3)
     ORDER BY p.issued_at DESC
     LIMIT $4`,
    [
      scope.countryCode,
      scope.patientUserId,
      query.status ?? null,
      query.limit,
    ],
  );
  return res.rows.map((row) => PrescriptionSummarySchema.parse(row));
}

export async function verifyPrescriptionQrRecord(
  pool: Pool,
  actor: AuthTokenClaims,
  authSecret: string,
  qrToken: string,
): Promise<PrescriptionSummary> {
  const claims = verifyPrescriptionQr(qrToken, authSecret);
  if (!claims) {
    throw new ClinicalBadRequestError("INVALID_QR_SIGNATURE");
  }

  const rx = await fetchPrescriptionById(pool, claims.rxId);
  if (!rx || rx.qrToken !== qrToken.trim()) {
    throw new ClinicalNotFoundError("Prescription matching QR code was not found.");
  }

  if (actor.role !== "OPS_ADMIN" && rx.countryCode !== actor.countryCode) {
    throw new ClinicalForbiddenError(
      "Cross-country prescription verification is forbidden.",
    );
  }

  return rx;
}

export async function dispensePrescriptionAtomic(
  pool: Pool,
  prescriptionId: string,
  actor: AuthTokenClaims,
  input: DispensePrescriptionInput,
): Promise<PrescriptionSummary> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkRes = await client.query<{
      id: string;
      countryCode: string;
      status: string;
    }>(
      `SELECT id, country_code AS "countryCode", status
       FROM prescriptions
       WHERE id = $1`,
      [prescriptionId],
    );
    const existing = checkRes.rows[0];
    if (!existing) {
      throw new ClinicalNotFoundError("Prescription not found.");
    }
    if (actor.role !== "OPS_ADMIN" && existing.countryCode !== actor.countryCode) {
      throw new ClinicalForbiddenError(
        "Cross-country pharmacy dispensing is forbidden.",
      );
    }

    // Atomic conditional update: guarantees only one concurrent pharmacist request wins
    const updateRes = await client.query<{ id: string }>(
      `UPDATE prescriptions
       SET status = 'DISPENSED',
           dispensed_by_user_id = $2,
           pharmacy_facility_id = $3,
           dispensed_at = NOW(),
           dispensing_note = $4
       WHERE id = $1
         AND status = 'ISSUED'
       RETURNING id`,
      [
        prescriptionId,
        actor.sub,
        input.pharmacyFacilityId ?? actor.facilityId ?? null,
        input.dispensingNote ?? null,
      ],
    );

    if (updateRes.rowCount === 0) {
      throw new ClinicalConflictError("PRESCRIPTION_ALREADY_DISPENSED");
    }

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PRESCRIPTION_DISPENSED",
      resourceType: "prescription",
      resourceId: prescriptionId,
      metadata: {
        pharmacyFacilityId: input.pharmacyFacilityId ?? actor.facilityId ?? null,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const hydrated = await fetchPrescriptionById(pool, prescriptionId);
  if (!hydrated) {
    throw new Error("Dispensed prescription could not be retrieved.");
  }
  return hydrated;
}

async function fetchLabOrderById(
  db: Pick<Pool, "query"> | PoolClient,
  id: string,
): Promise<LabOrderSummary | null> {
  const res = await db.query(
    `SELECT
       lo.id,
       lo.country_code AS "countryCode",
       lo.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       lo.ordered_by_doctor_id AS "orderedByDoctorId",
       doc.full_name AS "orderedByDoctorName",
       lo.facility_id AS "facilityId",
       f.name AS "facilityName",
       lo.appointment_id AS "appointmentId",
       lo.panel_name AS "panelName",
       lo.urgency,
       lo.clinical_notes AS "clinicalNotes",
       lo.status,
       lo.result_summary AS "resultSummary",
       lo.report_object_key AS "reportObjectKey",
       to_char(lo.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
       to_char(lo.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
     FROM lab_orders lo
     JOIN users pat ON pat.id = lo.patient_user_id
     JOIN users doc ON doc.id = lo.ordered_by_doctor_id
     JOIN facilities f ON f.id = lo.facility_id
     WHERE lo.id = $1`,
    [id],
  );
  if (res.rowCount === 0) return null;
  return LabOrderSummarySchema.parse(res.rows[0]);
}

export async function createLabOrder(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateLabOrderInput,
): Promise<LabOrderSummary> {
  const client = await pool.connect();
  let insertedId: string;

  try {
    await client.query("BEGIN");
    const { countryCode } = await validatePatientAndCountry(
      client,
      actor,
      input.patientUserId,
      input.facilityId,
    );

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO lab_orders (
         country_code,
         patient_user_id,
         ordered_by_doctor_id,
         facility_id,
         appointment_id,
         panel_name,
         urgency,
         clinical_notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        countryCode,
        input.patientUserId,
        actor.sub,
        input.facilityId,
        input.appointmentId ?? null,
        input.panelName,
        input.urgency,
        input.clinicalNotes ?? null,
      ],
    );
    insertedId = insertRes.rows[0]!.id;

    await appendAuditLog(client, {
      countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "LAB_ORDER_CREATED",
      resourceType: "lab_order",
      resourceId: insertedId,
      metadata: {
        panelName: input.panelName,
        urgency: input.urgency,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const hydrated = await fetchLabOrderById(pool, insertedId);
  if (!hydrated) {
    throw new Error("Created lab order could not be retrieved.");
  }
  return hydrated;
}

export async function listLabOrdersScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: ClinicalFilterQuery,
): Promise<LabOrderSummary[]> {
  const scope = resolveScopedPatientAndCountry(actor, query);
  const res = await pool.query(
    `SELECT
       lo.id,
       lo.country_code AS "countryCode",
       lo.patient_user_id AS "patientUserId",
       pat.full_name AS "patientName",
       lo.ordered_by_doctor_id AS "orderedByDoctorId",
       doc.full_name AS "orderedByDoctorName",
       lo.facility_id AS "facilityId",
       f.name AS "facilityName",
       lo.appointment_id AS "appointmentId",
       lo.panel_name AS "panelName",
       lo.urgency,
       lo.clinical_notes AS "clinicalNotes",
       lo.status,
       lo.result_summary AS "resultSummary",
       lo.report_object_key AS "reportObjectKey",
       to_char(lo.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
       to_char(lo.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
     FROM lab_orders lo
     JOIN users pat ON pat.id = lo.patient_user_id
     JOIN users doc ON doc.id = lo.ordered_by_doctor_id
     JOIN facilities f ON f.id = lo.facility_id
     WHERE ($1::text IS NULL OR lo.country_code = $1)
       AND ($2::uuid IS NULL OR lo.patient_user_id = $2)
       AND ($3::text IS NULL OR lo.status = $3)
     ORDER BY lo.created_at DESC
     LIMIT $4`,
    [
      scope.countryCode,
      scope.patientUserId,
      query.status ?? null,
      query.limit,
    ],
  );
  return res.rows.map((row) => LabOrderSummarySchema.parse(row));
}

export async function updateLabOrderStatus(
  pool: Pool,
  labOrderId: string,
  actor: AuthTokenClaims,
  input: UpdateLabOrderStatusInput,
): Promise<LabOrderSummary> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const curRes = await client.query<{
      id: string;
      countryCode: string;
      status: LabOrderStatus;
    }>(
      `SELECT id, country_code AS "countryCode", status
       FROM lab_orders WHERE id = $1 FOR UPDATE`,
      [labOrderId],
    );
    const existing = curRes.rows[0];
    if (!existing) {
      throw new ClinicalNotFoundError("Lab order not found.");
    }
    if (actor.role !== "OPS_ADMIN" && existing.countryCode !== actor.countryCode) {
      throw new ClinicalForbiddenError(
        "Cross-country lab order access is forbidden.",
      );
    }

    const allowed = LAB_TRANSITIONS[existing.status];
    if (!allowed.includes(input.status)) {
      throw new ClinicalConflictError(
        `Cannot transition lab order from ${existing.status} to ${input.status}.`,
      );
    }

    await client.query(
      `UPDATE lab_orders
       SET status = $2,
           result_summary = COALESCE($3, result_summary),
           report_object_key = COALESCE($4, report_object_key),
           updated_by_user_id = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [
        labOrderId,
        input.status,
        input.resultSummary ?? null,
        input.reportObjectKey ?? null,
        actor.sub,
      ],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "LAB_ORDER_UPDATED",
      resourceType: "lab_order",
      resourceId: labOrderId,
      metadata: {
        fromStatus: existing.status,
        toStatus: input.status,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const hydrated = await fetchLabOrderById(pool, labOrderId);
  if (!hydrated) {
    throw new Error("Updated lab order not found.");
  }
  return hydrated;
}

export async function createPresignedMediaUpload(
  pool: Pool,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  input: PresignClinicalUploadInput,
): Promise<PresignedUploadResponse> {
  if (
    (actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
    input.patientUserId !== actor.sub
  ) {
    throw new ClinicalForbiddenError(
      "Patients may only upload medical documents to their own record.",
    );
  }

  const client = await pool.connect();
  const objectId = crypto.randomUUID();
  const safeName = sanitizeUploadFileName(input.fileName);

  let countryCode: string;
  let objectKey: string;

  try {
    await client.query("BEGIN");
    const validated = await validatePatientAndCountry(
      client,
      actor,
      input.patientUserId,
    );
    countryCode = validated.countryCode;

    if (input.labOrderId) {
      const labRes = await client.query<{
        id: string;
        patientUserId: string;
        countryCode: string;
      }>(
        `SELECT
           id,
           patient_user_id AS "patientUserId",
           country_code AS "countryCode"
         FROM lab_orders WHERE id = $1`,
        [input.labOrderId],
      );
      const lab = labRes.rows[0];
      if (!lab) {
        throw new ClinicalNotFoundError("Referenced lab order not found.");
      }
      if (lab.patientUserId !== input.patientUserId || lab.countryCode !== countryCode) {
        throw new ClinicalBadRequestError(
          "Referenced lab order does not match patient or CountryPack.",
        );
      }
    }

    objectKey = `clinical/${countryCode}/${input.patientUserId}/${objectId}-${safeName}`;

    await client.query(
      `INSERT INTO clinical_media_objects (
         id,
         country_code,
         patient_user_id,
         lab_order_id,
         uploaded_by_user_id,
         media_category,
         object_key,
         file_name,
         mime_type,
         size_bytes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        objectId,
        countryCode,
        input.patientUserId,
        input.labOrderId ?? null,
        actor.sub,
        input.mediaCategory ?? "OTHER",
        objectKey,
        safeName,
        input.mimeType,
        input.sizeBytes,
      ],
    );

    await appendAuditLog(client, {
      countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "CLINICAL_MEDIA_PRESIGNED",
      resourceType: "clinical_media",
      resourceId: objectId,
      metadata: {
        mediaCategory: input.mediaCategory ?? "OTHER",
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const uploadUrl = createSigV4PresignedUrl({
    config: s3Config,
    method: "PUT",
    objectKey,
    contentType: input.mimeType,
  });
  const downloadUrl = createSigV4PresignedUrl({
    config: s3Config,
    method: "GET",
    objectKey,
  });

  const mediaRow = await pool.query(
    `SELECT
       id,
       country_code AS "countryCode",
       patient_user_id AS "patientUserId",
       lab_order_id AS "labOrderId",
       uploaded_by_user_id AS "uploadedByUserId",
       media_category AS "mediaCategory",
       object_key AS "objectKey",
       file_name AS "fileName",
       mime_type AS "mimeType",
       size_bytes AS "sizeBytes",
       confirmed_size_bytes AS "confirmedSizeBytes",
       upload_status AS "uploadStatus",
       sha256_checksum AS "sha256Checksum",
       CASE WHEN confirmed_at IS NULL THEN NULL ELSE to_char(confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "confirmedAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM clinical_media_objects WHERE id = $1`,
    [objectId],
  );

  const raw = mediaRow.rows[0] as Record<string, unknown>;
  const mediaObject: ClinicalMediaObjectSummary =
    ClinicalMediaObjectSummarySchema.parse({
      ...raw,
      downloadUrl,
    });

  return {
    mediaObject,
    uploadUrl,
    method: "PUT",
    expiresInSeconds: s3Config.expiresInSeconds,
    maxBytes: MAX_CLINICAL_UPLOAD_BYTES,
    requiredHeaders: {
      "content-type": input.mimeType,
    },
  };
}

export async function confirmClinicalMediaUpload(
  pool: Pool,
  mediaId: string,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
): Promise<ClinicalMediaObjectSummary> {
  const rowRes = await pool.query<{
    id: string;
    countryCode: string;
    patientUserId: string;
    uploadedByUserId: string;
    objectKey: string;
    mimeType: string;
  }>(
    `SELECT
       id,
       country_code AS "countryCode",
       patient_user_id AS "patientUserId",
       uploaded_by_user_id AS "uploadedByUserId",
       object_key AS "objectKey",
       mime_type AS "mimeType"
     FROM clinical_media_objects
     WHERE id = $1`,
    [mediaId],
  );
  const existing = rowRes.rows[0];
  if (!existing) {
    throw new ClinicalNotFoundError("Clinical media object not found.");
  }

  if (actor.role !== "OPS_ADMIN" && existing.countryCode !== actor.countryCode) {
    throw new ClinicalForbiddenError(
      "Cross-country clinical media confirmation is forbidden.",
    );
  }
  if (
    (actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
    existing.patientUserId !== actor.sub
  ) {
    throw new ClinicalForbiddenError(
      "Cannot confirm medical media uploaded for another patient.",
    );
  }

  let observedSizeBytes: number;
  let sha256Checksum: string;
  try {
    const inspected = await inspectUploadedS3Object({
      config: s3Config,
      objectKey: existing.objectKey,
      expectedMimeType: existing.mimeType,
      maxBytes: MAX_CLINICAL_UPLOAD_BYTES,
    });
    observedSizeBytes = inspected.observedSizeBytes;
    sha256Checksum = inspected.sha256Checksum;
  } catch (err) {
    if (err instanceof S3ObjectNotFoundError) {
      throw new ClinicalNotFoundError(err.message);
    }
    if (err instanceof S3InvalidSignatureError) {
      await pool.query(
        `UPDATE clinical_media_objects SET upload_status = 'FAILED' WHERE id = $1`,
        [mediaId],
      );
      throw new ClinicalInvalidMediaError(err.message);
    }
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE clinical_media_objects
       SET upload_status = 'UPLOADED',
           confirmed_size_bytes = $2,
           sha256_checksum = $3,
           confirmed_at = NOW()
       WHERE id = $1`,
      [mediaId, observedSizeBytes, sha256Checksum],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "CLINICAL_MEDIA_CONFIRMED",
      resourceType: "clinical_media",
      resourceId: mediaId,
      metadata: {
        observedSizeBytes,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const refreshed = await pool.query(
    `SELECT
       id,
       country_code AS "countryCode",
       patient_user_id AS "patientUserId",
       lab_order_id AS "labOrderId",
       uploaded_by_user_id AS "uploadedByUserId",
       media_category AS "mediaCategory",
       object_key AS "objectKey",
       file_name AS "fileName",
       mime_type AS "mimeType",
       size_bytes AS "sizeBytes",
       confirmed_size_bytes AS "confirmedSizeBytes",
       upload_status AS "uploadStatus",
       sha256_checksum AS "sha256Checksum",
       CASE WHEN confirmed_at IS NULL THEN NULL ELSE to_char(confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "confirmedAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM clinical_media_objects WHERE id = $1`,
    [mediaId],
  );
  const raw = refreshed.rows[0] as Record<string, unknown>;
  return ClinicalMediaObjectSummarySchema.parse({
    ...raw,
    downloadUrl: createSigV4PresignedUrl({
      config: s3Config,
      method: "GET",
      objectKey: String(raw.objectKey),
    }),
  });
}

export async function listClinicalMediaScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  s3Config: S3PresignConfig,
  query: ClinicalFilterQuery,
): Promise<ClinicalMediaObjectSummary[]> {
  const scope = resolveScopedPatientAndCountry(actor, query);
  const res = await pool.query(
    `SELECT
       id,
       country_code AS "countryCode",
       patient_user_id AS "patientUserId",
       lab_order_id AS "labOrderId",
       uploaded_by_user_id AS "uploadedByUserId",
       media_category AS "mediaCategory",
       object_key AS "objectKey",
       file_name AS "fileName",
       mime_type AS "mimeType",
       size_bytes AS "sizeBytes",
       confirmed_size_bytes AS "confirmedSizeBytes",
       upload_status AS "uploadStatus",
       sha256_checksum AS "sha256Checksum",
       CASE WHEN confirmed_at IS NULL THEN NULL ELSE to_char(confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "confirmedAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM clinical_media_objects
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::uuid IS NULL OR patient_user_id = $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [scope.countryCode, scope.patientUserId, query.limit],
  );

  return res.rows.map((row) => {
    const record = row as Record<string, unknown>;
    const objectKey = String(record.objectKey);
    return ClinicalMediaObjectSummarySchema.parse({
      ...record,
      downloadUrl: createSigV4PresignedUrl({
        config: s3Config,
        method: "GET",
        objectKey,
      }),
    });
  });
}
