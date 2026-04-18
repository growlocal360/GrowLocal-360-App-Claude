-- Link authenticated "user" role profiles (technicians) to staff_members
-- so they can have schedules, be assigned appointments, and appear in the calendar.
--
-- 1. Add profile_id column to staff_members
-- 2. Update handle_new_user() trigger to auto-create staff_member for 'user' role
-- 3. Backfill existing 'user' profiles that lack a staff_member

-- Step 1: Add profile_id to staff_members
ALTER TABLE staff_members
  ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Partial unique index: one staff_member per profile, but NULLs are fine (unlinked staff)
CREATE UNIQUE INDEX idx_staff_members_profile_id
  ON staff_members(profile_id) WHERE profile_id IS NOT NULL;

-- Step 2: Updated handle_new_user() trigger with staff_member auto-creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  new_profile_id UUID;
  new_staff_member_id UUID;
  invite_record RECORD;
BEGIN
  -- Check if there's a pending invitation for this email (case-insensitive)
  SELECT * INTO invite_record
  FROM invitations
  WHERE LOWER(email) = LOWER(NEW.email)
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
    )
    RETURNING id INTO new_profile_id;

    -- Create site assignments from invitation (defensive: skip if profile_id is somehow null)
    IF new_profile_id IS NOT NULL AND array_length(invite_record.site_ids, 1) > 0 THEN
      BEGIN
        INSERT INTO profile_site_assignments (profile_id, site_id)
        SELECT new_profile_id, unnest(invite_record.site_ids);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: failed to create site assignments for user %, error: %', NEW.id, SQLERRM;
      END;
    END IF;

    -- For 'user' role (technicians): auto-create a linked staff_member so they can be scheduled
    IF invite_record.role = 'user' AND new_profile_id IS NOT NULL THEN
      BEGIN
        INSERT INTO staff_members (organization_id, full_name, email, profile_id, show_on_site, is_active)
        VALUES (
          invite_record.organization_id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          NEW.email,
          new_profile_id,
          false,
          true
        )
        RETURNING id INTO new_staff_member_id;

        -- Mirror site assignments to staff_site_assignments
        IF new_staff_member_id IS NOT NULL AND array_length(invite_record.site_ids, 1) > 0 THEN
          INSERT INTO staff_site_assignments (staff_member_id, site_id)
          SELECT new_staff_member_id, unnest(invite_record.site_ids);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: failed to create staff_member for user %, error: %', NEW.id, SQLERRM;
      END;
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
EXCEPTION WHEN OTHERS THEN
  -- Never block user creation — log the error and continue
  RAISE WARNING 'handle_new_user: trigger failed for user %, error: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Step 3: Backfill existing 'user' role profiles that don't have a linked staff_member
INSERT INTO staff_members (organization_id, full_name, email, profile_id, show_on_site, is_active)
SELECT
  p.organization_id,
  COALESCE(p.full_name, split_part(u.email, '@', 1)),
  u.email,
  p.id,
  false,
  true
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.role = 'user'
  AND NOT EXISTS (SELECT 1 FROM staff_members sm WHERE sm.profile_id = p.id);

-- Backfill staff_site_assignments from existing profile_site_assignments
INSERT INTO staff_site_assignments (staff_member_id, site_id)
SELECT sm.id, psa.site_id
FROM staff_members sm
JOIN profile_site_assignments psa ON psa.profile_id = sm.profile_id
WHERE sm.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff_site_assignments ssa
    WHERE ssa.staff_member_id = sm.id AND ssa.site_id = psa.site_id
  );
