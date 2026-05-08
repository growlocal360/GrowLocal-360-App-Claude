-- Migration 046: Per-site third-party integration credentials
--
-- Stores OAuth tokens / API keys for external services (HighLevel today; Meta,
-- TikTok, YouTube later). The access_token column is encrypted at the app
-- layer with AES-256-GCM (see src/lib/integrations/crypto.ts) — the value
-- stored here is ciphertext, not the raw token.
--
-- The metadata JSONB column holds provider-specific data (HL location_id,
-- HL blog_id, mapping of snap_id → hl_post_id for updates/deletes, etc.).
--
-- Unique constraint on (site_id, provider) means one connection per provider
-- per site. Reconnecting overwrites the old credentials.

CREATE TABLE IF NOT EXISTS integration_credentials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  provider        TEXT NOT NULL CHECK (provider IN ('highlevel', 'meta', 'tiktok', 'youtube')),

  -- Encrypted at the application layer with AES-256-GCM.
  -- Format: base64( iv || authTag || ciphertext ).
  access_token    TEXT NOT NULL,

  -- Optional refresh token for OAuth flows (HL Private Integration Tokens
  -- don't refresh — they're long-lived. Reserved for future OAuth providers).
  refresh_token   TEXT,

  -- Provider-specific data (location_id, blog_id, post mapping, etc.)
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(site_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_site_id
  ON integration_credentials(site_id);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_provider
  ON integration_credentials(provider);

DROP TRIGGER IF EXISTS update_integration_credentials_updated_at ON integration_credentials;
CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage their integration credentials"
  ON integration_credentials FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );
