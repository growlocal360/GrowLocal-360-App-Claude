-- Per-snap SEO overrides (Advanced SEO panel). The naming engine recomputes
-- meta_title/h1/meta_description/alt/etc. on every save; without a stored
-- record of what the owner overrode, the next routine save silently reverted
-- their edit. Keys: slug, meta_title, h1, meta_description, alt_text_default,
-- image_filename_base, public_location_label. "Regenerate SEO Fields" clears it.

ALTER TABLE job_snaps
  ADD COLUMN IF NOT EXISTS seo_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN job_snaps.seo_overrides IS 'Owner overrides of naming-engine SEO fields; re-applied on every save until Regenerate SEO Fields clears them.';
