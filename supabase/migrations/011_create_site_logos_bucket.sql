-- Migration: Create site-logos storage bucket for logo uploads
-- This bucket stores site logos with public access

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-logos',
  'site-logos',
  true,  -- Public bucket so logos can be displayed on sites
  5242880,  -- 5MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for site-logos bucket

-- Allow authenticated users to upload logos to their site folders
CREATE POLICY "Authenticated users can upload site logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-logos' AND
  -- Path must start with 'sites/{siteId}/'
  (storage.foldername(name))[1] = 'sites' AND
  -- User must have access to the site
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[2]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow authenticated users to update logos in their site folders
CREATE POLICY "Authenticated users can update site logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-logos' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[2]::uuid
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'site-logos' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[2]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete logos from their site folders
CREATE POLICY "Authenticated users can delete site logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-logos' AND
  EXISTS (
    SELECT 1 FROM sites s
    JOIN profiles p ON p.organization_id = s.organization_id
    WHERE s.id = (storage.foldername(name))[2]::uuid
    AND p.user_id = auth.uid()
  )
);

-- Allow anyone to read site logos (public bucket)
CREATE POLICY "Anyone can read site logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'site-logos');
