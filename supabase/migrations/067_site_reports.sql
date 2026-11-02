-- Monthly owner reports: one row per site per calendar month, generated on the
-- 1st for the previous month (and on demand for the current month to date).
CREATE TABLE IF NOT EXISTS site_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key text NOT NULL,            -- 'YYYY-MM'
  period_start date NOT NULL,
  period_end date NOT NULL,
  data jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_site_reports_site ON site_reports (site_id, period_key DESC);
ALTER TABLE site_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read reports for their sites" ON site_reports;
CREATE POLICY "Members can read reports for their sites"
  ON site_reports FOR SELECT TO authenticated
  USING (public.user_can_access_site(site_id));
