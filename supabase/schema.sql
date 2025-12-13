-- GrowLocal 360 Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE website_type AS ENUM ('single_location', 'multi_location', 'microsite');
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE job_status AS ENUM ('draft', 'queued', 'approved', 'deployed', 'rejected');
CREATE TYPE social_platform AS ENUM ('google_business', 'facebook', 'instagram', 'youtube');

-- ============================================
-- ORGANIZATIONS (Multi-tenant root)
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFILES (Users with org membership)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role user_role DEFAULT 'user' NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- ============================================
-- GBP CATEGORIES (Reference table)
-- ============================================

CREATE TABLE gbp_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gcid VARCHAR(255) UNIQUE NOT NULL, -- Google Category ID
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  parent_gcid VARCHAR(255),
  service_types JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SITES (Websites/Profiles)
-- ============================================

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  website_type website_type NOT NULL,
  domain VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- ============================================
-- SITE CATEGORIES (Primary & Secondary GBP categories per site)
-- ============================================

CREATE TABLE site_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  gbp_category_id UUID REFERENCES gbp_categories(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, gbp_category_id)
);

-- ============================================
-- LOCATIONS
-- ============================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'US',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  -- GBP Connection
  gbp_place_id VARCHAR(255),
  gbp_account_id VARCHAR(255),
  gbp_location_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

-- ============================================
-- SERVICES
-- ============================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  site_category_id UUID REFERENCES site_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

-- ============================================
-- JOB SNAPS
-- ============================================

CREATE TABLE job_snaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  status job_status DEFAULT 'draft',
  -- Content
  title VARCHAR(255),
  description TEXT,
  ai_generated_title VARCHAR(255),
  ai_generated_description TEXT,
  -- Approval workflow
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOB SNAP MEDIA
-- ============================================

CREATE TABLE job_snap_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_snap_id UUID REFERENCES job_snaps(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  ai_generated_name VARCHAR(255),
  alt_text TEXT,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  exif_data JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL CONNECTIONS
-- ============================================

CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  platform social_platform NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, platform, account_id)
);

-- ============================================
-- DEPLOYMENT LOG (Track what was deployed where)
-- ============================================

CREATE TABLE deployment_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_snap_id UUID REFERENCES job_snaps(id) ON DELETE CASCADE NOT NULL,
  social_connection_id UUID REFERENCES social_connections(id) ON DELETE SET NULL,
  platform social_platform NOT NULL,
  external_post_id VARCHAR(255),
  post_url TEXT,
  deployed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_sites_organization_id ON sites(organization_id);
CREATE INDEX idx_locations_site_id ON locations(site_id);
CREATE INDEX idx_services_site_id ON services(site_id);
CREATE INDEX idx_job_snaps_site_id ON job_snaps(site_id);
CREATE INDEX idx_job_snaps_status ON job_snaps(status);
CREATE INDEX idx_job_snaps_location_id ON job_snaps(location_id);
CREATE INDEX idx_job_snap_media_job_snap_id ON job_snap_media(job_snap_id);
CREATE INDEX idx_gbp_categories_gcid ON gbp_categories(gcid);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_snaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_snap_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_log ENABLE ROW LEVEL SECURITY;

-- GBP Categories are public read
ALTER TABLE gbp_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GBP categories are viewable by everyone" ON gbp_categories FOR SELECT USING (true);

-- Organizations: Users can only see orgs they belong to
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

-- Profiles: Users can view profiles in their organization
CREATE POLICY "Users can view profiles in their org" ON profiles
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Sites: Users can view/manage sites in their organization
CREATE POLICY "Users can view sites in their org" ON sites
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert sites" ON sites
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update sites" ON sites
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Site Categories: Follow site access
CREATE POLICY "Users can view site categories" ON site_categories
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage site categories" ON site_categories
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Locations: Follow site access
CREATE POLICY "Users can view locations" ON locations
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage locations" ON locations
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Services: Follow site access
CREATE POLICY "Users can view services" ON services
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage services" ON services
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Job Snaps: Users can create, admins can approve/deploy
CREATE POLICY "Users can view job snaps in their org" ON job_snaps
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create job snaps" ON job_snaps
  FOR INSERT WITH CHECK (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own draft job snaps" ON job_snaps
  FOR UPDATE USING (
    (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND status = 'draft')
    OR
    (site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    ))
  );

-- Job Snap Media: Follow job snap access
CREATE POLICY "Users can view job snap media" ON job_snap_media
  FOR SELECT USING (
    job_snap_id IN (
      SELECT id FROM job_snaps WHERE site_id IN (
        SELECT id FROM sites WHERE organization_id IN (
          SELECT organization_id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can add media to their job snaps" ON job_snap_media
  FOR INSERT WITH CHECK (
    job_snap_id IN (
      SELECT id FROM job_snaps
      WHERE created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND status = 'draft'
    )
  );

-- Social Connections: Admins only
CREATE POLICY "Admins can view social connections" ON social_connections
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admins can manage social connections" ON social_connections
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Deployment Log: Admins can view
CREATE POLICY "Admins can view deployment log" ON deployment_log
  FOR SELECT USING (
    job_snap_id IN (
      SELECT id FROM job_snaps WHERE site_id IN (
        SELECT id FROM sites WHERE organization_id IN (
          SELECT organization_id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_snaps_updated_at BEFORE UPDATE ON job_snaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_connections_updated_at BEFORE UPDATE ON social_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create org and profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a new organization for the user
  INSERT INTO organizations (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || substr(md5(random()::text), 1, 6)
  )
  RETURNING id INTO new_org_id;

  -- Create profile for the user as admin of their org
  INSERT INTO profiles (user_id, organization_id, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    new_org_id,
    'admin',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage bucket for job media (run this separately in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('job-media', 'job-media', true);

-- Storage policies (run after creating bucket)
-- CREATE POLICY "Users can upload job media" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'job-media' AND
--     auth.uid() IS NOT NULL
--   );

-- CREATE POLICY "Anyone can view job media" ON storage.objects
--   FOR SELECT USING (bucket_id = 'job-media');
