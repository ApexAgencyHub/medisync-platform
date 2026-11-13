CREATE TABLE IF NOT EXISTS doctor_profiles (
  doctor_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(4) NOT NULL,
  specialty VARCHAR(120) NOT NULL,
  license_number VARCHAR(64) NOT NULL,
  consultation_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (consultation_fee_minor >= 0),
  bio VARCHAR(500) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_country_specialty
  ON doctor_profiles (country_code, specialty);

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time_utc VARCHAR(5) NOT NULL,
  end_time_utc VARCHAR(5) NOT NULL,
  slot_duration_minutes SMALLINT NOT NULL CHECK (slot_duration_minutes BETWEEN 10 AND 120),
  visit_mode VARCHAR(16) NOT NULL CHECK (visit_mode IN ('IN_PERSON', 'TELEHEALTH')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_lookup
  ON doctor_schedules (country_code, is_active, day_of_week, facility_id, doctor_user_id);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  schedule_id UUID NOT NULL REFERENCES doctor_schedules(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visit_mode VARCHAR(16) NOT NULL CHECK (visit_mode IN ('IN_PERSON', 'TELEHEALTH')),
  slot_start_at TIMESTAMPTZ NOT NULL,
  slot_end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  reason VARCHAR(400) NULL,
  triage_note VARCHAR(300) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (slot_end_at > slot_start_at)
);

-- Prevents double-booking the same doctor at the exact slot start across ALL clinics simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_doctor_slot
  ON appointments (doctor_user_id, slot_start_at)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED');

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_range
  ON appointments (doctor_user_id, slot_start_at, slot_end_at)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED');

CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON appointments (patient_user_id, slot_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_facility_country
  ON appointments (country_code, facility_id, slot_start_at DESC);
