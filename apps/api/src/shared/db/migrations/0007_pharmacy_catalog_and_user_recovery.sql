ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(24) NOT NULL CHECK (
    purpose IN ('VERIFY_EMAIL', 'VERIFY_PHONE', 'RESET_PASSWORD')
  ),
  code_hash VARCHAR(128) NOT NULL,
  target_contact VARCHAR(254) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_verification_lookup
  ON user_verification_codes (user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  sku VARCHAR(48) NOT NULL,
  name VARCHAR(160) NOT NULL,
  generic_name VARCHAR(160) NULL,
  category VARCHAR(32) NOT NULL CHECK (
    category IN (
      'OTC_MEDICATION',
      'PRESCRIPTION_RX',
      'MEDICAL_DEVICE',
      'WELLNESS_SUPPLEMENT',
      'PEDIATRIC_CARE',
      'COLD_CHAIN'
    )
  ),
  dosage_form VARCHAR(80) NOT NULL DEFAULT 'Tablet',
  strength VARCHAR(64) NOT NULL DEFAULT '500mg',
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency_code VARCHAR(4) NOT NULL,
  stock_qty INTEGER NOT NULL CHECK (stock_qty >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_object_key VARCHAR(320) NULL,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (facility_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_country_active
  ON pharmacy_products (country_code, is_active, category, created_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(4) NOT NULL,
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  prescription_id UUID NULL REFERENCES prescriptions(id) ON DELETE SET NULL,
  fulfillment_mode VARCHAR(24) NOT NULL CHECK (
    fulfillment_mode IN ('PHARMACY_PICKUP', 'COURIER_DELIVERY')
  ),
  delivery_address VARCHAR(280) NULL,
  delivery_lat DOUBLE PRECISION NULL,
  delivery_lng DOUBLE PRECISION NULL,
  dispatch_request_id UUID NULL REFERENCES dispatch_requests(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (
    status IN (
      'PENDING_PAYMENT',
      'PAID',
      'PREPARING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    )
  ),
  currency_code VARCHAR(4) NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor > 0),
  delivery_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor > 0),
  payment_method VARCHAR(32) NULL,
  payment_reference VARCHAR(120) NULL,
  receipt_number VARCHAR(64) NULL UNIQUE,
  notes VARCHAR(400) NULL,
  paid_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient
  ON pharmacy_orders (country_code, patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_facility
  ON pharmacy_orders (facility_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE RESTRICT,
  product_name VARCHAR(160) NOT NULL,
  sku VARCHAR(48) NOT NULL,
  requires_prescription BOOLEAN NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor > 0)
);
