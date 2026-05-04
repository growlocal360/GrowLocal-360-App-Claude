-- Migration 042: Webhook endpoints + delivery log
-- Customers register webhook URLs to receive events when Job Snaps are
-- published, updated, or deleted. Used to trigger ISR/rebuild on their sites.
--
-- Payloads are signed with HMAC-SHA256 using the endpoint secret so receivers
-- can verify the request actually came from us.

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,                -- HMAC signing secret (plaintext; rotate via UI)
  events          JSONB NOT NULL DEFAULT '["job_snap.published","job_snap.updated","job_snap.unpublished"]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_site_id ON webhook_endpoints(site_id);

DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Delivery log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_endpoint_id   UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,

  event_type            TEXT NOT NULL,           -- e.g. 'job_snap.published'
  payload               JSONB NOT NULL,

  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts              INTEGER NOT NULL DEFAULT 0,
  last_attempt_at       TIMESTAMPTZ,
  response_status       INTEGER,
  response_body         TEXT,
  error_message         TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON webhook_deliveries(webhook_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage their webhook endpoints"
  ON webhook_endpoints FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can view their webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (
    webhook_endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );
