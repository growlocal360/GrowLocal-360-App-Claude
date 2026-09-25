import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client-side mirror of `getAccessibleSiteIds` in permissions.ts (that file
 * pulls in the admin client and can't be imported from 'use client' pages).
 *
 * Returns the site IDs this profile may see within ITS organization:
 *   - null  → every site in the org (owner, or admin with no assignments)
 *   - []    → nothing (user with no assignments)
 *   - [...] → exactly the assigned sites (admin/user with assignments)
 *
 * Callers must still filter by the profile's organization_id: a person can
 * hold profiles in several orgs and must only see the active one.
 */
export async function getAccessibleSiteIdsClient(
  supabase: SupabaseClient,
  profileId: string,
  role: string
): Promise<string[] | null> {
  if (role === 'owner') return null;

  const { data: assignments } = await supabase
    .from('profile_site_assignments')
    .select('site_id')
    .eq('profile_id', profileId);

  if (!assignments || assignments.length === 0) {
    return role === 'admin' ? null : [];
  }
  return assignments.map((a: { site_id: string }) => a.site_id);
}
