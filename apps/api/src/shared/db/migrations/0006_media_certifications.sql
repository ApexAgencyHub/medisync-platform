ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_object_key VARCHAR(320) NULL;

ALTER TABLE clinical_media_objects
  ADD COLUMN IF NOT EXISTS upload_status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
    CHECK (upload_status IN ('PENDING', 'UPLOADED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS confirmed_size_bytes INTEGER NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS facility_media_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category VARCHAR(32) NOT NULL CHECK (
    category IN ('MINISTRY_LICENSE', 'ACCREDITATION', 'FACILITY_PHOTO')
  ),
  object_key VARCHAR(320) NOT NULL UNIQUE,
  file_name VARCHAR(160) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  confirmed_size_bytes INTEGER NULL,
  upload_status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
    CHECK (upload_status IN ('PENDING', 'UPLOADED', 'FAILED')),
  review_status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewer_note VARCHAR(500) NULL,
  reviewed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_media_facility_created
  ON facility_media_documents (facility_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_media_country_review
  ON facility_media_documents (country_code, review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_media_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL CHECK (
    category IN ('AVATAR', 'MEDICAL_DEGREE', 'PRACTITIONER_LICENSE', 'DRIVER_LICENSE')
  ),
  object_key VARCHAR(320) NOT NULL UNIQUE,
  file_name VARCHAR(160) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  confirmed_size_bytes INTEGER NULL,
  upload_status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
    CHECK (upload_status IN ('PENDING', 'UPLOADED', 'FAILED')),
  review_status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewer_note VARCHAR(500) NULL,
  reviewed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_media_user_created
  ON user_media_documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_media_country_review
  ON user_media_documents (country_code, review_status, created_at DESC);
