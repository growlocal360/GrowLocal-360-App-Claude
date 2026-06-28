-- v5 Priority City override — let an owner force a dedicated page for a city the
-- automated plan wouldn't otherwise build (e.g. a new business already winning
-- work in a smaller, low-competition city with no GSC data yet).
-- A "priority" city is guaranteed a Pattern 1 page (or a city hub if also
-- anchored), bypassing proximity coverage and the per-strategy Pattern 1 cap.
-- Defaults to false so existing rows are unchanged.

ALTER TABLE service_areas
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;
