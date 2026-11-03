-- Social fan-out: Facebook Pages + Instagram Business accounts connected per
-- site through one Meta login. Every published Job Snap and every Google post
-- can be re-posted to the connected channels through pending_actions
-- (action_type 'social_post', already allowed by migration 063).

-- LinkedIn comes later; add the enum value now so no second migration is needed.
ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'linkedin';

ALTER TABLE social_connections
  -- Platform-specific extras: page picture, Instagram username, the Meta user
  -- who granted access (needed for the deauthorize / data-deletion callbacks),
  -- which Facebook Page an Instagram account hangs off.
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connected_by uuid;

CREATE INDEX IF NOT EXISTS idx_social_connections_meta_user
  ON social_connections ((metadata->>'meta_user_id'))
  WHERE platform IN ('facebook', 'instagram');
