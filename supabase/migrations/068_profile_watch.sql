-- Nightly Google Business Profile snapshot + detected changes (owner alerts),
-- and the weekly digest bookkeeping.
CREATE TABLE IF NOT EXISTS gbp_profile_snapshots (
  site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gbp_profile_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,              -- [{field,label,before,after}]
  detected_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_gbp_profile_changes_site ON gbp_profile_changes (site_id, detected_at DESC);

ALTER TABLE gbp_profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_profile_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read profile changes for their sites" ON gbp_profile_changes;
CREATE POLICY "Members can read profile changes for their sites"
  ON gbp_profile_changes FOR SELECT TO authenticated
  USING (public.user_can_access_site(site_id));
