-- Org-level Google Business Profile connection.
--
-- social_connections is per-site (site_id NOT NULL), but a Job Snaps signup
-- connects GBP before any site exists (the workspace site is created later by
-- the Stripe webhook). The durable home for that connection is the organization;
-- the webhook then clones it down into a per-site social_connections row so the
-- existing per-site publish path keeps working unchanged. A later "Add a New
-- Site" reuses this org connection instead of re-authing.

CREATE TABLE IF NOT EXISTS org_google_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id VARCHAR(255),
  account_name VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  default_location_resource TEXT,   -- selected GBP location resource ("accounts/x/locations/y")
  default_location_json JSONB,      -- mapped location fields for quick prefill/reuse
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_google_connections_org ON org_google_connections(organization_id);

ALTER TABLE org_google_connections ENABLE ROW LEVEL SECURITY;

-- Members of the org can read their org's connection
CREATE POLICY "Members can view their org google connection" ON org_google_connections
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Writes go through the admin client (service role) in API routes, so no
-- INSERT/UPDATE policy is defined for end users.

CREATE TRIGGER update_org_google_connections_updated_at BEFORE UPDATE ON org_google_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
