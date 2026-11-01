-- Photo drip: remember which Job Snap photos were added to the GBP gallery so
-- each is uploaded once.
ALTER TABLE job_snap_media
  ADD COLUMN IF NOT EXISTS gbp_media_name text,
  ADD COLUMN IF NOT EXISTS gbp_uploaded_at timestamptz;
