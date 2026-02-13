-- Create work_items table for public "Work" showcase pages
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  slug TEXT NOT NULL,
  performed_at TIMESTAMPTZ,
  title TEXT NOT NULL,
  h1 TEXT,
  meta_title TEXT,
  meta_description TEXT,
  summary TEXT,
  description TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  brand_name TEXT,
  brand_slug TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  address_street_name TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

CREATE INDEX idx_work_items_site_status ON work_items(site_id, status);
CREATE INDEX idx_work_items_performed_at ON work_items(site_id, performed_at DESC);

ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

-- Public can view published work items
CREATE POLICY "Public can view published work items" ON work_items
  FOR SELECT USING (status = 'published');

-- Org members can manage work items
CREATE POLICY "Org members can manage work items" ON work_items
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE TRIGGER update_work_items_updated_at BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
