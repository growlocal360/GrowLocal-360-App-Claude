-- Per-service hero image for the service page (uploaded by the site owner in
-- Settings → Services). Stored as a clean /public/assets/... path like the
-- other site assets. NULL = no image; the template renders the text-only hero.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS hero_image_url text;
