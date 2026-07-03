-- Add flexible metadata column to leads for niche-specific intake answers
-- (e.g. appliance repair: brand, symptom, zip). Reserved columns (name, phone,
-- email, service_type, message, address) stay first-class; everything niche-
-- specific lands here so we don't need a schema change per niche.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
