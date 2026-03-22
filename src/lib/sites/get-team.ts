import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile, StaffMember } from '@/types/database';

/** Unified team member type for public display (profiles + staff) */
export type PublicTeamSource = Profile | (StaffMember & { _isStaff: true });

/**
 * Fetch team members that should be displayed on a site's public pages.
 * Returns profiles (show_on_site = true, filtered by site access) merged
 * with staff_members assigned to this site, ordered by display_order.
 */
export async function getTeamMembersForSite(
  siteId: string,
  organizationId: string
): Promise<PublicTeamSource[]> {
  const adminSupabase = createAdminClient();

  // ── Profiles (auth users) ──────────────────────────────────────────────
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('show_on_site', true)
    .not('full_name', 'is', null)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  let filteredProfiles: Profile[] = [];

  if (profiles && profiles.length > 0) {
    // Get site assignments for non-owner profiles
    const nonOwnerIds = profiles
      .filter((p) => p.role !== 'owner')
      .map((p) => p.id);

    const assignmentMap = new Map<string, boolean>();

    if (nonOwnerIds.length > 0) {
      const { data: assignments } = await adminSupabase
        .from('profile_site_assignments')
        .select('profile_id')
        .eq('site_id', siteId)
        .in('profile_id', nonOwnerIds);

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
        const hasAccess =
          profilesWithThisSite.has(id) || !profilesWithAnyAssignment.has(id);
        assignmentMap.set(id, hasAccess);
      }
    }

    filteredProfiles = profiles.filter((p) => {
      if (p.role === 'owner') return true;
      return assignmentMap.get(p.id) === true;
    });
  }

  // ── Staff members (no auth) ────────────────────────────────────────────
  const { data: staffAssignments } = await adminSupabase
    .from('staff_site_assignments')
    .select('staff_member_id')
    .eq('site_id', siteId);

  const staffIds = (staffAssignments || []).map(a => a.staff_member_id);

  let staffMembers: (StaffMember & { _isStaff: true })[] = [];

  if (staffIds.length > 0) {
    const { data: staff } = await adminSupabase
      .from('staff_members')
      .select('*')
      .in('id', staffIds)
      .eq('show_on_site', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    staffMembers = (staff || []).map(s => ({ ...s, _isStaff: true as const }));
  }

  // ── Merge and sort by display_order ────────────────────────────────────
  const combined: PublicTeamSource[] = [...filteredProfiles, ...staffMembers];
  combined.sort((a, b) => {
    const orderA = a.display_order ?? 0;
    const orderB = b.display_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return combined;
}
