-- 0013_production_indexes_and_trgm.sql
-- Adds missing clinical/billing composite indexes, enables pg_trgm GIN indexes for ILIKE search,
-- and drops redundant duplicate indexes identified during production audit.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Missing clinical & billing composite indexes
CREATE INDEX IF NOT EXISTS idx_visit_notes_doctor_created
  ON visit_notes (doctor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_notes_appointment
  ON visit_notes (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_issued
  ON prescriptions (doctor_user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_created
  ON lab_orders (ordered_by_doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_invoices_facility_status_created
  ON medical_invoices (facility_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_invoices_country_created
  ON medical_invoices (country_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_media_lab_order
  ON clinical_media_objects (lab_order_id)
  WHERE lab_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_facility_active
  ON pharmacy_products (facility_id, is_active);

-- Trigram GIN indexes for leading-wildcard ILIKE directory & catalog search
CREATE INDEX IF NOT EXISTS idx_facilities_name_trgm
  ON facilities USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_facilities_address_trgm
  ON facilities USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialty_trgm
  ON doctor_profiles USING GIN (specialty gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_name_trgm
  ON pharmacy_products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_sku_trgm
  ON pharmacy_products USING GIN (sku gin_trgm_ops);

-- Drop strictly redundant duplicate indexes
DROP INDEX IF EXISTS idx_clinical_media_patient;
DROP INDEX IF EXISTS idx_prescriptions_country_status;
DROP INDEX IF EXISTS idx_facilities_country_verified_kind;
DROP INDEX IF EXISTS idx_user_consents_user;
