-- Phase 8: Enterprise Medical Platform DB Completeness, Security Governance & Scalability Indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Account lifecycle, credential gating & immediate JWT revocation support
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS credential_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED'));

-- Mark pre-existing seeded operator & medical personas verified so live environments keep operating smoothly
UPDATE users
SET credential_verified = TRUE
WHERE email LIKE '%@medisync.global'
  AND role IN ('DOCTOR', 'CLINIC_STAFF', 'HOSPITAL_ADMIN', 'DRIVER', 'PHARMACIST', 'LAB_TECH', 'OPS_ADMIN');

-- 2. Facility & practitioner discovery metadata (insurance networks, languages, telehealth, home visits)
ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS city VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS accepted_insurances TEXT[] NOT NULL DEFAULT ARRAY['AMO', 'CNOPS', 'CNSS']::text[],
  ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] NOT NULL DEFAULT ARRAY['ar', 'fr', 'en']::text[],
  ADD COLUMN IF NOT EXISTS telehealth_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS home_visit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] NOT NULL DEFAULT ARRAY['ar', 'fr', 'en']::text[],
  ADD COLUMN IF NOT EXISTS accepted_insurances TEXT[] NOT NULL DEFAULT ARRAY['AMO', 'CNOPS', 'CNSS']::text[],
  ADD COLUMN IF NOT EXISTS telehealth_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS home_visit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS years_experience INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS registration_council VARCHAR(120) NULL;

-- 3. OTP brute-force lockout protection
ALTER TABLE user_verification_codes
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;

-- 4. Expand S3/MinIO-backed document & clinical media metadata + SHA-256 tamper-evident integrity
ALTER TABLE facility_media_documents
  ADD COLUMN IF NOT EXISTS sha256_checksum VARCHAR(64) NULL;

ALTER TABLE facility_media_documents
  DROP CONSTRAINT IF EXISTS facility_media_documents_category_check;

ALTER TABLE facility_media_documents
  ADD CONSTRAINT facility_media_documents_category_check
  CHECK (category IN (
    'MINISTRY_LICENSE',
    'ACCREDITATION',
    'FACILITY_PHOTO',
    'HYGIENE_INSPECTION',
    'FIRE_SAFETY_CERT',
    'PHARMACY_PERMIT',
    'LAB_ISO_CERT'
  ));

ALTER TABLE user_media_documents
  ADD COLUMN IF NOT EXISTS sha256_checksum VARCHAR(64) NULL;

ALTER TABLE user_media_documents
  DROP CONSTRAINT IF EXISTS user_media_documents_category_check;

ALTER TABLE user_media_documents
  ADD CONSTRAINT user_media_documents_category_check
  CHECK (category IN (
    'AVATAR',
    'MEDICAL_DEGREE',
    'PRACTITIONER_LICENSE',
    'DRIVER_LICENSE',
    'VEHICLE_INSPECTION',
    'NATIONAL_ID',
    'INSURANCE_CERTIFICATE',
    'BOARD_CERTIFICATION',
    'MALPRACTICE_POLICY'
  ));

ALTER TABLE clinical_media_objects
  ADD COLUMN IF NOT EXISTS media_category VARCHAR(32) NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS sha256_checksum VARCHAR(64) NULL;

ALTER TABLE clinical_media_objects
  DROP CONSTRAINT IF EXISTS clinical_media_objects_category_check;

ALTER TABLE clinical_media_objects
  ADD CONSTRAINT clinical_media_objects_category_check
  CHECK (media_category IN (
    'LAB_REPORT',
    'RADIOLOGY_SCAN',
    'PRESCRIPTION_SCAN',
    'INSURANCE_CARD',
    'DISCHARGE_SUMMARY',
    'REFERRAL_LETTER',
    'VOICE_NOTE',
    'FHIR_BUNDLE',
    'OTHER'
  ));

