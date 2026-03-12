-- Google Search Console query data
CREATE TABLE IF NOT EXISTS gsc_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  page_url TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DOUBLE PRECISION DEFAULT 0,
  position DOUBLE PRECISION DEFAULT 0,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, query, page_url, date_range_start, date_range_end)
);

CREATE INDEX idx_gsc_queries_site ON gsc_queries(site_id);
CREATE INDEX idx_gsc_queries_impressions ON gsc_queries(site_id, impressions DESC);

-- RLS (admin client bypasses, but good practice)
ALTER TABLE gsc_queries ENABLE ROW LEVEL SECURITY;
