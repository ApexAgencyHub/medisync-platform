import crypto from "node:crypto";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import type { FacilityKind, UserRole } from "@medisync/contracts";
import { hashPassword } from "../foundation/index.js";
import { signPrescriptionQr } from "../clinical-pharmacy-labs/index.js";
import { upsertDriverLocation } from "../maps-dispatch/index.js";
import { seedDefaultPharmacyProducts } from "../pharmacy-commerce/index.js";
import { SEEDED_DEMO_PASSWORD } from "./pg-store.js";

interface SeedFacilitySpec {
  countryCode: string;
  kind: FacilityKind;
  name: string;
  licenseNumber: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  is247: boolean;
  acceptsEmergency: boolean;
  specialties: string[];
}

interface SeedUserSpec {
  email: string;
  fullName: string;
  role: UserRole;
  countryCode: string;
  facilityLicense?: string;
  doctorProfile?: {
    specialty: string;
    licenseNumber: string;
    consultationFeeMinor: number;
    bio: string;
  };
}

const SEED_FACILITIES: readonly SeedFacilitySpec[] = [
  // Morocco (MA - Casablanca Metro)
  {
    countryCode: "MA",
    kind: "HOSPITAL",
    name: "CHU Ibn Rochd Emergency Hub",
    licenseNumber: "MA-HOSP-901001",
    lat: 33.5835,
    lng: -7.6212,
    address: "1 Rue des Hôpitaux, Casablanca",
    phone: "+212-522-48-20-20",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Cardiology", "Neurology"],
  },
  {
    countryCode: "MA",
    kind: "CLINIC",
    name: "Clinique Anfa Cardiology & Care",
    licenseNumber: "MA-CLIN-901002",
    lat: 33.5912,
    lng: -7.6410,
    address: "240 Boulevard d'Anfa, Casablanca",
    phone: "+212-522-39-14-14",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Cardiology", "Internal Medicine", "Pediatrics"],
  },
  {
    countryCode: "MA",
    kind: "PHARMACY",
    name: "Pharmacie Maarif 24/7",
    licenseNumber: "MA-PHRM-901003",
    lat: 33.5818,
    lng: -7.6348,
    address: "45 Boulevard Bir Anzarane, Maarif, Casablanca",
    phone: "+212-522-98-11-22",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo BioCasablanca Imagerie",
    licenseNumber: "MA-LAB-901004",
    lat: 33.5750,
    lng: -7.6120,
    address: "18 Boulevard Abdelmoumen, Casablanca",
    phone: "+212-522-27-55-40",
    is247: false,
    acceptsEmergency: true,
    specialties: ["Hematology", "MRI & CT", "Microbiology"],
  },

  // International (INTL - Geneva Medical District)
  {
    countryCode: "INTL",
    kind: "HOSPITAL",
    name: "Geneva University Emergency Center",
    licenseNumber: "INTL-HOSP-101001",
    lat: 46.1932,
    lng: 6.1489,
    address: "Rue Gabrielle-Perret-Gentil 4, Geneva",
    phone: "+41-22-372-3311",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "ICU", "Surgery"],
  },
  {
    countryCode: "INTL",
    kind: "CLINIC",
    name: "Geneva Sovereign Polyclinic",
    licenseNumber: "INTL-CLIN-101002",
    lat: 46.1905,
    lng: 6.1560,
    address: "Avenue de Champel 20, Geneva",
    phone: "+41-22-839-5500",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Internal Medicine", "Telehealth", "Preventive Care"],
  },
  {
    countryCode: "INTL",
    kind: "PHARMACY",
    name: "Pharmacie du Léman 24/7",
    licenseNumber: "INTL-PHRM-101003",
    lat: 46.2082,
    lng: 6.1445,
    address: "Rue du Mont-Blanc 12, Geneva",
    phone: "+41-22-732-1190",
    is247: true,
    acceptsEmergency: false,
    specialties: ["24/7 Pharmacy", "Compounding", "Home Courier"],
  },
  {
    countryCode: "INTL",
    kind: "DIAGNOSTIC_LAB",
    name: "BioGen Diagnostics Lab",
    licenseNumber: "INTL-LABS-101004",
    lat: 46.2015,
    lng: 6.1350,
    address: "Boulevard Helvétique 32, Geneva",
    phone: "+41-22-818-4400",
    is247: false,
    acceptsEmergency: false,
    specialties: ["PCR", "Imaging", "Clinical Pathology"],
  },

  // France (FR - Paris AP-HP Core)
  {
    countryCode: "FR",
    kind: "HOSPITAL",
    name: "Hôpital Cochin AP-HP",
    licenseNumber: "FR-750100001",
    lat: 48.8377,
    lng: 2.3401,
    address: "27 Rue du Faubourg Saint-Jacques, Paris",
    phone: "+33-1-58-41-41-41",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Urgences", "Cardiologie", "Radiologie"],
  },
  {
    countryCode: "FR",
    kind: "CLINIC",
    name: "Centre Médical Saint-Germain",
    licenseNumber: "FR-750100002",
    lat: 48.8540,
    lng: 2.3328,
    address: "112 Boulevard Saint-Germain, Paris",
    phone: "+33-1-42-22-88-10",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Médecine Générale", "Dermatologie"],
  },
  {
    countryCode: "FR",
    kind: "PHARMACY",
    name: "Pharmacie Monge Garde 24/7",
    licenseNumber: "FR-750100003",
    lat: 48.8422,
    lng: 2.3522,
    address: "78 Rue Monge, Paris",
    phone: "+33-1-43-31-39-44",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Garde Nuit", "Ordonnances QR"],
  },
  {
    countryCode: "FR",
    kind: "DIAGNOSTIC_LAB",
    name: "Laboratoire BioParis",
    licenseNumber: "FR-750100004",
    lat: 48.8620,
    lng: 2.3590,
    address: "15 Rue de Turbigo, Paris",
    phone: "+33-1-40-26-71-00",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Biologie Médicale", "Sérologie"],
  },

  // United States (US - Manhattan Clinical Corridor)
  {
    countryCode: "US",
    kind: "HOSPITAL",
    name: "Manhattan Heart & Trauma Center",
    licenseNumber: "US-NY-880101",
    lat: 40.7644,
    lng: -73.9547,
    address: "525 East 68th Street, New York, NY",
    phone: "+1-212-746-5454",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency Trauma", "Cardiology", "Oncology"],
  },
  {
    countryCode: "US",
    kind: "CLINIC",
    name: "SoHo Family Medical Clinic",
    licenseNumber: "US-NY-880102",
    lat: 40.7233,
    lng: -74.0005,
    address: "420 Broome Street, New York, NY",
    phone: "+1-212-555-0182",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Family Medicine", "Pediatrics", "Telehealth"],
  },
  {
    countryCode: "US",
    kind: "PHARMACY",
    name: "Hudson 24h Pharmacy",
    licenseNumber: "US-NY-880103",
    lat: 40.7350,
    lng: -74.0020,
    address: "305 Hudson Street, New York, NY",
    phone: "+1-212-555-0144",
    is247: true,
    acceptsEmergency: false,
    specialties: ["24h Fulfillment", "Specialty Rx"],
  },
  {
    countryCode: "US",
    kind: "DIAGNOSTIC_LAB",
    name: "Empire Diagnostic Labs",
    licenseNumber: "US-NY-880104",
    lat: 40.7527,
    lng: -73.9772,
    address: "89 East 42nd Street, New York, NY",
    phone: "+1-212-555-0199",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Imaging", "Comprehensive Panels"],
  },
];

