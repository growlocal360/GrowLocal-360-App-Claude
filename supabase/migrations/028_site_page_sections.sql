-- Migration: Add sections JSONB column to site_pages
-- Stores structured content blocks for enhanced About page (EEAT sections)

ALTER TABLE site_pages ADD COLUMN sections jsonb DEFAULT NULL;
