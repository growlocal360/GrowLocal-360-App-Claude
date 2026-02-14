CREATE TABLE site_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

CREATE INDEX idx_site_brands_site ON site_brands(site_id);
ALTER TABLE site_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active brands" ON site_brands
  FOR SELECT USING (is_active = true AND site_id IN (SELECT id FROM sites WHERE is_active = true));

CREATE POLICY "Org members can manage brands" ON site_brands
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE TRIGGER update_site_brands_updated_at BEFORE UPDATE ON site_brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
