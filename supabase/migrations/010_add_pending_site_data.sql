-- Migration: Add pending_site_data table for storing site data during checkout
-- This table temporarily stores site configuration between checkout initiation and webhook completion

-- Create the pending_site_data table
CREATE TABLE IF NOT EXISTS pending_site_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_site_data_user_id ON pending_site_data(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_site_data_expires_at ON pending_site_data(expires_at);

-- RLS policies
ALTER TABLE pending_site_data ENABLE ROW LEVEL SECURITY;

-- Users can insert their own pending site data
CREATE POLICY "Users can insert own pending site data"
  ON pending_site_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own pending site data
CREATE POLICY "Users can read own pending site data"
  ON pending_site_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role to read/delete any pending site data (for webhook processing)
CREATE POLICY "Service role can manage all pending site data"
  ON pending_site_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired pending site data (can be run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_site_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pending_site_data WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
