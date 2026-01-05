-- Migration: Add SEO fields to service_areas table
-- Enables storing generated SEO content for service area pages

-- ============================================
-- ADD SEO FIELDS TO SERVICE_AREAS TABLE
-- ============================================

ALTER TABLE service_areas ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE service_areas ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE service_areas ADD COLUMN IF NOT EXISTS h1 TEXT;
ALTER TABLE service_areas ADD COLUMN IF NOT EXISTS body_copy TEXT;
