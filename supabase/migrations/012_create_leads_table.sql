-- Migration: Create leads table for lead capture system
-- Stores form submissions from public site lead capture forms

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,

  -- Contact info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Lead details
  service_type TEXT,        -- Service they're interested in
  message TEXT,             -- Project description / additional notes
  source_page TEXT,         -- URL path where form was submitted

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new',  -- new, contacted, converted, archived

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_site_id ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Site owners can read their own leads
CREATE POLICY "Users can view leads for their sites" ON leads
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Site owners can update lead status
CREATE POLICY "Users can update leads for their sites" ON leads
  FOR UPDATE USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Public insert policy (anyone can submit a lead via the form)
CREATE POLICY "Anyone can submit a lead" ON leads
  FOR INSERT WITH CHECK (
    site_id IN (SELECT id FROM sites WHERE is_active = true)
  );

-- Trigger for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
