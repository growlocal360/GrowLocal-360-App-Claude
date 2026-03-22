-- Staff members: team members who appear on the public website
-- but do NOT have login access to the GrowLocal 360 dashboard.

CREATE TABLE staff_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  title           VARCHAR(255),
  email           VARCHAR(255),
  bio             TEXT,
  avatar_url      TEXT,
  show_on_site    BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_members_org ON staff_members(organization_id);

-- Site assignments for staff members (which sites they appear on)
CREATE TABLE staff_site_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE(staff_member_id, site_id)
);

CREATE INDEX idx_staff_site_assignments_staff ON staff_site_assignments(staff_member_id);
CREATE INDEX idx_staff_site_assignments_site ON staff_site_assignments(site_id);

-- RLS: Enable but rely on admin client (same pattern as profile_site_assignments)
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_site_assignments ENABLE ROW LEVEL SECURITY;
