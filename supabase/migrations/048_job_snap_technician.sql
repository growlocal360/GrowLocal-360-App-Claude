-- Migration 048: Job Snap technician attribution
--
-- Adds a distinct `technician_id` column to job_snaps so admins/owners can
-- credit the actual technician who did the work, separate from `created_by`
-- (the user who uploaded the snap — often an admin uploading on behalf of
-- a crew member).
--
-- Also adds a denormalized technician snapshot to work_items so the public
-- /work/<slug> page can render "Job by <Name>" without joining profiles.
-- Captured at publish-website time and refreshed on re-publish.
--
-- Forward-only: existing rows have technician_id = NULL. The public renderer
-- falls back to the uploader's profile or a generic "the team" label.

ALTER TABLE job_snaps
  ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_snaps_technician_id
  ON job_snaps(technician_id)
  WHERE technician_id IS NOT NULL;

COMMENT ON COLUMN job_snaps.technician_id IS
  'Profile of the technician credited for the work. Distinct from created_by (the uploader). May be null when uploaded by admin/owner without explicit attribution.';

-- ─── Denormalized snapshot on work_items ──────────────────────────────────────

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS technician_name      TEXT,
  ADD COLUMN IF NOT EXISTS technician_title     TEXT,
  ADD COLUMN IF NOT EXISTS technician_avatar_url TEXT;

COMMENT ON COLUMN work_items.technician_name IS
  'Denormalized snapshot of the technician''s full_name at publish time. Refreshed on re-publish. NULL = no attribution.';
COMMENT ON COLUMN work_items.technician_title IS
  'Denormalized snapshot of the technician''s job title at publish time.';
COMMENT ON COLUMN work_items.technician_avatar_url IS
  'Denormalized snapshot of the technician''s avatar URL at publish time.';
