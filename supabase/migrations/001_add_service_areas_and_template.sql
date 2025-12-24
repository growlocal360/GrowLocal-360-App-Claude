-- Migration: Add service_areas table and template_id to sites
-- Run this in your Supabase SQL Editor

-- ============================================
-- ADD TEMPLATE_ID TO SITES
-- ============================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS template_id VARCHAR(50) DEFAULT 'local-service-pro';

-- ============================================
-- SERVICE AREAS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  state VARCHAR(100),
  place_id VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_miles DECIMAL(5, 1),
  is_custom BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_service_areas_site_id ON service_areas(site_id);

-- Enable RLS
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_areas
CREATE POLICY "Users can view service areas in their org" ON service_areas
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage service areas" ON service_areas
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Public read access for service areas (needed for public site rendering)
CREATE POLICY "Public can view active site service areas" ON service_areas
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
  );

-- ============================================
-- PUBLIC READ POLICIES FOR SITE RENDERING
-- ============================================

-- Sites: Public can view active sites
CREATE POLICY "Public can view active sites" ON sites
  FOR SELECT USING (is_active = true);

-- Locations: Public can view locations for active sites
CREATE POLICY "Public can view locations for active sites" ON locations
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
  );

-- Site Categories: Public can view categories for active sites
CREATE POLICY "Public can view categories for active sites" ON site_categories
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
  );

-- Services: Public can view services for active sites
CREATE POLICY "Public can view services for active sites" ON services
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
    AND is_active = true
  );

-- Trigger for updated_at
CREATE TRIGGER update_service_areas_updated_at BEFORE UPDATE ON service_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
