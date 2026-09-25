-- Assignment-aware row-level security.
--
-- Until now every "org member" policy granted access to ALL sites in any
-- organization the user has a profile in. Per-profile site assignments
-- (profile_site_assignments) were enforced only in application code, so a
-- restricted admin in a shared org could read another site's jobs, leads,
-- appointments, etc. through any query the app forgot to filter (this is
-- how a client owner saw the agency's Job Snaps).
--
-- This migration moves the app's rule into the database:
--   owner                      -> every site in the org
--   admin with NO assignments  -> every site in the org
--   admin/user with assignments-> exactly the assigned sites
--   user with no assignments   -> nothing
-- and re-points the authenticated policies on each site-scoped table at it.
-- Public (anon) read policies for active sites are untouched. Server routes
-- use the service-role client and are unaffected; they already call
-- verifySiteAccess(), which implements the same rule.

-- ── Helpers ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the checks read profiles/assignments regardless of
-- those tables' own policies. STABLE so the planner caches per statement.

CREATE OR REPLACE FUNCTION public.user_can_access_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sites s
    JOIN profiles p
      ON p.organization_id = s.organization_id
     AND p.user_id = auth.uid()
    WHERE s.id = p_site_id
      AND (
        p.role = 'owner'
        OR EXISTS (
          SELECT 1 FROM profile_site_assignments a
          WHERE a.profile_id = p.id AND a.site_id = s.id
        )
        OR (
          p.role = 'admin'
          AND NOT EXISTS (
            SELECT 1 FROM profile_site_assignments a WHERE a.profile_id = p.id
          )
        )
      )
  );
$$;

-- Same rule, restricted to owner/admin (for write policies that already
-- required those roles).
CREATE OR REPLACE FUNCTION public.user_can_manage_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sites s
    JOIN profiles p
      ON p.organization_id = s.organization_id
     AND p.user_id = auth.uid()
    WHERE s.id = p_site_id
      AND p.role IN ('owner', 'admin')
      AND (
        p.role = 'owner'
        OR EXISTS (
          SELECT 1 FROM profile_site_assignments a
          WHERE a.profile_id = p.id AND a.site_id = s.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM profile_site_assignments a WHERE a.profile_id = p.id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_site(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_manage_site(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_site(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_manage_site(uuid) TO authenticated, anon, service_role;

-- ── sites ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view sites in their org" ON sites;
CREATE POLICY "Users can view sites in their org" ON sites
  FOR SELECT USING (public.user_can_access_site(id));

DROP POLICY IF EXISTS "Owner/Admin can update sites" ON sites;
CREATE POLICY "Owner/Admin can update sites" ON sites
  FOR UPDATE USING (public.user_can_manage_site(id));

-- ── job snaps + media ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can manage job snaps" ON job_snaps;
CREATE POLICY "Org members can manage job snaps" ON job_snaps
  FOR ALL
  USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

-- Own drafts, or owner/admin with access to the site.
DROP POLICY IF EXISTS "Users can update their own draft job snaps" ON job_snaps;
CREATE POLICY "Users can update their own draft job snaps" ON job_snaps
  FOR UPDATE USING (
    (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND status = 'draft')
    OR public.user_can_manage_site(site_id)
  );

DROP POLICY IF EXISTS "Org members can manage job snap media" ON job_snap_media;
CREATE POLICY "Org members can manage job snap media" ON job_snap_media
  FOR ALL
  USING (
    job_snap_id IN (SELECT id FROM job_snaps WHERE public.user_can_access_site(site_id))
  )
  WITH CHECK (
    job_snap_id IN (SELECT id FROM job_snaps WHERE public.user_can_access_site(site_id))
  );

-- ── work items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can manage work items" ON work_items;
CREATE POLICY "Org members can manage work items" ON work_items
  FOR ALL
  USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

-- ── leads ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view leads for their sites" ON leads;
CREATE POLICY "Users can view leads for their sites" ON leads
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can update leads for their sites" ON leads;
CREATE POLICY "Users can update leads for their sites" ON leads
  FOR UPDATE USING (public.user_can_access_site(site_id));

-- ── appointments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view appointments for their sites" ON appointments;
CREATE POLICY "Users can view appointments for their sites" ON appointments
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can manage appointments for their sites" ON appointments;
CREATE POLICY "Users can manage appointments for their sites" ON appointments
  FOR ALL
  USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

-- ── scheduling configs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view scheduling config for their sites" ON scheduling_configs;
CREATE POLICY "Users can view scheduling config for their sites" ON scheduling_configs
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can manage scheduling config for their sites" ON scheduling_configs;
CREATE POLICY "Users can manage scheduling config for their sites" ON scheduling_configs
  FOR ALL
  USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

-- ── site content (authenticated reads) ───────────────────────────────────
DROP POLICY IF EXISTS "Users can view services" ON services;
CREATE POLICY "Users can view services" ON services
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can view site_pages in their org" ON site_pages;
CREATE POLICY "Users can view site_pages in their org" ON site_pages
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can view service areas in their org" ON service_areas;
CREATE POLICY "Users can view service areas in their org" ON service_areas
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "Users can view neighborhoods in their org" ON neighborhoods;
CREATE POLICY "Users can view neighborhoods in their org" ON neighborhoods
  FOR SELECT USING (public.user_can_access_site(site_id));

-- Helpful indexes for the helper's lookups (no-ops if they already exist).
CREATE INDEX IF NOT EXISTS idx_profiles_user_org ON profiles(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_psa_profile_site ON profile_site_assignments(profile_id, site_id);
