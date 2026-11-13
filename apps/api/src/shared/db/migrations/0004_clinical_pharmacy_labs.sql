CREATE TABLE IF NOT EXISTS visit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
  facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  icd10_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  subjective VARCHAR(2000) NOT NULL,
  objective VARCHAR(2000) NOT NULL,
  assessment VARCHAR(2000) NOT NULL,
  plan VARCHAR(2000) NOT NULL,
  vitals JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_notes_patient_created
  ON visit_notes (patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_notes_country_created
  ON visit_notes (country_code, created_at DESC);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
  facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  medications JSONB NOT NULL,
  notes VARCHAR(500) NULL,
  qr_nonce VARCHAR(64) NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  qr_signature VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'DISPENSED', 'CANCELLED')),
  dispensed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  pharmacy_facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  dispensed_at TIMESTAMPTZ NULL,
  dispensing_note VARCHAR(400) NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_country_status
  ON prescriptions (country_code, status, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_issued
  ON prescriptions (patient_user_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ordered_by_doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
  panel_name VARCHAR(180) NOT NULL,
  urgency VARCHAR(16) NOT NULL CHECK (urgency IN ('ROUTINE', 'URGENT', 'EMERGENCY')),
  clinical_notes VARCHAR(500) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ORDERED'
    CHECK (status IN ('ORDERED', 'SAMPLE_COLLECTED', 'COMPLETED', 'CANCELLED')),
  result_summary VARCHAR(1000) NULL,
  report_object_key VARCHAR(320) NULL,
  updated_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_orders_country_status
  ON lab_orders (country_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_created
  ON lab_orders (patient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clinical_media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lab_order_id UUID NULL REFERENCES lab_orders(id) ON DELETE SET NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  object_key VARCHAR(320) NOT NULL UNIQUE,
  file_name VARCHAR(160) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_media_patient
  ON clinical_media_objects (patient_user_id, created_at DESC);
