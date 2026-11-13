CREATE TABLE IF NOT EXISTS platform_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reporter_role VARCHAR(32) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (
    category IN (
      'BOOKING_NO_SHOW',
      'DISPATCH_DELAY',
      'PRESCRIPTION_ISSUE',
      'FACILITY_COMPLIANCE',
      'OTHER'
    )
  ),
  subject VARCHAR(160) NOT NULL,
  description VARCHAR(1500) NOT NULL,
  target_resource_id VARCHAR(128) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (
    status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')
  ),
  resolution_note VARCHAR(1000) NULL,
  resolved_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_country_status
  ON platform_disputes (country_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_reporter
  ON platform_disputes (reporter_user_id, created_at DESC);
