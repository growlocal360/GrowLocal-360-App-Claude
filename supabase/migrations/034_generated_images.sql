-- Store generated image URLs alongside their prompts.
-- Each entry maps to an image_prompt by index and stores the resulting URL + metadata.

ALTER TABLE site_pages ADD COLUMN generated_images JSONB;
ALTER TABLE services ADD COLUMN generated_images JSONB;