-- 5. All-in-one EHR Patient Medical Profiles
CREATE TABLE IF NOT EXISTS patient_medical_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(4) NOT NULL,
  date_of_birth DATE NULL,
  biological_sex VARCHAR(16) NOT NULL DEFAULT 'UNSPECIFIED' CHECK (biological_sex IN ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED')),
  blood_type VARCHAR(8) NOT NULL DEFAULT 'UNKNOWN' CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN')),
  national_health_id VARCHAR(64) NULL,
  emergency_contact_name VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(32) NULL,
  height_cm NUMERIC(5, 2) NULL,
  weight_kg NUMERIC(5, 2) NULL,
  allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions TEXT[] NOT NULL DEFAULT '{}'::text[],
  current_medications TEXT[] NOT NULL DEFAULT '{}'::text[],
  primary_doctor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  preferred_facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  data_sharing_consent BOOLEAN NOT NULL DEFAULT TRUE,
  telehealth_consent BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Patient Insurance & Coverage Policies (AMO, CNOPS, CNSS, Private Insurers)
CREATE TABLE IF NOT EXISTS patient_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(4) NOT NULL,
  provider_name VARCHAR(120) NOT NULL,
  policy_number VARCHAR(80) NOT NULL,
  member_id VARCHAR(80) NOT NULL,
  coverage_plan VARCHAR(80) NOT NULL DEFAULT 'STANDARD',
  coverage_percent INTEGER NOT NULL DEFAULT 70 CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
  valid_until DATE NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED')),
  card_media_id UUID NULL REFERENCES clinical_media_objects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider_name, policy_number)
);

-- 7. Medical Services & Diagnostics Marketplace Catalog
CREATE TABLE IF NOT EXISTS medical_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL CHECK (category IN (
    'CONSULTATION', 'LAB_TEST', 'IMAGING', 'HOME_CARE', 'SURGERY',
    'PHARMACY_SERVICE', 'AMBULANCE', 'VACCINATION', 'TELEHEALTH'
  )),
  service_code VARCHAR(48) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  specialty VARCHAR(120) NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'MAD',
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes >= 5 AND duration_minutes <= 480),
  home_service_available BOOLEAN NOT NULL DEFAULT FALSE,
  telehealth_available BOOLEAN NOT NULL DEFAULT FALSE,
  requires_referral BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (facility_id, service_code)
);

-- 8. Unified Healthcare Billing, Insurance Claims & Idempotent Invoices
CREATE TABLE IF NOT EXISTS medical_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  invoice_number VARCHAR(48) NOT NULL UNIQUE,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('APPOINTMENT', 'LAB_ORDER', 'DISPATCH', 'PHARMACY_ORDER', 'SERVICE')),
  source_id UUID NULL,
  description TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'MAD',
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor > 0),
  insurance_covered_minor INTEGER NOT NULL DEFAULT 0 CHECK (insurance_covered_minor >= 0),
  patient_payable_minor INTEGER NOT NULL CHECK (patient_payable_minor >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_COVERED', 'VOID', 'REFUNDED')),
  payment_method VARCHAR(32) NULL,
  payment_reference VARCHAR(120) NULL,
  insurance_policy_id UUID NULL REFERENCES patient_insurance_policies(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(128) NULL,
  paid_at TIMESTAMPTZ NULL,
  issued_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_medical_invoices_patient_idempotency
  ON medical_invoices (patient_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 9. High-Scale GIN Trigram Search & Composite Performance Indexes
CREATE INDEX IF NOT EXISTS idx_facilities_trgm_name ON facilities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_facilities_trgm_address ON facilities USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_facilities_country_verified_kind ON facilities (country_code, verification_status, kind);
CREATE INDEX IF NOT EXISTS idx_facilities_insurances_gin ON facilities USING GIN (accepted_insurances);

CREATE INDEX IF NOT EXISTS idx_users_trgm_fullname ON users USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_country_role_status ON users (country_code, role, account_status);
CREATE INDEX IF NOT EXISTS idx_users_facility_role ON users (facility_id, role) WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_facility_start ON appointments (facility_id, slot_start_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_created ON appointments (patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_country_status_updated ON dispatch_requests (country_code, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_trgm_name ON pharmacy_products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_country_status_created ON pharmacy_orders (country_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order_id ON pharmacy_order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_clinical_media_patient_created ON clinical_media_objects (patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_services_trgm_name ON medical_services USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medical_services_country_cat_active ON medical_services (country_code, category, is_active);
CREATE INDEX IF NOT EXISTS idx_medical_invoices_patient_created ON medical_invoices (patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_user_primary ON patient_insurance_policies (user_id, is_primary DESC);
