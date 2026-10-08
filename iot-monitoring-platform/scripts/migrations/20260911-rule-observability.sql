-- Ampliación aditiva e idempotente; ejecutar antes de desplegar los servicios.
ALTER TYPE alert_rules_condition_enum ADD VALUE IF NOT EXISTS 'OUTSIDE_RANGE';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS zone varchar(150);
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS device_ids jsonb;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS custom_message varchar(500);
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS color varchar(7);
