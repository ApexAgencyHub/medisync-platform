ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_24_7 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepts_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS open_status VARCHAR(16) NOT NULL DEFAULT 'OPEN'
    CHECK (open_status IN ('OPEN', 'BUSY', 'CLOSED'));

CREATE INDEX IF NOT EXISTS idx_facilities_verified_country_kind
  ON facilities (country_code, verification_status, kind, open_status);

CREATE TABLE IF NOT EXISTS dispatch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  target_facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address VARCHAR(280) NOT NULL,
  urgency VARCHAR(16) NOT NULL CHECK (urgency IN ('ROUTINE', 'URGENT', 'EMERGENCY')),
  status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED')),
  notes VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_country_status
  ON dispatch_requests (country_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_patient
  ON dispatch_requests (patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_driver
  ON dispatch_requests (driver_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_target_facility
  ON dispatch_requests (target_facility_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_pickup_gist
  ON dispatch_requests USING GIST (pickup_location);
