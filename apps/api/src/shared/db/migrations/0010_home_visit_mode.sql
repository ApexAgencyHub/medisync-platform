-- Support explicit HOME_VISIT consultation mode across schedules and appointments,
-- aligning Home Nursing & Infirmiers practitioners with industry home-care workflows.

ALTER TABLE doctor_schedules
  DROP CONSTRAINT IF EXISTS doctor_schedules_visit_mode_check;

ALTER TABLE doctor_schedules
  ADD CONSTRAINT doctor_schedules_visit_mode_check
  CHECK (visit_mode IN ('IN_PERSON', 'TELEHEALTH', 'HOME_VISIT'));

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_visit_mode_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_visit_mode_check
  CHECK (visit_mode IN ('IN_PERSON', 'TELEHEALTH', 'HOME_VISIT'));

UPDATE doctor_profiles
SET
  home_visit_enabled = TRUE,
  telehealth_enabled = FALSE,
  updated_at = NOW()
WHERE specialty ~* 'nursing|infirmier|nurse';

UPDATE doctor_schedules ds
SET visit_mode = 'HOME_VISIT'
FROM doctor_profiles dp
WHERE dp.doctor_user_id = ds.doctor_user_id
  AND dp.specialty ~* 'nursing|infirmier|nurse'
  AND ds.visit_mode <> 'HOME_VISIT';
