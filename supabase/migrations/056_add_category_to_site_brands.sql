-- Associate a brand with a niche (a site_categories row) so dual-niche sites
-- (e.g. HVAC + appliance repair) can segment brands correctly.
--   site_category_id set  → brand belongs to that one niche (Carrier → HVAC)
--   site_category_id NULL → applies to all niches ("Both", e.g. GE/LG/Samsung)
-- Existing rows stay NULL, preserving current (show-all-services) behavior.
ALTER TABLE site_brands
  ADD COLUMN IF NOT EXISTS site_category_id UUID REFERENCES site_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_brands_category ON site_brands(site_category_id);
