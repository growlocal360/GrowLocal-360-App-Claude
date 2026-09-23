-- Brands work like service areas: every brand is LISTED on /brands, but only
-- the ones the owner flags get a generated detail page (/brands/{slug}).
-- Most brands get little search volume; a thin brand page is worse than none.
-- Backfill: brands that already have generated content keep their page.

ALTER TABLE site_brands
  ADD COLUMN IF NOT EXISTS has_detail_page boolean NOT NULL DEFAULT false;

UPDATE site_brands SET has_detail_page = true WHERE h1 IS NOT NULL;
