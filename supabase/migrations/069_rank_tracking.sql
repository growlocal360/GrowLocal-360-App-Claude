-- Maps grid rank scans + AI assistant visibility checks.
CREATE TABLE IF NOT EXISTS rank_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  grid_size int NOT NULL,
  spacing_miles numeric NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  points jsonb NOT NULL,          -- [{row,col,lat,lng,rank|null}]
  summary jsonb NOT NULL,         -- {totalPoints,foundPoints,top3Points,top10Points,averageRank,visibility}
  cost_usd numeric,
  failed_points int NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'dataforseo',
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_scans_site_kw ON rank_scans (site_id, keyword, scanned_at DESC);

CREATE TABLE IF NOT EXISTS ai_visibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  batch_at timestamptz NOT NULL,
  model text NOT NULL,            -- claude | openai | ...
  model_id text NOT NULL,
  prompt text NOT NULL,
  mentioned boolean NOT NULL,
  answered boolean NOT NULL DEFAULT true,   -- false when the assistant declined to name any business
  position int,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_visibility_site ON ai_visibility_checks (site_id, batch_at DESC);

ALTER TABLE rank_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read rank scans for their sites" ON rank_scans;
CREATE POLICY "Members can read rank scans for their sites" ON rank_scans FOR SELECT TO authenticated USING (public.user_can_access_site(site_id));
DROP POLICY IF EXISTS "Members can read AI checks for their sites" ON ai_visibility_checks;
CREATE POLICY "Members can read AI checks for their sites" ON ai_visibility_checks FOR SELECT TO authenticated USING (public.user_can_access_site(site_id));
