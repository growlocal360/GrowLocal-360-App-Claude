-- Image Strategy Engine: store structured image prompts generated during content pipeline.
-- Actual image generation (DALL-E / Nano Banana) is a future phase.

ALTER TABLE site_pages ADD COLUMN image_prompts JSONB;
ALTER TABLE services ADD COLUMN image_prompts JSONB;
