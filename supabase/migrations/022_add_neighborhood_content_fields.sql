-- Add AI-generated content fields to neighborhoods
ALTER TABLE neighborhoods
  ADD COLUMN IF NOT EXISTS h1 TEXT,
  ADD COLUMN IF NOT EXISTS body_copy TEXT,
  ADD COLUMN IF NOT EXISTS local_features JSONB,
  ADD COLUMN IF NOT EXISTS faqs JSONB;
