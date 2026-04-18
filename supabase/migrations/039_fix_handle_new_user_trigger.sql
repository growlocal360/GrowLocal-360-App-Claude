-- Fix: Make handle_new_user() trigger more robust
-- 1. Use RETURNING clause to capture profile_id instead of fragile nested SELECT
-- 2. Add exception handling so trigger never blocks user creation
-- 3. If site_assignments fail, the user still gets created with their profile

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  new_profile_id UUID;
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
        -- Log but don't fail — site assignments can be fixed later via accept API
        RAISE WARNING 'handle_new_user: failed to create site assignments for user %, error: %', NEW.id, SQLERRM;
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
