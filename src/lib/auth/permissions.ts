import { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database';

export interface CallerProfile {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string | null;
}

/**
 * Get the authenticated user's profile with role info.
 * Uses the user-scoped Supabase client (RLS enforced).
 */
export async function getCallerProfile(
  supabase: SupabaseClient
): Promise<CallerProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name')
    .eq('user_id', user.id)
    .single();

  return profile as CallerProfile | null;
}

/**
 * Check if the caller has one of the required roles.
 */
export function hasRole(
  profile: CallerProfile,
  ...allowedRoles: UserRole[]
): boolean {
  return allowedRoles.includes(profile.role);
}

/**
 * Check if a profile can access a specific site.
 * - Owner: always has access to all sites
 * - Admin with no site assignments: access to all sites
 * - Admin/User with site assignments: only assigned sites
 */
export async function canAccessSite(
  supabase: SupabaseClient,
  profileId: string,
  role: UserRole,
  siteId: string
): Promise<boolean> {
  if (role === 'owner') return true;

  const { data: assignments } = await supabase
    .from('profile_site_assignments')
    .select('id')
    .eq('profile_id', profileId);

  // Admin with no assignments = access to all sites
  if (role === 'admin' && (!assignments || assignments.length === 0)) {
    return true;
  }

  // Check if the specific site is in their assignments
  const { data: match } = await supabase
    .from('profile_site_assignments')
    .select('id')
    .eq('profile_id', profileId)
    .eq('site_id', siteId)
    .limit(1);

  return (match && match.length > 0) || false;
}
