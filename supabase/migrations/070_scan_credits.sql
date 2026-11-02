-- Scan credits for manual Google Maps rank scans (weekly scheduled scans are
-- included; "Scan now" spends one credit per keyword). Held per organization
-- with a ledger row for every change. New orgs start with a small welcome balance.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS scan_credits int NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS scan_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  delta int NOT NULL,
  balance_after int NOT NULL,
  reason text NOT NULL,                 -- 'manual_scan', 'refund:<keyword>', 'purchase:pack_30', 'welcome'
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_credit_ledger_org ON scan_credit_ledger (organization_id, created_at DESC);
ALTER TABLE scan_credit_ledger ENABLE ROW LEVEL SECURITY;
