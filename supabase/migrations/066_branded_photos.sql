-- Cache of branded (logo + title overlay) variants of photos sent to Google.
-- Keyed by the original public URL; signature covers everything that changes
-- the look so a changed logo or setting re-renders.
CREATE TABLE IF NOT EXISTS branded_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  signature text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, source_url)
);
ALTER TABLE branded_photos ENABLE ROW LEVEL SECURITY;
-- Server-only (service role); no member policies needed.
