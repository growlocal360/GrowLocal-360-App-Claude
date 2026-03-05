-- Build logs table for real-time content generation progress tracking
CREATE TABLE IF NOT EXISTS build_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  step text,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying logs by site (most recent first)
CREATE INDEX idx_build_logs_site_id_created ON build_logs(site_id, created_at DESC);

-- RLS: only org members can read their site's build logs
ALTER TABLE build_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view build logs for their org's sites"
  ON build_logs FOR SELECT
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Service role can insert (used by Inngest functions via admin client)
CREATE POLICY "Service role can insert build logs"
  ON build_logs FOR INSERT
  WITH CHECK (true);

-- Enable realtime for build_logs so dashboard can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE build_logs;
