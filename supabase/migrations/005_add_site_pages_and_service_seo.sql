-- Migration: Add site_pages table and SEO fields to services
-- site_pages stores generated content for core pages (home, about, contact, category pages)
-- services get SEO fields for individual service pages

-- ============================================
-- ADD SEO FIELDS TO SERVICES TABLE
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS h1 TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS body_copy TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS faqs JSONB;

-- ============================================
-- SITE_PAGES TABLE
-- ============================================
-- Stores generated SEO content for core pages (home, about, contact, category pages)

CREATE TABLE IF NOT EXISTS site_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES site_categories(id) ON DELETE CASCADE,

  page_type TEXT NOT NULL,  -- 'home', 'about', 'contact', 'category', 'service_area'
  slug TEXT NOT NULL,

  -- SEO Content
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  h2 TEXT,
  body_copy TEXT,
  faqs JSONB,  -- [{question: string, answer: string}, ...]

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(site_id, page_type, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_site_pages_site_id ON site_pages(site_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_page_type ON site_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_site_pages_slug ON site_pages(slug);

-- Enable RLS
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for site_pages
CREATE POLICY "Users can view site_pages in their org" ON site_pages
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage site_pages" ON site_pages
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Public read access for site_pages (needed for public site rendering)
CREATE POLICY "Public can view active site pages" ON site_pages
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
    AND is_active = true
  );

-- Trigger for updated_at
CREATE TRIGGER update_site_pages_updated_at BEFORE UPDATE ON site_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
