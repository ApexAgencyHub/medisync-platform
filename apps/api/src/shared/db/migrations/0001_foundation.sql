CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('CLINIC', 'HOSPITAL', 'PHARMACY', 'DIAGNOSTIC_LAB')),
  name VARCHAR(160) NOT NULL,
  license_number VARCHAR(64) NOT NULL,
  verification_status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (verification_status IN ('PENDING_REVIEW', 'VERIFIED', 'SUSPENDED')),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address VARCHAR(280) NOT NULL,
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_facilities_country_license UNIQUE (country_code, license_number)
);

CREATE INDEX IF NOT EXISTS idx_facilities_country_status
  ON facilities (country_code, verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facilities_owner
  ON facilities (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_facilities_location_gist
  ON facilities USING GIST (location);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (
    role IN (
      'PATIENT',
      'CAREGIVER',
      'DOCTOR',
      'CLINIC_STAFF',
      'HOSPITAL_ADMIN',
      'DRIVER',
      'PHARMACIST',
      'LAB_TECH',
      'OPS_ADMIN'
    )
  ),
  country_code VARCHAR(4) NOT NULL,
  facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_country_role
  ON users (country_code, role);

CREATE INDEX IF NOT EXISTS idx_users_facility
  ON users (facility_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  actor_id UUID NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_country_occurred
  ON audit_logs (country_code, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON audit_logs (actor_id, occurred_at DESC);
