-- Owner-uploaded hero image for core pages (home first). Takes priority over
-- the AI-generated hero in generated_images; NULL = use the generated one.
ALTER TABLE site_pages
  ADD COLUMN IF NOT EXISTS hero_image_url text;
