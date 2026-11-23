-- Phase 12: Legal Compliance Ledgers (CNDP/GDPR), Payment Webhook Idempotency & High-Throughput Indexes

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(32) NOT NULL CHECK (consent_type IN (
    'TERMS_PRIVACY',
    'TELEHEALTH_CONSENT',
    'DATA_SHARING',
    'MARKETING_OPT_IN'
  )),
  consent_version VARCHAR(32) NOT NULL DEFAULT '2026-11',
  granted BOOLEAN NOT NULL,
  source_portal VARCHAR(16) NOT NULL DEFAULT 'PROFILE' CHECK (source_portal IN ('PATIENT', 'STAFF', 'PROFILE')),
  ip_hash VARCHAR(64) NULL,
  user_agent VARCHAR(240) NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  UNIQUE (user_id, consent_type)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('STRIPE', 'CMI_MAROC', 'MANUAL_BANK')),
  event_id VARCHAR(128) NOT NULL,
  resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('PHARMACY_ORDER', 'MEDICAL_INVOICE')),
  resource_id UUID NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency_code CHAR(3) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

-- Composite B-tree & partial indexes for high-concurrency read paths
CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON user_consents (user_id, consent_type);

CREATE INDEX IF NOT EXISTS idx_visit_notes_country_patient_created
  ON visit_notes (country_code, patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_country_status_issued
  ON prescriptions (country_code, status, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_orders_facility_status
  ON lab_orders (facility_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_start
  ON appointments (doctor_user_id, slot_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_active
  ON doctor_schedules (doctor_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_media_user_status
  ON user_media_documents (user_id, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_media_fac_status
  ON facility_media_documents (facility_id, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_occurred
  ON audit_logs (action, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient_created
  ON pharmacy_orders (patient_user_id, created_at DESC);
