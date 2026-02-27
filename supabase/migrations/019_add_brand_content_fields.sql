-- Add AI-generated content fields to site_brands
-- These are populated by the generate-content pipeline (same as services, categories, etc.)

ALTER TABLE site_brands
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS h1 text,
  ADD COLUMN IF NOT EXISTS hero_description text,
  ADD COLUMN IF NOT EXISTS body_copy text,
  ADD COLUMN IF NOT EXISTS value_props jsonb,
  ADD COLUMN IF NOT EXISTS faqs jsonb,
  ADD COLUMN IF NOT EXISTS cta_heading text,
  ADD COLUMN IF NOT EXISTS cta_description text;
