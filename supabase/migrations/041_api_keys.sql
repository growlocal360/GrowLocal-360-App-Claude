-- Migration 041: API Keys for Job Snaps public REST API
-- Per-site API keys that allow external sites (WordPress, Next.js, embed widget)
-- to fetch published Job Snaps via the /api/v1/* endpoints.
--
-- Keys are SHA-256 hashed at rest. The full key value is shown ONCE at creation
-- and never again. The key_prefix (first ~12 chars) is stored plaintext for UI display.

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,                -- user-supplied label, e.g. "WordPress site"
  key_prefix      TEXT NOT NULL,                -- displayable prefix, e.g. "js_live_a8f3"
  key_hash        TEXT NOT NULL UNIQUE,         -- SHA-256(full key)
  scopes          JSONB NOT NULL DEFAULT '["jobsnaps:read"]'::jsonb,

  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_site_id ON api_keys(site_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage their api keys"
  ON api_keys FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );
