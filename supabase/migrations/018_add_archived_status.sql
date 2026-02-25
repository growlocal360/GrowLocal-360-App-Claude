-- Add 'archived' to the allowed site status values
-- This enables soft-delete: archived sites are hidden from the default view
-- but can be restored at any time.

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE sites ADD CONSTRAINT sites_status_check
  CHECK (status IN ('building', 'active', 'paused', 'failed', 'suspended', 'archived'));
