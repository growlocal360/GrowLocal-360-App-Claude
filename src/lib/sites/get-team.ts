import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/types/database';

/**
 * Fetch team members that should be displayed on a site's public pages.
 * Returns profiles where show_on_site = true, filtered by site access,
 * ordered by display_order then created_at.
 */
export async function getTeamMembersForSite(
  siteId: string,
  organizationId: string
): Promise<Profile[]> {
  const adminSupabase = createAdminClient();

  // Get all profiles in the org that opted in to public display
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('show_on_site', true)
    .not('full_name', 'is', null)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!profiles || profiles.length === 0) return [];

  // Get site assignments for non-owner profiles
  const nonOwnerIds = profiles
    .filter((p) => p.role !== 'owner')
    .map((p) => p.id);

  let assignmentMap = new Map<string, boolean>();

  if (nonOwnerIds.length > 0) {
    const { data: assignments } = await adminSupabase
      .from('profile_site_assignments')
      .select('profile_id')
      .eq('site_id', siteId)
      .in('profile_id', nonOwnerIds);

    // Get profiles with zero assignments (all-sites access)
    const { data: allAssignments } = await adminSupabase
      .from('profile_site_assignments')
      .select('profile_id')
      .in('profile_id', nonOwnerIds);

    const profilesWithAnyAssignment = new Set(
      (allAssignments || []).map((a) => a.profile_id)
    );
    const profilesWithThisSite = new Set(
      (assignments || []).map((a) => a.profile_id)
    );

    for (const id of nonOwnerIds) {
      // Has access if: assigned to this site, or has no assignments at all (all-sites)
      const hasAccess =
        profilesWithThisSite.has(id) || !profilesWithAnyAssignment.has(id);
      assignmentMap.set(id, hasAccess);
    }
  }

  // Filter: owners always included, others must have site access
  return profiles.filter((p) => {
    if (p.role === 'owner') return true;
    return assignmentMap.get(p.id) === true;
  });
}
