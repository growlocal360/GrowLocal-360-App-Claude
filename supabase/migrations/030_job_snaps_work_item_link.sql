-- Migration 030: Link job_snaps to work_items for publish tracking
-- When a job snap is published to the website, a work_item record is created.
-- This FK lets us find and update/unpublish that record later.

ALTER TABLE job_snaps
  ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_snaps_work_item_id ON job_snaps(work_item_id);
