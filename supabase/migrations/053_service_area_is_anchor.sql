-- v5 Primary Market refactor — mark GBP-anchored service-area cities.
-- An "anchored" city gets a city-first hub (/{city}/) at root plus
-- /{city}/{service}/ pages, per docs/architecture/growlocal360_master_prompt_v5.md.
-- Non-anchored served cities use Pattern 1 (/{service}/{city}/) or a text mention
-- on /service-areas/. Defaults to false so existing rows are non-anchored.

ALTER TABLE service_areas
  ADD COLUMN IF NOT EXISTS is_anchor boolean NOT NULL DEFAULT false;

-- Fast lookup for the root-segment resolver (site + slug + anchor).
CREATE INDEX IF NOT EXISTS idx_service_areas_anchor
  ON service_areas (site_id, slug)
  WHERE is_anchor = true;
