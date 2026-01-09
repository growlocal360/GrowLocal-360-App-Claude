-- Migration: Add site status and build progress tracking
-- Phase 6: Site Status System & Background Processing

-- Add status field to sites (defaults to 'active' for existing sites)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Add build progress tracking (JSONB for flexibility)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS build_progress JSONB DEFAULT NULL;

-- Add status message for errors/notes
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status_message TEXT DEFAULT NULL;

-- Add timestamp for status changes
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraint for valid statuses
-- Note: Using DO block to handle case where constraint might already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_status_check'
  ) THEN
    ALTER TABLE sites ADD CONSTRAINT sites_status_check
      CHECK (status IN ('building', 'active', 'paused', 'failed', 'suspended'));
  END IF;
END $$;

-- Index for status queries (useful for admin dashboards, filtering)
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);

-- Update existing sites to have 'active' status if not set
UPDATE sites SET status = 'active' WHERE status IS NULL;

-- Comment explaining build_progress structure
COMMENT ON COLUMN sites.build_progress IS 'JSON structure: { "total_tasks": number, "completed_tasks": number, "current_task": string, "started_at": ISO timestamp }';

-- Comment explaining status values
COMMENT ON COLUMN sites.status IS 'Site status: building (content being generated), active (live), paused (user paused), failed (build error), suspended (admin action)';
