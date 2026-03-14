-- Migration: Asset management system + profile bio/title fields
-- Creates assets table, site-assets storage bucket, and adds bio/title to profiles

-- 1. Add bio and title columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- 2. Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('brand_asset', 'site_asset', 'job_snap_asset')),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, public_path)
);

-- Index for fast lookups by site + public path
CREATE INDEX IF NOT EXISTS idx_assets_site_public_path ON assets(site_id, public_path);
CREATE INDEX IF NOT EXISTS idx_assets_site_type ON assets(site_id, asset_type);

-- RLS for assets table
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read assets for sites in their org
CREATE POLICY "Users can read assets for their org sites"
ON assets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = assets.site_id
    AND p.user_id = auth.uid()
  )
);

-- Authenticated users can insert assets for sites in their org
CREATE POLICY "Users can insert assets for their org sites"
ON assets FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = assets.site_id
    AND p.user_id = auth.uid()
  )
);

-- Authenticated users can delete assets for sites in their org
CREATE POLICY "Users can delete assets for their org sites"
ON assets FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = assets.site_id
    AND p.user_id = auth.uid()
  )
);

-- 3. Create site-assets storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  10485760,  -- 10MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies for site-assets bucket

-- Allow authenticated users to upload to their site folders
CREATE POLICY "Authenticated users can upload site assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[1]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow authenticated users to update assets in their site folders
CREATE POLICY "Authenticated users can update site assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[1]::uuid
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[1]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete assets from their site folders
CREATE POLICY "Authenticated users can delete site assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[1]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow anyone to read site assets (public bucket)
CREATE POLICY "Anyone can read site assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'site-assets');
