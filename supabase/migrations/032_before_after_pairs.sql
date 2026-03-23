-- Before & After support for Job Snaps.
-- pair_group groups before/after images into pairs (1 = first pair, 2 = second, etc.)
-- is_before_after flags the job snap as a before/after type.

ALTER TABLE job_snap_media ADD COLUMN pair_group INTEGER;
ALTER TABLE job_snaps ADD COLUMN is_before_after BOOLEAN NOT NULL DEFAULT false;
