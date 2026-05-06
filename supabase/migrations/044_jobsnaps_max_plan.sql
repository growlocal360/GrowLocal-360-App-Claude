-- Migration 044: Add jobsnaps_max subscription plan
-- Premium Job Snaps tier — adds auto-generated flip-through video publishing
-- to Reels/Shorts on top of everything in Job Snaps Pro.

INSERT INTO subscription_plans (name, display_name, price_cents, stripe_price_id, features) VALUES
(
  'jobsnaps_max',
  'Job Snaps Max',
  6700,
  'price_jobsnaps_max_placeholder',
  '[
    "Everything in Job Snaps Pro",
    "Auto-generated flip-through videos for Reels/Shorts",
    "YouTube Shorts publishing",
    "Branded video outros + music",
    "Priority support"
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_cents  = EXCLUDED.price_cents,
  features     = EXCLUDED.features;
