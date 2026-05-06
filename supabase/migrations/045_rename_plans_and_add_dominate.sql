-- Migration 045: Rename subscription_plans to match new display names + add Dominate tier
--
-- Renames the internal plan keys so they match what customers see:
--   growth         (was $79  display "Growth")           → starter       ($147 "GrowLocal 360 Starter")
--   growth_ai_leads (was $297 display "Growth + AI Leads") → growth        ($297 "GrowLocal 360 Growth")
--   jobsnaps_solo  ($37  display "Job Snaps Pro")        → jobsnaps_pro  ($37 unchanged)
--
-- Also bumps Starter from $79 → $147 (price realignment), updates feature
-- lists to call out bundled Job Snaps tiers, and adds the new $497 Dominate tier.
--
-- IMPORTANT ORDER: rename growth → starter BEFORE growth_ai_leads → growth, or
-- the unique constraint on subscription_plans.name will block the second update.

-- ─── 1. growth → starter (also bump price to $147) ───────────────────────────

UPDATE subscription_plans
SET name = 'starter',
    display_name = 'GrowLocal 360 Starter',
    price_cents = 14700,
    features = '[
      "AI-generated SEO website built for local map pack ranking",
      "Job Snaps Pro included ($37 value)",
      "Unlimited service + service area landing pages",
      "GBP integration",
      "Lead capture forms + basic scheduling",
      "Mobile-optimized design",
      "Basic analytics"
    ]'::jsonb
WHERE name = 'growth';

-- ─── 2. growth_ai_leads → growth (price unchanged at $297) ───────────────────

UPDATE subscription_plans
SET name = 'growth',
    display_name = 'GrowLocal 360 Growth',
    features = '[
      "Everything in Starter",
      "Job Snaps Max included ($67 value)",
      "AI chat widget",
      "Call tracking number",
      "CRM integration (GoHighLevel)",
      "Automated follow-ups",
      "Missed call text back",
      "Lead notifications",
      "Priority support"
    ]'::jsonb
WHERE name = 'growth_ai_leads';

-- ─── 3. jobsnaps_solo → jobsnaps_pro (price + features unchanged) ────────────

UPDATE subscription_plans
SET name = 'jobsnaps_pro',
    display_name = 'Job Snaps Pro'
WHERE name = 'jobsnaps_solo';

-- ─── 4. Add Dominate tier ($497) ─────────────────────────────────────────────

INSERT INTO subscription_plans (name, display_name, price_cents, stripe_price_id, features) VALUES
(
  'dominate',
  'GrowLocal 360 Dominate',
  49700,
  'price_dominate_placeholder',
  '[
    "Everything in Growth",
    "HighLevel Conversations AI",
    "HighLevel Voice AI (AI receptionist)",
    "Custom AI agents",
    "Multi-location support",
    "Advanced analytics + GSC feedback loop",
    "Dedicated account manager"
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_cents  = EXCLUDED.price_cents,
  features     = EXCLUDED.features;
