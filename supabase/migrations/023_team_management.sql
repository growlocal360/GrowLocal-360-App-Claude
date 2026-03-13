-- 023: Team Management - Roles, Invitations, Site Assignments
-- Adds owner role, invitations table, profile_site_assignments table,
-- updates trigger and RLS policies for three-tier permissions.

-- ============================================
-- 1. Add 'owner' to user_role enum
-- ============================================
ALTER TYPE user_role ADD VALUE 'owner' BEFORE 'admin';

-- Migrate existing admins to owners (account creators become owners)
-- NOTE: Run this AFTER the enum change has been committed.
-- In a separate transaction since ADD VALUE cannot be used in a transaction
-- with DML in some Postgres versions. If needed, run this as a separate step:
UPDATE profiles SET role = 'owner' WHERE role = 'admin';

-- ============================================
-- 2. Invitations table
-- ============================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  site_ids UUID[] DEFAULT '{}',
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending invite per email per org
CREATE UNIQUE INDEX idx_invitations_pending_email
  ON invitations(organization_id, email) WHERE accepted_at IS NULL;

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_org ON invitations(organization_id);

-- ============================================
-- 3. Profile site assignments (scoped access)
-- ============================================
CREATE TABLE profile_site_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, site_id)
);

CREATE INDEX idx_profile_site_assignments_profile ON profile_site_assignments(profile_id);
CREATE INDEX idx_profile_site_assignments_site ON profile_site_assignments(site_id);

-- ============================================
-- 4. RLS for new tables
-- ============================================
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_site_assignments ENABLE ROW LEVEL SECURITY;

-- Invitations: Owner/Admin can view and create
CREATE POLICY "Owner/Admin can view invitations" ON invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/Admin can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/Admin can delete invitations" ON invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/Admin can update invitations" ON invitations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Profile site assignments: Owner/Admin can manage, users can view their own
CREATE POLICY "Users can view their own site assignments" ON profile_site_assignments
  FOR SELECT USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    profile_id IN (
      SELECT id FROM profiles WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Owner/Admin can manage site assignments" ON profile_site_assignments
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================
-- 5. Update existing RLS policies to include 'owner'
-- ============================================

-- Sites: Insert
DROP POLICY IF EXISTS "Admins can insert sites" ON sites;
CREATE POLICY "Owner/Admin can insert sites" ON sites
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Sites: Update
DROP POLICY IF EXISTS "Admins can update sites" ON sites;
CREATE POLICY "Owner/Admin can update sites" ON sites
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Site Categories: Manage
DROP POLICY IF EXISTS "Admins can manage site categories" ON site_categories;
CREATE POLICY "Owner/Admin can manage site categories" ON site_categories
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Locations: Manage
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
CREATE POLICY "Owner/Admin can manage locations" ON locations
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Services: Manage
DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Owner/Admin can manage services" ON services
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Job Snaps: Update (own drafts OR admin/owner of org)
DROP POLICY IF EXISTS "Users can update their own draft job snaps" ON job_snaps;
CREATE POLICY "Users can update their own draft job snaps" ON job_snaps
  FOR UPDATE USING (
    (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND status = 'draft')
    OR
    (site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    ))
  );

-- Social Connections: View
DROP POLICY IF EXISTS "Admins can view social connections" ON social_connections;
CREATE POLICY "Owner/Admin can view social connections" ON social_connections
  FOR SELECT USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Social Connections: Manage
DROP POLICY IF EXISTS "Admins can manage social connections" ON social_connections;
CREATE POLICY "Owner/Admin can manage social connections" ON social_connections
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================
-- 6. Update handle_new_user() trigger
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  invite_record RECORD;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT * INTO invite_record
  FROM invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    -- Invited user: join existing org instead of creating new one
    INSERT INTO profiles (user_id, organization_id, role, full_name, avatar_url)
    VALUES (
      NEW.id,
      invite_record.organization_id,
      invite_record.role,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Create site assignments from invitation
    IF array_length(invite_record.site_ids, 1) > 0 THEN
      INSERT INTO profile_site_assignments (profile_id, site_id)
      SELECT
        (SELECT id FROM profiles WHERE user_id = NEW.id AND organization_id = invite_record.organization_id),
        unnest(invite_record.site_ids);
    END IF;

    -- Mark invitation as accepted
    UPDATE invitations SET accepted_at = NOW() WHERE id = invite_record.id;
  ELSE
    -- New user: create org + owner profile
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || substr(md5(random()::text), 1, 6)
    )
    RETURNING id INTO new_org_id;

    INSERT INTO profiles (user_id, organization_id, role, full_name, avatar_url)
    VALUES (
      NEW.id,
      new_org_id,
      'owner',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    );
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
