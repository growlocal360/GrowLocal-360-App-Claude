-- Automation foundation: per-site autopilot switch + an approval queue that
-- every automated action (review replies now; GBP posts, photos, social and
-- review requests later) flows through.
--
--   automation_mode = 'approve'   -> drafts wait in pending_actions for a human
--   automation_mode = 'autopilot' -> safe actions publish on their own; risky
--                                    ones (e.g. replies to 1-2 star reviews)
--                                    still wait for approval

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'approve'
    CHECK (automation_mode IN ('approve', 'autopilot'));

CREATE TABLE IF NOT EXISTS pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN ('review_reply', 'gbp_post', 'social_post', 'photo_upload', 'review_request')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')),
  -- The drafted content (e.g. { reply: "..." })
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What the action is about (e.g. the review: id, rating, author, comment)
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Idempotency key so a re-run never drafts the same thing twice,
  -- e.g. 'review_reply:<google_review_id>'
  source_key text,
  -- 'autopilot' when published without a human, otherwise null until decided
  decided_by uuid,
  decided_at timestamptz,
  published_at timestamptz,
  auto_published boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_site_status
  ON pending_actions (site_id, status, created_at DESC);

ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

-- Dashboard reads (badge counts, lists) go through the browser client; all
-- writes go through server routes with the service-role client.
DROP POLICY IF EXISTS "Members can read pending actions for their sites" ON pending_actions;
CREATE POLICY "Members can read pending actions for their sites"
  ON pending_actions FOR SELECT
  TO authenticated
  USING (public.user_can_access_site(site_id));
