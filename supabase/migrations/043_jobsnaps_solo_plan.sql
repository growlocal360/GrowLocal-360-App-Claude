-- Migration 043: Add jobsnaps_solo subscription plan
-- Plan for the standalone Job Snaps product (jobsnaps.ai wedge tier).
-- Stripe price ID is a placeholder — replace via STRIPE_JOBSNAPS_PRO_PRICE_ID env var
-- and update this row with the real price_id from your Stripe Dashboard.

INSERT INTO subscription_plans (name, display_name, price_cents, stripe_price_id, features) VALUES
(
  'jobsnaps_solo',
  'Job Snaps Pro',
  3700,
  'price_jobsnaps_pro_placeholder',
  '[
    "AI-generated photo titles + descriptions",
    "Push to your existing website (Next.js, WordPress, anywhere)",
    "Push to Google Business Profile",
    "Unlimited Job Snaps",
    "API + Webhooks",
    "14-day free trial"
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_cents  = EXCLUDED.price_cents,
  features     = EXCLUDED.features;
