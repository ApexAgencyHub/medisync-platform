-- 0009: Support passwordless phone OTP & Google Sign-In for Patients alongside nullable email.
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS google_sub TEXT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_auth_provider,
  ADD CONSTRAINT chk_users_auth_provider
    CHECK (auth_provider IN ('LOCAL', 'PHONE', 'GOOGLE'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_primary_identifier,
  ADD CONSTRAINT chk_users_primary_identifier
    CHECK (email IS NOT NULL OR phone IS NOT NULL OR google_sub IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_not_null
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub_not_null
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;
