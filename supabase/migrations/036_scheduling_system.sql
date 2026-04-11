-- Migration: Smart Scheduling + Availability Publishing Engine
-- Staff-level scheduling with booking widget, notifications, and auto-posting availability to GBP

-- ============================================================
-- 1. scheduling_configs: One per site, stores booking preferences
-- ============================================================
CREATE TABLE scheduling_configs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                   UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scheduling_mode           TEXT NOT NULL DEFAULT 'time_windows'
                            CHECK (scheduling_mode IN ('time_windows', 'time_slots')),
  booking_mode              TEXT NOT NULL DEFAULT 'approval'
                            CHECK (booking_mode IN ('instant', 'approval')),
  cta_style                 TEXT NOT NULL DEFAULT 'booking'
                            CHECK (cta_style IN ('booking', 'estimate')),
  timezone                  TEXT NOT NULL DEFAULT 'America/New_York',
  advance_booking_days      INTEGER NOT NULL DEFAULT 14,
  booking_buffer_minutes    INTEGER NOT NULL DEFAULT 30,
  show_availability_badge   BOOLEAN NOT NULL DEFAULT true,
  auto_publish_availability BOOLEAN NOT NULL DEFAULT false,
  publish_times             JSONB DEFAULT '["07:30","11:00","14:00"]'::jsonb,
  publish_days              JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  notification_phone        TEXT,
  notification_email        TEXT,
  confirmation_message      TEXT,
  twilio_phone_number       TEXT,     -- Dedicated Twilio number for this site (e.g. +15551234567)
  twilio_phone_sid          TEXT,     -- Twilio Phone Number SID (for management/release)
  is_active                 BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id)
);

CREATE INDEX idx_scheduling_configs_site ON scheduling_configs(site_id);

-- ============================================================
-- 2. staff_schedules: Per-staff availability windows/slots per day-of-week
-- ============================================================
CREATE TABLE staff_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id       UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  scheduling_config_id  UUID NOT NULL REFERENCES scheduling_configs(id) ON DELETE CASCADE,
  day_of_week           INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  capacity              INTEGER NOT NULL DEFAULT 1,
  slot_times            JSONB,  -- for time_slots mode: ["08:00","09:00","10:00"]
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_member_id, day_of_week, start_time)
);

CREATE INDEX idx_staff_schedules_staff ON staff_schedules(staff_member_id);
CREATE INDEX idx_staff_schedules_config ON staff_schedules(scheduling_config_id);

-- ============================================================
-- 3. staff_time_blocks: Personal blocks (doctor appts, PTO, etc.)
-- ============================================================
CREATE TABLE staff_time_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id   UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  block_date        DATE NOT NULL,
  start_time        TIME,       -- null = all day block
  end_time          TIME,       -- null = all day block
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_time_blocks_staff ON staff_time_blocks(staff_member_id);
CREATE INDEX idx_staff_time_blocks_date ON staff_time_blocks(block_date);
CREATE INDEX idx_staff_time_blocks_staff_date ON staff_time_blocks(staff_member_id, block_date);

-- ============================================================
-- 4. staff_service_areas: Which cities/zips each staff member covers
-- ============================================================
CREATE TABLE staff_service_areas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id   UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  city              TEXT,
  zip_code          TEXT,
  service_area_id   UUID REFERENCES service_areas(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_service_areas_has_location
    CHECK (city IS NOT NULL OR zip_code IS NOT NULL OR service_area_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_staff_service_areas_unique
  ON staff_service_areas(staff_member_id, site_id, COALESCE(city, ''), COALESCE(zip_code, ''));
CREATE INDEX idx_staff_service_areas_staff ON staff_service_areas(staff_member_id);
CREATE INDEX idx_staff_service_areas_site ON staff_service_areas(site_id);

-- ============================================================
-- 5. appointments: Core booking table (online + manual + phone)
-- ============================================================
CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  staff_member_id     UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT,
  customer_phone      TEXT,
  customer_city       TEXT,
  customer_zip        TEXT,
  service_type        TEXT,
  notes               TEXT,
  scheduled_date      DATE NOT NULL,
  scheduled_time      TIME,             -- exact time (time_slots mode)
  time_window_start   TIME,             -- window start (time_windows mode)
  time_window_end     TIME,             -- window end (time_windows mode)
  source              TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('online_booking', 'manual', 'phone')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_24h_sent   BOOLEAN NOT NULL DEFAULT false,
  reminder_dayof_sent BOOLEAN NOT NULL DEFAULT false,
  confirmation_sent   BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_site ON appointments(site_id);
CREATE INDEX idx_appointments_site_date ON appointments(site_id, scheduled_date);
CREATE INDEX idx_appointments_staff_date ON appointments(staff_member_id, scheduled_date);
CREATE INDEX idx_appointments_date_status ON appointments(scheduled_date, status);
CREATE INDEX idx_appointments_lead ON appointments(lead_id);

-- ============================================================
-- 6. date_overrides: Site-wide blocked dates (holidays, closures)
-- ============================================================
CREATE TABLE date_overrides (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_config_id  UUID NOT NULL REFERENCES scheduling_configs(id) ON DELETE CASCADE,
  override_date         DATE NOT NULL,
  is_blocked            BOOLEAN NOT NULL DEFAULT false,
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scheduling_config_id, override_date)
);

CREATE INDEX idx_date_overrides_config ON date_overrides(scheduling_config_id);
CREATE INDEX idx_date_overrides_date ON date_overrides(override_date);

-- ============================================================
-- 7. availability_posts: Log of auto-published availability content
-- ============================================================
CREATE TABLE availability_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('google_business', 'facebook')),
  post_content      TEXT NOT NULL,
  spots_available   INTEGER NOT NULL,
  posted_date       DATE NOT NULL,
  external_post_id  TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'published', 'failed')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_posts_site ON availability_posts(site_id);
CREATE INDEX idx_availability_posts_site_date ON availability_posts(site_id, posted_date);

-- ============================================================
-- Add schedule_token to staff_members for self-service calendar links
-- ============================================================
ALTER TABLE staff_members
  ADD COLUMN IF NOT EXISTS schedule_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_members_schedule_token
  ON staff_members(schedule_token);

-- ============================================================
-- RLS Policies
-- ============================================================

-- scheduling_configs: site owners can read/update
ALTER TABLE scheduling_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduling config for their sites" ON scheduling_configs
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage scheduling config for their sites" ON scheduling_configs
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- staff_schedules: admin client (same as staff_members)
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

-- staff_time_blocks: admin client
ALTER TABLE staff_time_blocks ENABLE ROW LEVEL SECURITY;

-- staff_service_areas: admin client
ALTER TABLE staff_service_areas ENABLE ROW LEVEL SECURITY;

-- appointments: site owners can CRUD, public can insert (online booking)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointments for their sites" ON appointments
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage appointments for their sites" ON appointments
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can create an online booking" ON appointments
  FOR INSERT WITH CHECK (
    source = 'online_booking'
    AND site_id IN (SELECT id FROM sites WHERE is_active = true)
  );

-- date_overrides: admin client
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;

-- availability_posts: admin client (read-only from dashboard via admin client)
ALTER TABLE availability_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Triggers for updated_at
-- ============================================================
CREATE TRIGGER update_scheduling_configs_updated_at
  BEFORE UPDATE ON scheduling_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
