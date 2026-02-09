-- Migration: Add structured content fields for enhanced templates
-- Services get richer content: intro_copy, problems, detailed_sections
-- Site pages get hero_description and body_copy_2

-- ============================================
-- SERVICES TABLE — Structured content fields
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS intro_copy TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS problems JSONB;
-- problems format: [{"heading": "...", "description": "..."}]

ALTER TABLE services ADD COLUMN IF NOT EXISTS detailed_sections JSONB;
-- detailed_sections format: [{"h2": "...", "body": "...", "bullets": ["...", "..."]}]

-- ============================================
-- SITE_PAGES TABLE — Additional content fields
-- ============================================

ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS hero_description TEXT;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS body_copy_2 TEXT;
