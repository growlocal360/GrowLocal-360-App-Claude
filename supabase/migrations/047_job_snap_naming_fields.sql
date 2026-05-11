-- Migration 047: Job Snap SEO Naming Engine — structured fields + generated SEO defaults
--
-- Adds a canonical naming layer to job_snaps so every newly created snap carries
-- pre-computed SEO-safe defaults (slug, meta_title, h1, alt_text, image_filename, etc.)
-- alongside the structured fields used to derive them (primary_problem, equipment_type,
-- neighborhood, state_abbr, short_id, etc.).
--
-- GL360-generated SEO fields are the source of truth for every Job Snap. Customer
-- integrations consume these fields verbatim unless an explicit override is configured.
--
-- Forward-only: all columns are nullable so existing rows are unaffected. Only newly
-- created or explicitly regenerated snaps populate these fields.

-- ─── Structured fields (analyzer + user input) ────────────────────────────────

ALTER TABLE job_snaps
  ADD COLUMN IF NOT EXISTS primary_problem      TEXT,
  ADD COLUMN IF NOT EXISTS equipment_type       TEXT,
  ADD COLUMN IF NOT EXISTS client_name          TEXT,        -- NEVER serialized publicly
  ADD COLUMN IF NOT EXISTS neighborhood         TEXT,
  ADD COLUMN IF NOT EXISTS street_name_public   TEXT,        -- derived from address_public
  ADD COLUMN IF NOT EXISTS state_abbr           TEXT,        -- normalized 2-char abbreviation
  ADD COLUMN IF NOT EXISTS short_id             TEXT;        -- 4-char lowercase hex

-- ─── Generated SEO fields (computed by src/lib/job-snaps/naming.ts) ───────────

ALTER TABLE job_snaps
  ADD COLUMN IF NOT EXISTS slug                  TEXT,
  ADD COLUMN IF NOT EXISTS url_path              TEXT,
  ADD COLUMN IF NOT EXISTS meta_title            TEXT,
  ADD COLUMN IF NOT EXISTS h1                    TEXT,
  ADD COLUMN IF NOT EXISTS meta_description      TEXT,
  ADD COLUMN IF NOT EXISTS alt_text_default      TEXT,
  ADD COLUMN IF NOT EXISTS image_filename_base   TEXT,
  ADD COLUMN IF NOT EXISTS public_location_label TEXT;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Slug collision detection within a site (slug is unique per site, not globally —
-- two different sites can have the same slug, but two snaps on one site cannot).

CREATE INDEX IF NOT EXISTS idx_job_snaps_site_slug
  ON job_snaps(site_id, slug)
  WHERE slug IS NOT NULL;

-- Short ID uniqueness within a site (used as fallback collision suffix).
CREATE INDEX IF NOT EXISTS idx_job_snaps_site_short_id
  ON job_snaps(site_id, short_id)
  WHERE short_id IS NOT NULL;

-- ─── Column comments (documentation in DB) ────────────────────────────────────

COMMENT ON COLUMN job_snaps.primary_problem      IS 'Short noun phrase describing the core issue/task (e.g., "drum roller replacement", "storm damage cleanup"). Used by the naming engine.';
COMMENT ON COLUMN job_snaps.equipment_type       IS 'Type of equipment serviced when applicable (e.g., "Dryer", "Condenser Unit"). Null for non-equipment services.';
COMMENT ON COLUMN job_snaps.client_name          IS 'Internal-only customer/family name. NEVER serialized to webhook payloads or rendered on public pages.';
COMMENT ON COLUMN job_snaps.neighborhood         IS 'Neighborhood or area name for hyper-local SEO signals. Public.';
COMMENT ON COLUMN job_snaps.street_name_public   IS 'Sanitized street name only — no house number. Derived from address_public.';
COMMENT ON COLUMN job_snaps.state_abbr           IS 'Normalized 2-character state abbreviation (e.g., "LA"). Computed from state via normalizeStateAbbr().';
COMMENT ON COLUMN job_snaps.short_id             IS '4-character lowercase hex identifier. Used as collision suffix on slug and as part of image filenames.';
COMMENT ON COLUMN job_snaps.slug                 IS 'GL360-generated SEO-safe slug. Source of truth for /work/<slug> URLs across all integrations.';
COMMENT ON COLUMN job_snaps.url_path             IS 'GL360-generated public URL path, e.g., "/work/<slug>/".';
COMMENT ON COLUMN job_snaps.meta_title           IS 'GL360-generated <title> tag value (≤120 chars). Source of truth across all output channels.';
COMMENT ON COLUMN job_snaps.h1                   IS 'GL360-generated H1 heading for the snap detail page.';
COMMENT ON COLUMN job_snaps.meta_description     IS 'GL360-generated <meta name="description"> value (140–160 chars).';
COMMENT ON COLUMN job_snaps.alt_text_default     IS 'GL360-generated default alt text for snap images. Per-image alt text in job_snap_media.alt_text overrides when present.';
COMMENT ON COLUMN job_snaps.image_filename_base  IS 'GL360-generated SEO-safe filename base (no extension, no index). Per-image filename = "<base>-<index>.<ext>".';
COMMENT ON COLUMN job_snaps.public_location_label IS 'Human-readable location string for public display (e.g., "Graywood, Lake Charles, LA"). Never includes house number.';