const SEED_USERS: readonly SeedUserSpec[] = [
  {
    email: "ops.admin@medisync.global",
    fullName: "Sovereign Ops Controller",
    role: "OPS_ADMIN",
    countryCode: "INTL",
  },
  // MA Personas
  {
    email: "patient.ma@medisync.global",
    fullName: "Youssef El Amrani",
    role: "PATIENT",
    countryCode: "MA",
  },
  {
    email: "doctor.ma@medisync.global",
    fullName: "Dr. Salma Benali",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-901002",
    doctorProfile: {
      specialty: "Cardiology",
      licenseNumber: "MA-MD-77412",
      consultationFeeMinor: 35000,
      bio: "Interventional cardiologist in Casablanca providing clinic and telehealth consultations.",
    },
  },
  {
    email: "hospital.ma@medisync.global",
    fullName: "Amina Alami",
    role: "HOSPITAL_ADMIN",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-901001",
  },
  {
    email: "pharmacist.ma@medisync.global",
    fullName: "Dr. Nadia Tazi",
    role: "PHARMACIST",
    countryCode: "MA",
    facilityLicense: "MA-PHRM-901003",
  },
  {
    email: "lab.ma@medisync.global",
    fullName: "Karim Bennani",
    role: "LAB_TECH",
    countryCode: "MA",
    facilityLicense: "MA-LAB-901004",
  },
  {
    email: "driver.ma@medisync.global",
    fullName: "Hassan Chraibi",
    role: "DRIVER",
    countryCode: "MA",
  },
  // INTL Personas
  {
    email: "patient.intl@medisync.global",
    fullName: "Claire Moreau",
    role: "PATIENT",
    countryCode: "INTL",
  },
  {
    email: "doctor.intl@medisync.global",
    fullName: "Dr. Lukas Weber",
    role: "DOCTOR",
    countryCode: "INTL",
    facilityLicense: "INTL-CLIN-101002",
    doctorProfile: {
      specialty: "Internal Medicine",
      licenseNumber: "CH-MD-30112",
      consultationFeeMinor: 18000,
      bio: "Senior internist coordinating Swiss & cross-border acute follow-ups.",
    },
  },
  {
    email: "pharmacist.intl@medisync.global",
    fullName: "Sophie Laurent",
    role: "PHARMACIST",
    countryCode: "INTL",
    facilityLicense: "INTL-PHRM-101003",
  },
  {
    email: "lab.intl@medisync.global",
    fullName: "Marc Dubois",
    role: "LAB_TECH",
    countryCode: "INTL",
    facilityLicense: "INTL-LABS-101004",
  },
  {
    email: "driver.intl@medisync.global",
    fullName: "Thomas Keller",
    role: "DRIVER",
    countryCode: "INTL",
  },
  // FR & US Doctors for CountryPack completeness
  {
    email: "doctor.fr@medisync.global",
    fullName: "Dr. Camille Lefèvre",
    role: "DOCTOR",
    countryCode: "FR",
    facilityLicense: "FR-750100002",
    doctorProfile: {
      specialty: "Médecine Générale",
      licenseNumber: "FR-1010928371",
      consultationFeeMinor: 3000,
      bio: "Médecin généraliste conventionné secteur 1 à Saint-Germain.",
    },
  },
  {
    email: "doctor.us@medisync.global",
    fullName: "Dr. Maya Patel",
    role: "DOCTOR",
    countryCode: "US",
    facilityLicense: "US-NY-880102",
    doctorProfile: {
      specialty: "Family Medicine",
      licenseNumber: "US-NY-449012",
      consultationFeeMinor: 15000,
      bio: "Board-certified family physician offering same-day SoHo & telehealth visits.",
    },
  },
];

