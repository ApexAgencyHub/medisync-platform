import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  MedicalInvoiceSummarySchema,
  MedicalServiceSummarySchema,
  PatientInsurancePolicySchema,
  PatientMedicalProfileSchema,
  type CreateMedicalInvoiceInput,
  type CreateMedicalServiceInput,
  type CreatePatientInsuranceInput,
  type ListMedicalInvoicesQuery,
  type ListMedicalServicesQuery,
  type MedicalInvoiceSummary,
  type MedicalServiceSummary,
  type PatientInsurancePolicy,
  type PatientMedicalProfile,
  type PayMedicalInvoiceInput,
  type UpsertPatientMedicalProfileInput,
  type UserRole,
} from "@medisync/contracts";
import { resolveCountryPack } from "@medisync/country-packs";
import { appendAuditLog, type AuthTokenClaims } from "../foundation/index.js";

export class MedicalPlatformForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedicalPlatformForbiddenError";
  }
}

export class MedicalPlatformNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedicalPlatformNotFoundError";
  }
}

export class MedicalPlatformConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedicalPlatformConflictError";
  }
}

export class MedicalPlatformBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedicalPlatformBadRequestError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

async function resolvePatientTargetScope(
  db: Pick<Pool, "query">,
  targetPatientId: string,
  actor: Pick<AuthTokenClaims, "sub" | "role" | "countryCode">,
): Promise<{ id: string; fullName: string; countryCode: string }> {
  if (
    (actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
    actor.sub !== targetPatientId
  ) {
    throw new MedicalPlatformForbiddenError(
      "Patients and caregivers can only access their own health records.",
    );
  }

  const userRes = await db.query<{
    id: string;
    fullName: string;
    countryCode: string;
    role: UserRole;
  }>(
    `SELECT id, full_name AS "fullName", country_code AS "countryCode", role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [targetPatientId],
  );
  const patient = userRes.rows[0];
  if (!patient) {
    throw new MedicalPlatformNotFoundError("PATIENT_NOT_FOUND");
  }

  if (
    actor.role !== "OPS_ADMIN" &&
    patient.countryCode !== actor.countryCode
  ) {
    throw new MedicalPlatformForbiddenError(
      "Cross-country access to patient medical records is forbidden.",
    );
  }

  return {
    id: patient.id,
    fullName: patient.fullName,
    countryCode: patient.countryCode,
  };
}

const MEDICAL_PROFILE_SELECT = `
  p.user_id AS "userId",
  u.full_name AS "fullName",
  p.country_code AS "countryCode",
  CASE WHEN p.date_of_birth IS NULL THEN NULL ELSE to_char(p.date_of_birth, 'YYYY-MM-DD') END AS "dateOfBirth",
  p.biological_sex AS "biologicalSex",
  p.blood_type AS "bloodType",
  p.national_health_id AS "nationalHealthId",
  p.emergency_contact_name AS "emergencyContactName",
  p.emergency_contact_phone AS "emergencyContactPhone",
  p.height_cm::float8 AS "heightCm",
  p.weight_kg::float8 AS "weightKg",
  p.allergies,
  p.chronic_conditions AS "chronicConditions",
  p.current_medications AS "currentMedications",
  p.primary_doctor_user_id AS "primaryDoctorUserId",
  p.preferred_facility_id AS "preferredFacilityId",
  p.data_sharing_consent AS "dataSharingConsent",
  p.telehealth_consent AS "telehealthConsent",
  to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

export async function getPatientMedicalProfileScoped(
  pool: Pool,
  targetPatientId: string,
  actor: AuthTokenClaims,
): Promise<PatientMedicalProfile> {
  const patient = await resolvePatientTargetScope(pool, targetPatientId, actor);

  const existing = await pool.query(
    `SELECT ${MEDICAL_PROFILE_SELECT}
     FROM patient_medical_profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [patient.id],
  );
  if (existing.rows[0]) {
    return PatientMedicalProfileSchema.parse(existing.rows[0]);
  }

  return PatientMedicalProfileSchema.parse({
    userId: patient.id,
    fullName: patient.fullName,
    countryCode: patient.countryCode,
    dateOfBirth: null,
    biologicalSex: "UNSPECIFIED",
    bloodType: "UNKNOWN",
    nationalHealthId: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    heightCm: null,
    weightKg: null,
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    primaryDoctorUserId: null,
    preferredFacilityId: null,
    dataSharingConsent: true,
    telehealthConsent: true,
    updatedAtIso: new Date().toISOString(),
  });
}

export async function upsertPatientMedicalProfileScoped(
  pool: Pool,
  targetPatientId: string,
  actor: AuthTokenClaims,
  input: UpsertPatientMedicalProfileInput,
): Promise<PatientMedicalProfile> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const patient = await resolvePatientTargetScope(client, targetPatientId, actor);

    await client.query(
      `INSERT INTO patient_medical_profiles (
         user_id,
         country_code,
         date_of_birth,
         biological_sex,
         blood_type,
         national_health_id,
         emergency_contact_name,
         emergency_contact_phone,
         height_cm,
         weight_kg,
         allergies,
         chronic_conditions,
         current_medications,
         primary_doctor_user_id,
         preferred_facility_id,
         data_sharing_consent,
         telehealth_consent,
         updated_by_user_id,
         updated_at
       )
       VALUES (
         $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10,
         $11::jsonb, $12::text[], $13::text[], $14, $15, $16, $17, $18, NOW()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         date_of_birth = EXCLUDED.date_of_birth,
         biological_sex = EXCLUDED.biological_sex,
         blood_type = EXCLUDED.blood_type,
         national_health_id = EXCLUDED.national_health_id,
         emergency_contact_name = EXCLUDED.emergency_contact_name,
         emergency_contact_phone = EXCLUDED.emergency_contact_phone,
         height_cm = EXCLUDED.height_cm,
         weight_kg = EXCLUDED.weight_kg,
         allergies = EXCLUDED.allergies,
         chronic_conditions = EXCLUDED.chronic_conditions,
         current_medications = EXCLUDED.current_medications,
         primary_doctor_user_id = EXCLUDED.primary_doctor_user_id,
         preferred_facility_id = EXCLUDED.preferred_facility_id,
         data_sharing_consent = EXCLUDED.data_sharing_consent,
         telehealth_consent = EXCLUDED.telehealth_consent,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()`,
      [
        patient.id,
        patient.countryCode,
        input.dateOfBirth ?? null,
        input.biologicalSex,
        input.bloodType,
        input.nationalHealthId ?? null,
        input.emergencyContactName ?? null,
        input.emergencyContactPhone ?? null,
        input.heightCm ?? null,
        input.weightKg ?? null,
        JSON.stringify(input.allergies),
        input.chronicConditions,
        input.currentMedications,
        input.primaryDoctorUserId ?? null,
        input.preferredFacilityId ?? null,
        input.dataSharingConsent,
        input.telehealthConsent,
        actor.sub,
      ],
    );

    await appendAuditLog(client, {
      countryCode: patient.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PATIENT_MEDICAL_PROFILE_UPSERTED",
      resourceType: "patient_medical_profile",
      resourceId: patient.id,
      metadata: {
        bloodType: input.bloodType,
        allergiesCount: input.allergies.length,
        chronicConditionsCount: input.chronicConditions.length,
      },
    });

    const loaded = await client.query(
      `SELECT ${MEDICAL_PROFILE_SELECT}
       FROM patient_medical_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
       LIMIT 1`,
      [patient.id],
    );

    await client.query("COMMIT");
    return PatientMedicalProfileSchema.parse(loaded.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

const INSURANCE_SELECT_COLUMNS = `
  id,
  user_id AS "userId",
  country_code AS "countryCode",
  provider_name AS "providerName",
  policy_number AS "policyNumber",
  member_id AS "memberId",
  coverage_plan AS "coveragePlan",
  coverage_percent AS "coveragePercent",
  CASE WHEN valid_until IS NULL THEN NULL ELSE to_char(valid_until, 'YYYY-MM-DD') END AS "validUntil",
  is_primary AS "isPrimary",
  verification_status AS "verificationStatus",
  card_media_id AS "cardMediaId",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

export async function listPatientInsurancesScoped(
  pool: Pool,
  targetPatientId: string,
  actor: AuthTokenClaims,
): Promise<PatientInsurancePolicy[]> {
  const patient = await resolvePatientTargetScope(pool, targetPatientId, actor);
  const res = await pool.query(
    `SELECT ${INSURANCE_SELECT_COLUMNS}
     FROM patient_insurance_policies
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at DESC`,
    [patient.id],
  );
  return res.rows.map((row) => PatientInsurancePolicySchema.parse(row));
}

export async function createPatientInsuranceScoped(
  pool: Pool,
  targetPatientId: string,
  actor: AuthTokenClaims,
  input: CreatePatientInsuranceInput,
): Promise<PatientInsurancePolicy> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const patient = await resolvePatientTargetScope(client, targetPatientId, actor);

    if (input.isPrimary) {
      await client.query(
        `UPDATE patient_insurance_policies
         SET is_primary = FALSE, updated_at = NOW()
         WHERE user_id = $1 AND is_primary = TRUE`,
        [patient.id],
      );
    }

    const res = await client.query(
      `INSERT INTO patient_insurance_policies (
         user_id, country_code, provider_name, policy_number, member_id,
         coverage_plan, coverage_percent, valid_until, is_primary,
         verification_status, card_media_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, 'PENDING', $10)
       RETURNING ${INSURANCE_SELECT_COLUMNS}`,
      [
        patient.id,
        patient.countryCode,
        input.providerName.trim(),
        input.policyNumber.trim(),
        input.memberId.trim(),
        input.coveragePlan.trim(),
        input.coveragePercent,
        input.validUntil ?? null,
        input.isPrimary,
        input.cardMediaId ?? null,
      ],
    );

    const policy = PatientInsurancePolicySchema.parse(res.rows[0]);
    await appendAuditLog(client, {
      countryCode: patient.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PATIENT_INSURANCE_ADDED",
      resourceType: "patient_insurance_policy",
      resourceId: policy.id,
      metadata: {
        providerName: policy.providerName,
        coveragePercent: policy.coveragePercent,
        isPrimary: policy.isPrimary,
      },
    });

    await client.query("COMMIT");
    return policy;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(err)) {
      throw new MedicalPlatformConflictError("INSURANCE_POLICY_ALREADY_EXISTS");
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyPatientInsuranceAdmin(
  pool: Pool,
  targetPatientId: string,
  policyId: string,
  actor: AuthTokenClaims,
  verificationStatus: "PENDING" | "VERIFIED" | "EXPIRED" | "REJECTED",
): Promise<PatientInsurancePolicy> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const patient = await resolvePatientTargetScope(client, targetPatientId, actor);

    const res = await client.query(
      `UPDATE patient_insurance_policies
       SET verification_status = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${INSURANCE_SELECT_COLUMNS}`,
      [policyId, patient.id, verificationStatus],
    );
    if (res.rowCount === 0) {
      throw new MedicalPlatformNotFoundError("INSURANCE_POLICY_NOT_FOUND");
    }

    const policy = PatientInsurancePolicySchema.parse(res.rows[0]);
    await appendAuditLog(client, {
      countryCode: patient.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "PATIENT_INSURANCE_VERIFIED",
      resourceType: "patient_insurance_policy",
      resourceId: policy.id,
      metadata: { verificationStatus },
    });

    await client.query("COMMIT");
    return policy;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

const SERVICE_SELECT_COLUMNS = `
  s.id,
  s.country_code AS "countryCode",
  s.facility_id AS "facilityId",
  f.name AS "facilityName",
  s.category,
  s.service_code AS "serviceCode",
  s.name,
  s.description,
  s.specialty,
  s.price_minor AS "priceMinor",
  s.currency_code AS "currencyCode",
  s.duration_minutes AS "durationMinutes",
  s.home_service_available AS "homeServiceAvailable",
  s.telehealth_available AS "telehealthAvailable",
  s.requires_referral AS "requiresReferral",
  s.is_active AS "isActive",
  to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
`;

export async function listMedicalServicesPublic(
  pool: Pool,
  query: ListMedicalServicesQuery,
): Promise<MedicalServiceSummary[]> {
  const qPattern = query.q ? `%${query.q}%` : null;

  const res = await pool.query(
    `SELECT ${SERVICE_SELECT_COLUMNS}
     FROM medical_services s
     JOIN facilities f ON f.id = s.facility_id
     WHERE s.is_active = TRUE
       AND f.verification_status = 'VERIFIED'
       AND ($1::text IS NULL OR s.country_code = $1)
       AND ($2::uuid IS NULL OR s.facility_id = $2)
       AND ($3::text IS NULL OR s.category = $3)
       AND (
         $4::text IS NULL
         OR s.name ILIKE $4
         OR COALESCE(s.specialty, '') ILIKE $4
         OR s.service_code ILIKE $4
         OR f.name ILIKE $4
       )
       AND ($5::boolean IS NOT TRUE OR s.home_service_available = TRUE)
       AND ($6::boolean IS NOT TRUE OR s.telehealth_available = TRUE)
     ORDER BY s.country_code DESC, s.category ASC, s.price_minor ASC
     LIMIT $7`,
    [
      query.countryCode ?? null,
      query.facilityId ?? null,
      query.category ?? null,
      qPattern,
      query.homeServiceOnly ?? false,
      query.telehealthOnly ?? false,
      query.limit,
    ],
  );

  return res.rows.map((row) => MedicalServiceSummarySchema.parse(row));
}

export async function createMedicalServiceScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateMedicalServiceInput,
): Promise<MedicalServiceSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const facRes = await client.query<{
      id: string;
      name: string;
      countryCode: string;
    }>(
      `SELECT id, name, country_code AS "countryCode"
       FROM facilities
       WHERE id = $1
       LIMIT 1`,
      [input.facilityId],
    );
    const facility = facRes.rows[0];
    if (!facility) {
      throw new MedicalPlatformNotFoundError("FACILITY_NOT_FOUND");
    }

    if (actor.role !== "OPS_ADMIN" && facility.countryCode !== actor.countryCode) {
      throw new MedicalPlatformForbiddenError(
        "Cannot publish medical services for facilities outside your assigned country.",
      );
    }

    const currencyCode = resolveCountryPack(facility.countryCode).currencyCode;
    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO medical_services (
         country_code, facility_id, category, service_code, name, description,
         specialty, price_minor, currency_code, duration_minutes,
         home_service_available, telehealth_available, requires_referral,
         is_active, created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14)
       RETURNING id`,
      [
        facility.countryCode,
        facility.id,
        input.category,
        input.serviceCode.trim().toUpperCase(),
        input.name.trim(),
        input.description?.trim() ?? null,
        input.specialty?.trim() ?? null,
        input.priceMinor,
        currencyCode,
        input.durationMinutes,
        input.homeServiceAvailable,
        input.telehealthAvailable,
        input.requiresReferral,
        actor.sub,
      ],
    );

    const loaded = await client.query(
      `SELECT ${SERVICE_SELECT_COLUMNS}
       FROM medical_services s
       JOIN facilities f ON f.id = s.facility_id
       WHERE s.id = $1
       LIMIT 1`,
      [insertRes.rows[0]!.id],
    );
    const created = MedicalServiceSummarySchema.parse(loaded.rows[0]);

    await appendAuditLog(client, {
      countryCode: created.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "MEDICAL_SERVICE_CREATED",
      resourceType: "medical_service",
      resourceId: created.id,
      metadata: {
        facilityId: created.facilityId,
        category: created.category,
        serviceCode: created.serviceCode,
      },
    });

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(err)) {
      throw new MedicalPlatformConflictError("DUPLICATE_SERVICE_CODE");
    }
    throw err;
  } finally {
    client.release();
  }
}

const INVOICE_SELECT_COLUMNS = `
  i.id,
  i.country_code AS "countryCode",
  i.invoice_number AS "invoiceNumber",
  i.patient_user_id AS "patientUserId",
  u.full_name AS "patientName",
  i.facility_id AS "facilityId",
  f.name AS "facilityName",
  i.source_type AS "sourceType",
  i.source_id AS "sourceId",
  i.description,
  i.currency_code AS "currencyCode",
  i.subtotal_minor AS "subtotalMinor",
  i.insurance_covered_minor AS "insuranceCoveredMinor",
  i.patient_payable_minor AS "patientPayableMinor",
  i.status,
  i.payment_method AS "paymentMethod",
  i.payment_reference AS "paymentReference",
  i.insurance_policy_id AS "insurancePolicyId",
  CASE WHEN i.paid_at IS NULL THEN NULL ELSE to_char(i.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "paidAtIso",
  to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
  to_char(i.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

export async function createMedicalInvoiceAtomic(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateMedicalInvoiceInput,
): Promise<{ invoice: MedicalInvoiceSummary; deduplicated: boolean }> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.idempotencyKey) {
      const existing = await client.query(
        `SELECT ${INVOICE_SELECT_COLUMNS}
         FROM medical_invoices i
         JOIN users u ON u.id = i.patient_user_id
         JOIN facilities f ON f.id = i.facility_id
         WHERE i.patient_user_id = $1 AND i.idempotency_key = $2
         LIMIT 1`,
        [input.patientUserId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const parsed = MedicalInvoiceSummarySchema.parse(existing.rows[0]);
        if (actor.role !== "OPS_ADMIN" && parsed.countryCode !== actor.countryCode) {
          throw new MedicalPlatformForbiddenError("CROSS_COUNTRY_FORBIDDEN");
        }
        await client.query("COMMIT");
        return { invoice: parsed, deduplicated: true };
      }
    }

    const facRes = await client.query<{
      id: string;
      countryCode: string;
    }>(
      `SELECT id, country_code AS "countryCode" FROM facilities WHERE id = $1 LIMIT 1`,
      [input.facilityId],
    );
    const facility = facRes.rows[0];
    if (!facility) {
      throw new MedicalPlatformNotFoundError("FACILITY_NOT_FOUND");
    }

    if (actor.role !== "OPS_ADMIN" && facility.countryCode !== actor.countryCode) {
      throw new MedicalPlatformForbiddenError(
        "Cannot issue invoices for facilities outside your assigned country.",
      );
    }

    const patientRes = await client.query<{ id: string; countryCode: string }>(
      `SELECT id, country_code AS "countryCode" FROM users WHERE id = $1 LIMIT 1`,
      [input.patientUserId],
    );
    const patient = patientRes.rows[0];
    if (!patient) {
      throw new MedicalPlatformNotFoundError("PATIENT_NOT_FOUND");
    }
    if (patient.countryCode !== facility.countryCode) {
      throw new MedicalPlatformForbiddenError(
        "Patient and billing facility must belong to the same country jurisdiction.",
      );
    }

    let appliedPolicyId: string | null = null;
    let coveragePercent = 0;

    if (input.insurancePolicyId) {
      const polRes = await client.query<{
        id: string;
        coveragePercent: number;
        verificationStatus: string;
      }>(
        `SELECT id, coverage_percent AS "coveragePercent", verification_status AS "verificationStatus"
         FROM patient_insurance_policies
         WHERE id = $1 AND user_id = $2
         LIMIT 1
         FOR SHARE`,
        [input.insurancePolicyId, patient.id],
      );
      const pol = polRes.rows[0];
      if (!pol) {
        throw new MedicalPlatformNotFoundError("INSURANCE_POLICY_NOT_FOUND");
      }
      if (pol.verificationStatus === "REJECTED" || pol.verificationStatus === "EXPIRED") {
        throw new MedicalPlatformBadRequestError("INSURANCE_POLICY_NOT_ELIGIBLE");
      }
      appliedPolicyId = pol.id;
      coveragePercent = pol.coveragePercent;
    } else {
      const primaryPolRes = await client.query<{
        id: string;
        coveragePercent: number;
      }>(
        `SELECT id, coverage_percent AS "coveragePercent"
         FROM patient_insurance_policies
         WHERE user_id = $1 AND is_primary = TRUE AND verification_status = 'VERIFIED'
         LIMIT 1`,
        [patient.id],
      );
      if (primaryPolRes.rows[0]) {
        appliedPolicyId = primaryPolRes.rows[0].id;
        coveragePercent = primaryPolRes.rows[0].coveragePercent;
      }
    }

    const insuranceCoveredMinor = Math.min(
      input.subtotalMinor,
      Math.round((input.subtotalMinor * coveragePercent) / 100),
    );
    const patientPayableMinor = input.subtotalMinor - insuranceCoveredMinor;
    const status =
      patientPayableMinor === 0
        ? "PAID"
        : insuranceCoveredMinor > 0
          ? "PARTIALLY_COVERED"
          : "ISSUED";

    const currencyCode = resolveCountryPack(facility.countryCode).currencyCode;
    const invoiceNumber = `INV-${facility.countryCode}-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const paidAtIso = status === "PAID" ? new Date().toISOString() : null;

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO medical_invoices (
         country_code, invoice_number, patient_user_id, facility_id,
         source_type, source_id, description, currency_code,
         subtotal_minor, insurance_covered_minor, patient_payable_minor,
         status, insurance_policy_id, idempotency_key, paid_at, issued_by_user_id
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15::timestamptz, $16
       )
       RETURNING id`,
      [
        facility.countryCode,
        invoiceNumber,
        patient.id,
        facility.id,
        input.sourceType,
        input.sourceId ?? null,
        input.description.trim(),
        currencyCode,
        input.subtotalMinor,
        insuranceCoveredMinor,
        patientPayableMinor,
        status,
        appliedPolicyId,
        input.idempotencyKey ?? null,
        paidAtIso,
        actor.sub,
      ],
    );

    const loaded = await client.query(
      `SELECT ${INVOICE_SELECT_COLUMNS}
       FROM medical_invoices i
       JOIN users u ON u.id = i.patient_user_id
       JOIN facilities f ON f.id = i.facility_id
       WHERE i.id = $1
       LIMIT 1`,
      [insertRes.rows[0]!.id],
    );
    const invoice = MedicalInvoiceSummarySchema.parse(loaded.rows[0]);

    await appendAuditLog(client, {
      countryCode: invoice.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "MEDICAL_INVOICE_ISSUED",
      resourceType: "medical_invoice",
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        subtotalMinor: invoice.subtotalMinor,
        insuranceCoveredMinor: invoice.insuranceCoveredMinor,
        patientPayableMinor: invoice.patientPayableMinor,
        status: invoice.status,
      },
    });

    await client.query("COMMIT");
    return { invoice, deduplicated: false };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(err) && input.idempotencyKey) {
      const existing = await pool.query(
        `SELECT ${INVOICE_SELECT_COLUMNS}
         FROM medical_invoices i
         JOIN users u ON u.id = i.patient_user_id
         JOIN facilities f ON f.id = i.facility_id
         WHERE i.patient_user_id = $1 AND i.idempotency_key = $2
         LIMIT 1`,
        [input.patientUserId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const parsed = MedicalInvoiceSummarySchema.parse(existing.rows[0]);
        if (actor.role !== "OPS_ADMIN" && parsed.countryCode !== actor.countryCode) {
          throw new MedicalPlatformForbiddenError("CROSS_COUNTRY_FORBIDDEN");
        }
        return { invoice: parsed, deduplicated: true };
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function listMedicalInvoicesScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: ListMedicalInvoicesQuery,
): Promise<MedicalInvoiceSummary[]> {
  const isSelfOnly = actor.role === "PATIENT" || actor.role === "CAREGIVER";
  const effectivePatientId = isSelfOnly ? actor.sub : (query.patientUserId ?? null);
  const effectiveCountry =
    actor.role === "OPS_ADMIN" ? (query.countryCode ?? null) : actor.countryCode;

  if (
    !isSelfOnly &&
    actor.role !== "OPS_ADMIN" &&
    query.countryCode &&
    query.countryCode !== actor.countryCode
  ) {
    throw new MedicalPlatformForbiddenError("CROSS_COUNTRY_FORBIDDEN");
  }

  const res = await pool.query(
    `SELECT ${INVOICE_SELECT_COLUMNS}
     FROM medical_invoices i
     JOIN users u ON u.id = i.patient_user_id
     JOIN facilities f ON f.id = i.facility_id
     WHERE ($1::text IS NULL OR i.country_code = $1)
       AND ($2::uuid IS NULL OR i.patient_user_id = $2)
       AND ($3::text IS NULL OR i.status = $3)
     ORDER BY i.created_at DESC
     LIMIT $4`,
    [effectiveCountry, effectivePatientId, query.status ?? null, query.limit],
  );

  return res.rows.map((row) => MedicalInvoiceSummarySchema.parse(row));
}

export async function payMedicalInvoiceAtomic(
  pool: Pool,
  invoiceId: string,
  actor: AuthTokenClaims,
  input: PayMedicalInvoiceInput,
): Promise<MedicalInvoiceSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const curRes = await client.query<{
      id: string;
      countryCode: string;
      patientUserId: string;
      status: string;
      invoiceNumber: string;
      patientPayableMinor: number;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         patient_user_id AS "patientUserId",
         status,
         invoice_number AS "invoiceNumber",
         patient_payable_minor AS "patientPayableMinor"
       FROM medical_invoices
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [invoiceId],
    );
    const current = curRes.rows[0];
    if (!current) {
      throw new MedicalPlatformNotFoundError("INVOICE_NOT_FOUND");
    }

    if (
      (actor.role === "PATIENT" || actor.role === "CAREGIVER") &&
      current.patientUserId !== actor.sub
    ) {
      throw new MedicalPlatformForbiddenError(
        "Patients can only settle their own medical invoices.",
      );
    }

    if (
      actor.role !== "OPS_ADMIN" &&
      actor.role !== "PATIENT" &&
      actor.role !== "CAREGIVER" &&
      current.countryCode !== actor.countryCode
    ) {
      throw new MedicalPlatformForbiddenError("CROSS_COUNTRY_FORBIDDEN");
    }

    if (current.status === "VOID" || current.status === "REFUNDED") {
      throw new MedicalPlatformConflictError("INVOICE_NOT_PAYABLE");
    }

    if (current.status !== "PAID") {
      const ref =
        input.paymentReference?.trim() ??
        `PAY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      await client.query(
        `UPDATE medical_invoices
         SET status = 'PAID',
             payment_method = $2,
             payment_reference = $3,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [current.id, input.paymentMethod, ref],
      );

      await appendAuditLog(client, {
        countryCode: current.countryCode,
        actorId: actor.sub,
        actorRole: actor.role,
        action: "MEDICAL_INVOICE_PAID",
        resourceType: "medical_invoice",
        resourceId: current.id,
        metadata: {
          invoiceNumber: current.invoiceNumber,
          paymentMethod: input.paymentMethod,
          amountMinor: current.patientPayableMinor,
        },
      });
    }

    const loaded = await client.query(
      `SELECT ${INVOICE_SELECT_COLUMNS}
       FROM medical_invoices i
       JOIN users u ON u.id = i.patient_user_id
       JOIN facilities f ON f.id = i.facility_id
       WHERE i.id = $1
       LIMIT 1`,
      [current.id],
    );

    await client.query("COMMIT");
    return MedicalInvoiceSummarySchema.parse(loaded.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
