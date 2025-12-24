-- Migration: Add neighborhoods table
-- Neighborhoods are hyper-local areas WITHIN a GBP location's city
-- They feed geographic relevance to the parent location page (GBP landing)

-- ============================================
-- NEIGHBORHOODS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  place_id VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  population INTEGER,
  description TEXT,
  -- SEO fields
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  -- Tracking
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, location_id, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_neighborhoods_site_id ON neighborhoods(site_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_location_id ON neighborhoods(location_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_slug ON neighborhoods(slug);

-- Enable RLS
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for neighborhoods
CREATE POLICY "Users can view neighborhoods in their org" ON neighborhoods
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage neighborhoods" ON neighborhoods
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Public read access for neighborhoods (needed for public site rendering)
CREATE POLICY "Public can view active site neighborhoods" ON neighborhoods
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
    AND is_active = true
  );

-- Trigger for updated_at
CREATE TRIGGER update_neighborhoods_updated_at BEFORE UPDATE ON neighborhoods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
