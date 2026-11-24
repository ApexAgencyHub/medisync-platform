-- Add composite index for structured Moroccan city lookups and drop exact duplicate trigram indexes
-- created across migrations 0008 and 0013 to avoid unnecessary index maintenance overhead.

CREATE INDEX IF NOT EXISTS idx_facilities_country_city
  ON facilities (country_code, city)
  WHERE verification_status = 'VERIFIED';

DROP INDEX IF EXISTS idx_facilities_trgm_name;
DROP INDEX IF EXISTS idx_facilities_trgm_address;
DROP INDEX IF EXISTS idx_users_trgm_fullname;
DROP INDEX IF EXISTS idx_pharmacy_products_trgm_name;
