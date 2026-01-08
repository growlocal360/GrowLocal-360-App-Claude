-- Migration: Add domain management fields to sites table
-- Phase 5: Subdomain & Custom Domain Support

-- Add custom domain fields to sites table
-- Note: The 'domain' column may already exist from schema.sql, so we use IF NOT EXISTS
ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS vercel_domain_config JSONB DEFAULT NULL;

-- Create indexes for efficient domain lookups
-- These are critical for middleware performance
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain ON sites(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
CREATE INDEX IF NOT EXISTS idx_sites_slug_active ON sites(slug) WHERE is_active = TRUE;

-- Comment for documentation
COMMENT ON COLUMN sites.custom_domain IS 'User-provided custom domain (e.g., bobshvac.com)';
COMMENT ON COLUMN sites.custom_domain_verified IS 'Whether DNS has been verified for the custom domain';
COMMENT ON COLUMN sites.vercel_domain_config IS 'Vercel API response data for domain configuration';
