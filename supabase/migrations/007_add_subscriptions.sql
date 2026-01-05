-- Migration: Add subscription tables for Stripe payments
-- Phase 4: Stripe Subscription Integration

-- Subscription plans (static reference data)
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,              -- 'growth', 'growth_ai_leads'
  display_name TEXT NOT NULL,             -- 'Growth', 'Growth + AI Leads'
  price_cents INTEGER NOT NULL,           -- 7900, 29700
  stripe_price_id TEXT NOT NULL,          -- Stripe Price ID
  features JSONB DEFAULT '[]'::jsonb,     -- Feature list for display
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,                   -- 'succeeded', 'failed', 'pending', 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add GHL settings columns to sites table for Growth + AI Leads tier
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ghl_location_id TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ghl_chat_widget_id TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ghl_tracking_phone TEXT;

-- Add stripe_customer_id to profiles for future reference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create indexes for performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_site_id ON subscriptions(site_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_stripe_invoice_id ON payments(stripe_invoice_id);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (readable by all authenticated users)
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = TRUE);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (
    subscription_id IN (SELECT id FROM subscriptions WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage all payments" ON payments
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Insert default subscription plans
-- Note: stripe_price_id values should be updated after creating prices in Stripe Dashboard
INSERT INTO subscription_plans (name, display_name, price_cents, stripe_price_id, features) VALUES
(
  'growth',
  'Growth',
  7900,
  'price_growth_placeholder',  -- Replace with actual Stripe Price ID
  '[
    "AI-Generated SEO Website",
    "Job Snaps Photo Posts",
    "Unlimited Service Pages",
    "Service Area Landing Pages",
    "Mobile-Optimized Design",
    "Basic Analytics"
  ]'::jsonb
),
(
  'growth_ai_leads',
  'Growth + AI Leads',
  29700,
  'price_growth_ai_leads_placeholder',  -- Replace with actual Stripe Price ID
  '[
    "Everything in Growth",
    "AI Chat Widget",
    "Call Tracking Number",
    "CRM Integration (GoHighLevel)",
    "Automated Follow-ups",
    "Missed Call Text Back",
    "Lead Notifications",
    "Priority Support"
  ]'::jsonb
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Pending site data for checkout flow (stores wizard data until payment completes)
CREATE TABLE pending_site_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_data JSONB NOT NULL,
  stripe_session_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_site_data_user_id ON pending_site_data(user_id);
CREATE INDEX idx_pending_site_data_stripe_session_id ON pending_site_data(stripe_session_id);
CREATE INDEX idx_pending_site_data_expires_at ON pending_site_data(expires_at);

-- Enable RLS on pending_site_data
ALTER TABLE pending_site_data ENABLE ROW LEVEL SECURITY;

-- RLS for pending_site_data
CREATE POLICY "Users can manage own pending site data" ON pending_site_data
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all pending site data" ON pending_site_data
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
