-- Fix: Case-insensitive email matching in handle_new_user trigger
-- Previously, Google OAuth might return "Info@Example.com" while the
-- invitation stores "info@example.com", causing the match to fail.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
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
