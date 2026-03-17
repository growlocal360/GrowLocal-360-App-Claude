-- Migration 029: Create job_snaps and job_snap_media tables
-- Job Snaps are admin-managed records of completed work with photos, location, and AI-generated content.
-- Addresses are stored inline (not as FK to business locations), mirroring the work_items pattern.

-- ─── job_snaps ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_snaps (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id                 UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  service_id              UUID REFERENCES services(id) ON DELETE SET NULL,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Content (user title/description override AI values)
  title                   TEXT,
  description             TEXT,
  ai_generated_title      TEXT,
  ai_generated_description TEXT,

  -- AI-detected metadata
  service_type            TEXT,
  brand                   TEXT,

  -- Status workflow
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'queued', 'approved', 'deployed', 'rejected')),

  -- Location (inline, address_full is internal only)
  location_source         TEXT CHECK (location_source IN ('exif', 'device', 'manual')),
  address_full            TEXT,          -- Full address incl. house number — NEVER expose publicly
  address_public          TEXT,          -- House-number-stripped variant for public display
  city                    TEXT,
  state                   TEXT,
  zip                     TEXT,
  latitude                DECIMAL(10, 8),
  longitude               DECIMAL(11, 8),

  -- Publishing flags
  is_published_to_website BOOLEAN NOT NULL DEFAULT false,
  is_published_to_gbp     BOOLEAN NOT NULL DEFAULT false,

  -- Approval tracking
  approved_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  deployed_at             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_job_snaps_updated_at ON job_snaps;
CREATE TRIGGER update_job_snaps_updated_at
  BEFORE UPDATE ON job_snaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── job_snap_media ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_snap_media (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_snap_id         UUID NOT NULL REFERENCES job_snaps(id) ON DELETE CASCADE,

  storage_path        TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  ai_generated_name   TEXT,
  alt_text            TEXT,
  mime_type           TEXT NOT NULL,
  file_size           INTEGER NOT NULL,
  width               INTEGER,
  height              INTEGER,
  exif_data           JSONB,

  role                TEXT CHECK (role IN ('primary', 'before', 'after', 'process', 'detail')),
  sort_order          INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for media lookups
CREATE INDEX IF NOT EXISTS idx_job_snap_media_job_snap_id ON job_snap_media(job_snap_id);
CREATE INDEX IF NOT EXISTS idx_job_snaps_site_id ON job_snaps(site_id);
CREATE INDEX IF NOT EXISTS idx_job_snaps_status ON job_snaps(status);

-- ─── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-snap-media',
  'job-snap-media',
  true,
  20971520,  -- 20MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE job_snaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_snap_media ENABLE ROW LEVEL SECURITY;

-- Org members can manage job_snaps for their sites
CREATE POLICY "Org members can manage job snaps"
  ON job_snaps FOR ALL
  USING (
    site_id IN (
      SELECT id FROM sites
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Org members can manage media via job_snap ownership
CREATE POLICY "Org members can manage job snap media"
  ON job_snap_media FOR ALL
  USING (
    job_snap_id IN (
      SELECT id FROM job_snaps
      WHERE site_id IN (
        SELECT id FROM sites
        WHERE organization_id IN (
          SELECT organization_id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Storage: authenticated users can upload
CREATE POLICY "Authenticated users can upload job snap media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-snap-media' AND auth.role() = 'authenticated');

-- Storage: public can read (for public website display)
CREATE POLICY "Public can view job snap media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-snap-media');

-- Storage: org members can delete their own media
CREATE POLICY "Authenticated users can delete job snap media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'job-snap-media' AND auth.role() = 'authenticated');
