-- 025: One-time cleanup of orphaned empty organizations.
-- Deletes orgs that have no sites and only 1 profile (the auto-created owner),
-- where that user also belongs to another org (i.e., they were invited elsewhere).
-- The profile is deleted first (FK constraint), then the org.

DO $$
DECLARE
  orphan RECORD;
BEGIN
  FOR orphan IN
    SELECT o.id AS org_id, p.id AS profile_id
    FROM organizations o
    JOIN profiles p ON p.organization_id = o.id
    LEFT JOIN sites s ON s.organization_id = o.id
    WHERE s.id IS NULL  -- no sites in this org
    GROUP BY o.id, p.id
    HAVING COUNT(DISTINCT p.id) = 1  -- only one profile in this org
    AND (
      SELECT COUNT(*) FROM profiles p2
      WHERE p2.user_id = p.user_id
    ) > 1  -- user has profiles in other orgs
  LOOP
    DELETE FROM profiles WHERE id = orphan.profile_id;
    DELETE FROM organizations WHERE id = orphan.org_id;
  END LOOP;
END $$;
