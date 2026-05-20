-- Migration 049: Multi-attachment for Job Snaps
--
-- A snap should be able to appear on multiple public pages, not just one
-- service page. This polymorphic join table lets a single snap attach to
-- any combination of services, categories, brands, and service areas.
--
-- target_type is one of:
--   'service'      → target_id references services(id)
--   'category'     → target_id references site_categories(id)
--   'brand'        → target_id references site_brands(id)
--   'service_area' → target_id references service_areas(id)
--
-- target_id is NOT a foreign key because PostgreSQL doesn't support
-- polymorphic FKs. Integrity is preserved by:
--   - target_type CHECK constraint (only 4 valid values)
--   - site_id FK ensures the row dies if the site is hard-deleted
--   - job_snap_id FK CASCADE handles snap deletion
--   - Periodic cleanup of orphaned rows when targets are deleted (handled
--     by the routes that delete services/brands/areas — they also DELETE
--     from job_snap_attachments WHERE target_id = ...)
--
-- Forward-only: existing snaps don't get attachment rows. The public
-- renderer queries both this table AND the legacy single-FK paths
-- (work_items.service_id, work_items.brand_name, work_items.address_city)
-- so old snaps continue to surface on their pages until they're republished.

CREATE TABLE IF NOT EXISTS job_snap_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_snap_id   UUID NOT NULL REFERENCES job_snaps(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('service', 'category', 'brand', 'service_area')),
  target_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_snap_id, target_type, target_id)
);

-- Index for the hot public-renderer query: "give me every snap attached to
-- this brand/area/service/category on this site".
CREATE INDEX IF NOT EXISTS idx_job_snap_attachments_target
  ON job_snap_attachments(site_id, target_type, target_id);

-- Index for the snap-edit query: "what is this snap attached to?".
CREATE INDEX IF NOT EXISTS idx_job_snap_attachments_job_snap
  ON job_snap_attachments(job_snap_id);

COMMENT ON TABLE job_snap_attachments IS
  'Polymorphic join: a Job Snap can attach to multiple services, categories, brands, and service areas. target_type discriminates which table target_id points to.';
COMMENT ON COLUMN job_snap_attachments.target_type IS
  'One of: service | category | brand | service_area. Matches the table the target_id row lives in (services, site_categories, site_brands, service_areas).';
COMMENT ON COLUMN job_snap_attachments.target_id IS
  'UUID of the row in the target_type-named table. Not declared as a FK because PostgreSQL lacks polymorphic FKs; cleanup happens at the route layer when a target is deleted.';