export interface SeedWorldResult {
  facilitiesSeeded: number;
  usersSeeded: number;
  schedulesSeeded: number;
  driversPinged: number;
  prescriptionsSeeded: number;
}

export async function seedRealisticWorld(
  pool: Pool,
  redis: Redis,
  authSecret: string,
): Promise<SeedWorldResult> {
  const passwordHash = await hashPassword(SEEDED_DEMO_PASSWORD);
  const userIdsByEmail = new Map<string, string>();
  const facilityIdsByLicense = new Map<string, string>();

  // 1. Seed bootstrap owner / Ops Admin first
  const opsSpec = SEED_USERS[0]!;
  const opsRes = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, country_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [
      opsSpec.email,
      passwordHash,
      opsSpec.fullName,
      opsSpec.role,
      opsSpec.countryCode,
    ],
  );
  const opsId = opsRes.rows[0]!.id;
  userIdsByEmail.set(opsSpec.email, opsId);

  // 2. Seed all 16 VERIFIED facilities across MA, INTL, FR, US
  for (const fac of SEED_FACILITIES) {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         country_code,
         kind,
         name,
         license_number,
         verification_status,
         location,
         lat,
         lng,
         address,
         owner_user_id,
         phone,
         is_24_7,
         accepts_emergency,
         specialties,
         open_status
       )
       VALUES (
         $1, $2, $3, $4, 'VERIFIED',
         ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
         $5, $6, $7, $8, $9, $10, $11, $12::text[], 'OPEN'
       )
       ON CONFLICT (country_code, license_number) DO UPDATE SET
         verification_status = 'VERIFIED',
         open_status = 'OPEN',
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         specialties = EXCLUDED.specialties
       RETURNING id`,
      [
        fac.countryCode,
        fac.kind,
        fac.name,
        fac.licenseNumber,
        fac.lat,
        fac.lng,
        fac.address,
        opsId,
        fac.phone,
        fac.is247,
        fac.acceptsEmergency,
        fac.specialties,
      ],
    );
    facilityIdsByLicense.set(fac.licenseNumber, res.rows[0]!.id);
  }

  // 3. Seed Users & Doctor Profiles
  let schedulesSeeded = 0;
  for (const spec of SEED_USERS.slice(1)) {
    const facilityId = spec.facilityLicense
      ? (facilityIdsByLicense.get(spec.facilityLicense) ?? null)
      : null;

    const uRes = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code, facility_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         facility_id = COALESCE(users.facility_id, EXCLUDED.facility_id)
       RETURNING id`,
      [
        spec.email,
        passwordHash,
        spec.fullName,
        spec.role,
        spec.countryCode,
        facilityId,
      ],
    );
    const userId = uRes.rows[0]!.id;
    userIdsByEmail.set(spec.email, userId);

    if (spec.doctorProfile) {
      await pool.query(
        `INSERT INTO doctor_profiles (
           doctor_user_id, country_code, specialty, license_number, consultation_fee_minor, bio
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (doctor_user_id) DO UPDATE SET
           specialty = EXCLUDED.specialty,
           consultation_fee_minor = EXCLUDED.consultation_fee_minor`,
        [
          userId,
          spec.countryCode,
          spec.doctorProfile.specialty,
          spec.doctorProfile.licenseNumber,
          spec.doctorProfile.consultationFeeMinor,
          spec.doctorProfile.bio,
        ],
      );

      if (facilityId) {
        // Ensure a recurring Mon–Sat slot pattern exists so today/next Monday always renders bookable slots
        for (const dayOfWeek of [1, 2, 3, 4, 5]) {
          const existingSched = await pool.query<{ id: string }>(
            `SELECT id FROM doctor_schedules
             WHERE doctor_user_id = $1 AND facility_id = $2 AND day_of_week = $3 AND start_time_utc = '09:00'
             LIMIT 1`,
            [userId, facilityId, dayOfWeek],
          );
          if (existingSched.rowCount === 0) {
            await pool.query(
              `INSERT INTO doctor_schedules (
                 country_code, doctor_user_id, facility_id, day_of_week,
                 start_time_utc, end_time_utc, slot_duration_minutes, visit_mode, is_active
               )
               VALUES ($1, $2, $3, $4, '09:00', '12:00', 30, $5, TRUE)`,
              [
                spec.countryCode,
                userId,
                facilityId,
                dayOfWeek,
                dayOfWeek % 2 === 0 ? "TELEHEALTH" : "IN_PERSON",
              ],
            );
            schedulesSeeded += 1;
          }
        }
      }
    }
  }

  // 4. Seed Live Redis Geo ambulance pings for MA & INTL
  let driversPinged = 0;
  const driverLocations = [
    {
      email: "driver.ma@medisync.global",
      countryCode: "MA",
      lat: 33.5865,
      lng: -7.6285,
      status: "AVAILABLE" as const,
      headingDeg: 115,
    },
    {
      email: "driver.intl@medisync.global",
      countryCode: "INTL",
      lat: 46.1975,
      lng: 6.1502,
      status: "AVAILABLE" as const,
      headingDeg: 45,
    },
  ];
  for (const drv of driverLocations) {
    const driverId = userIdsByEmail.get(drv.email);
    if (driverId) {
      await upsertDriverLocation(redis, {
        driverId,
        countryCode: drv.countryCode,
        lat: drv.lat,
        lng: drv.lng,
        status: drv.status,
        headingDeg: drv.headingDeg,
      });
      driversPinged += 1;
    }
  }

  // 5. Seed Sample Clinical Note, Signed QR Prescription & Lab Order for MA & INTL if none exist yet
  let prescriptionsSeeded = 0;
  const clinicalPairs = [
    {
      countryCode: "MA",
      patientEmail: "patient.ma@medisync.global",
      doctorEmail: "doctor.ma@medisync.global",
      clinicLicense: "MA-CLIN-901002",
      labLicense: "MA-LAB-901004",
      medication: "Amlodipine",
      dosage: "5 mg",
      panelName: "Lipid & Troponin Cardiac Panel",
    },
    {
      countryCode: "INTL",
      patientEmail: "patient.intl@medisync.global",
      doctorEmail: "doctor.intl@medisync.global",
      clinicLicense: "INTL-CLIN-101002",
      labLicense: "INTL-LABS-101004",
      medication: "Amoxicillin",
      dosage: "500 mg",
      panelName: "Complete Blood Count (CBC)",
    },
  ];

  for (const pair of clinicalPairs) {
    const patientId = userIdsByEmail.get(pair.patientEmail);
    const doctorId = userIdsByEmail.get(pair.doctorEmail);
    const clinicId = facilityIdsByLicense.get(pair.clinicLicense);
    const labId = facilityIdsByLicense.get(pair.labLicense);
    if (!patientId || !doctorId || !clinicId || !labId) continue;

    const nonce = crypto
      .createHash("sha256")
      .update(`${pair.countryCode}:${pair.patientEmail}:seed-v1`)
      .digest("hex")
      .slice(0, 24);
    const existingRx = await pool.query<{ id: string }>(
      `SELECT id FROM prescriptions WHERE qr_nonce = $1 LIMIT 1`,
      [nonce],
    );
    const rxId = existingRx.rows[0]?.id ?? crypto.randomUUID();
    const signed = signPrescriptionQr(
      {
        rxId,
        countryCode: pair.countryCode,
        patientUserId: patientId,
        doctorUserId: doctorId,
        nonce,
      },
      authSecret,
    );

    if (existingRx.rowCount === 0) {
      await pool.query(
        `INSERT INTO visit_notes (
           country_code, patient_user_id, doctor_user_id, facility_id,
           icd10_codes, subjective, objective, assessment, plan
         )
         VALUES ($1, $2, $3, $4, ARRAY['I10'], 'Mild exertional fatigue.', 'BP 132/82 mmHg, HR 72 bpm.', 'Controlled hypertension follow-up.', 'Continue therapy and complete routine blood panel.')`,
        [pair.countryCode, patientId, doctorId, clinicId],
      );

      await pool.query(
        `INSERT INTO prescriptions (
           id, country_code, patient_user_id, doctor_user_id, facility_id,
           medications, notes, qr_nonce, qr_token, qr_signature, status
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'Seeded initial e-prescription ready for QR pharmacy scan.', $7, $8, $9, 'ISSUED')`,
        [
          rxId,
          pair.countryCode,
          patientId,
          doctorId,
          clinicId,
          JSON.stringify([
            {
              name: pair.medication,
              dosage: pair.dosage,
              frequency: "Once daily",
              durationDays: 14,
            },
          ]),
          nonce,
          signed.qrToken,
          signed.qrSignature,
        ],
      );
      prescriptionsSeeded += 1;
    } else {
      await pool.query(
        `UPDATE prescriptions SET qr_token = $2, qr_signature = $3 WHERE id = $1`,
        [rxId, signed.qrToken, signed.qrSignature],
      );
    }

    const existingLab = await pool.query<{ id: string }>(
      `SELECT id FROM lab_orders WHERE patient_user_id = $1 AND facility_id = $2 LIMIT 1`,
      [patientId, labId],
    );
    if (existingLab.rowCount === 0) {
      await pool.query(
        `INSERT INTO lab_orders (
           country_code, patient_user_id, ordered_by_doctor_id, facility_id, panel_name, urgency, status
         )
         VALUES ($1, $2, $3, $4, $5, 'ROUTINE', 'ORDERED')`,
        [pair.countryCode, patientId, doctorId, labId, pair.panelName],
      );
    }
  }

  await seedDefaultPharmacyProducts(pool);

  return {
    facilitiesSeeded: SEED_FACILITIES.length,
    usersSeeded: SEED_USERS.length,
    schedulesSeeded,
    driversPinged,
    prescriptionsSeeded,
  };
}
