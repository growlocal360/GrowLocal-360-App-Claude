-- Migration 050: Site scope columns + onboarding_analyses table
--
-- Master prompt v4 introduces the concept of SITE_SCOPE — a structured
-- record of which geography a site is being built for. The scope is used
-- to filter GSC data so microsite/city-specific builds aren't polluted
-- by demand signals from cities the user serves but isn't building this
-- site for.
--
-- Forward-only: existing sites get NULL scope columns. The wizard flow
-- only populates these for sites created after this migration ships.
-- Existing sites continue to behave as if FULL_BUSINESS scope.

-- ─── Site scope columns ──────────────────────────────────────────────────────

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS scope_type                 TEXT
    CHECK (scope_type IS NULL OR scope_type IN ('FULL_BUSINESS', 'MICROSITE', 'CITY_SPECIFIC')),
  ADD COLUMN IF NOT EXISTS scope_target_city          TEXT,
  ADD COLUMN IF NOT EXISTS scope_city_variants        TEXT[],
  ADD COLUMN IF NOT EXISTS scope_zip_codes            TEXT[],
  ADD COLUMN IF NOT EXISTS scope_excluded_cities      TEXT[],
  ADD COLUMN IF NOT EXISTS scope_existing_url_pattern TEXT;

COMMENT ON COLUMN sites.scope_type IS
  'v4 SITE_SCOPE — one of FULL_BUSINESS / MICROSITE / CITY_SPECIFIC. NULL on legacy sites (treated as FULL_BUSINESS by callers).';
COMMENT ON COLUMN sites.scope_target_city IS
  'The single city this site is built for (NULL when scope_type = FULL_BUSINESS).';
COMMENT ON COLUMN sites.scope_city_variants IS
  'Search query variants for the target city (e.g., {"Lakewood Ranch","Lakewood Ranch FL","LWR"}). Used by the GSC scope filter.';
COMMENT ON COLUMN sites.scope_zip_codes IS
  'Zip codes covered by the target geography. Used by the GSC scope filter to catch zip-bearing queries.';
COMMENT ON COLUMN sites.scope_excluded_cities IS
  'Other cities the user serves that this site is NOT for. Queries explicitly mentioning these get excluded from analysis.';
COMMENT ON COLUMN sites.scope_existing_url_pattern IS
  'For migrations: URL path prefix on the user''s existing site that scopes to the target geography (e.g., "/lakewood-ranch/"). Lets the GSC filter pull matching pages from gsc_queries.';

-- ─── onboarding_analyses table ───────────────────────────────────────────────
--
-- One row per analysis run. Phase 1 populates scope_snapshot + filtering_report
-- + scoped_gsc_data. Phase 2 will populate gbp_audit_findings + scenario_classification
-- + sitemap_spec via the Claude orchestrator. Re-running analysis on an existing
-- site appends a new row (history preserved).

CREATE TABLE IF NOT EXISTS onboarding_analyses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                  UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  scope_snapshot           JSONB NOT NULL,
  filtering_report         JSONB,
  scoped_gsc_data          JSONB,

  -- Phase 2 columns — populated null in Phase 1
  gbp_audit_findings       JSONB,
  scenario_classification  JSONB,
  sitemap_spec             JSONB,

  -- Claude call metadata (populated by Phase 2 orchestrator, null in Phase 1)
  claude_input_tokens      INTEGER,
  claude_output_tokens     INTEGER,
  model                    TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_analyses_site
  ON onboarding_analyses(site_id, created_at DESC);

COMMENT ON TABLE onboarding_analyses IS
  'Audit log of every onboarding analysis run for a site. Phase 1 populates scope + filter results; Phase 2 adds GBP audit + scenario classification + sitemap spec.';
COMMENT ON COLUMN onboarding_analyses.scope_snapshot IS
  'The full SITE_SCOPE used for this analysis (so we can replay analyses with the exact scope that produced them).';
COMMENT ON COLUMN onboarding_analyses.filtering_report IS
  'Summary of GSC filtering — original impressions vs. filtered impressions, queries excluded due to city mention, confidence level (HIGH/MEDIUM/LOW).';
COMMENT ON COLUMN onboarding_analyses.scoped_gsc_data IS
  'Compact form of the filtered query set — just the queries that made it through the filter, with their core metrics. Full raw data stays in gsc_queries.';
