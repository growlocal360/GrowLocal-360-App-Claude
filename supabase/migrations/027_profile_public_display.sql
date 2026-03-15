-- Migration: Add public display fields to profiles
-- Allows team members to opt-in to being shown on the public website

ALTER TABLE profiles ADD COLUMN show_on_site boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN display_order integer NOT NULL DEFAULT 0;
