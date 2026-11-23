-- Phase 11: First-class NURSE (Infirmier / Home Nursing) ecosystem role

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'PATIENT',
    'CAREGIVER',
    'DOCTOR',
    'NURSE',
    'CLINIC_STAFF',
    'HOSPITAL_ADMIN',
    'DRIVER',
    'PHARMACIST',
    'LAB_TECH',
    'OPS_ADMIN'
  ));

UPDATE users
SET
  role = 'NURSE',
  credential_verified = TRUE
WHERE email IN ('nurse.ma@medisync.global', 'nurse.intl@medisync.global')
  AND role = 'DOCTOR';
