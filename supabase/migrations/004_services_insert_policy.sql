-- Migration: Add INSERT policy for services table
-- This allows admins to create services for their sites

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can insert services" ON services;

-- Create INSERT policy for services
-- Only admins can create services for sites they manage
CREATE POLICY "Admins can insert services" ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Also ensure UPDATE and DELETE policies exist for admins
DROP POLICY IF EXISTS "Admins can update services" ON services;
CREATE POLICY "Admins can update services" ON services
  FOR UPDATE
  TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete services" ON services;
CREATE POLICY "Admins can delete services" ON services
  FOR DELETE
  TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Ensure SELECT policy exists for all users in org
DROP POLICY IF EXISTS "Users can view services" ON services;
CREATE POLICY "Users can view services" ON services
  FOR SELECT
  TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      JOIN profiles p ON p.organization_id = s.organization_id
      WHERE p.user_id = auth.uid()
    )
  );
