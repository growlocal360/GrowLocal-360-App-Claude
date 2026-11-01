-- Review requests: ask a customer for a Google review by text and/or email
-- after a completed appointment (automatic) or on demand from a lead or a
-- manual form. Each request is also a pending_actions row of type
-- 'review_request' so it follows the site's approve / autopilot rule.

CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  pending_action_id uuid REFERENCES pending_actions(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'lead', 'appointment_completed')),
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  review_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  -- channels that actually delivered: {'sms','email'}
  channels text[] NOT NULL DEFAULT '{}',
  sms_sid text,
  sent_at timestamptz,
  follow_up_due_at timestamptz,
  follow_up_sent_at timestamptz,
  follow_up_note text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One automatic request per appointment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_requests_appointment
  ON review_requests (site_id, appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_requests_site_created
  ON review_requests (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_follow_up
  ON review_requests (follow_up_due_at) WHERE status = 'sent' AND follow_up_sent_at IS NULL;

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read review requests for their sites" ON review_requests;
CREATE POLICY "Members can read review requests for their sites"
  ON review_requests FOR SELECT
  TO authenticated
  USING (public.user_can_access_site(site_id));
