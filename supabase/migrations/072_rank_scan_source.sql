-- Rank scans can come from two Google surfaces: the Local Pack (the 3-business box
-- inside a web search, what most customers see first) and Google Maps (the full
-- ranked list). Existing rows are Maps scans.
ALTER TABLE rank_scans ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'maps';
CREATE INDEX IF NOT EXISTS idx_rank_scans_site_src_kw ON rank_scans (site_id, source, keyword, scanned_at DESC);
