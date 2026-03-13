import { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
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

/**
 * Get the list of site IDs a user can access.
 * Returns null if the user has access to ALL sites in their org.
 * Returns string[] of specific site IDs if scoped.
 * Returns [] if user has no access (user role with no assignments).
 */
export async function getAccessibleSiteIds(
  supabase: SupabaseClient,
  profileId: string,
  role: UserRole
): Promise<string[] | null> {
  if (role === 'owner') return null;

  const { data: assignments } = await supabase
    .from('profile_site_assignments')
    .select('site_id')
    .eq('profile_id', profileId);

  if (!assignments || assignments.length === 0) {
    // Admin with no assignments = all sites; user with no assignments = none
    return role === 'admin' ? null : [];
  }

  return assignments.map((a) => a.site_id);
}

/**
 * Verify that the authenticated user can access a specific site.
 * Checks: auth → org membership → site assignment scoping.
 * Returns { caller, siteOrgId } on success, or { error, status } on failure.
 */
export async function verifySiteAccess(
  supabase: SupabaseClient,
  siteId: string
): Promise<
  | { caller: CallerProfile; siteOrgId: string; error?: never; status?: never }
  | { error: string; status: number; caller?: never; siteOrgId?: never }
> {
  const caller = await getCallerProfile(supabase);
  if (!caller) {
    return { error: 'Unauthorized', status: 401 };
  }

  // Verify site belongs to caller's org
  const adminSupabase = createAdminClient();
  const { data: site } = await adminSupabase
    .from('sites')
    .select('id, organization_id')
    .eq('id', siteId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!site) {
    return { error: 'Site not found', status: 404 };
  }

  // Check site-level access
  const hasAccess = await canAccessSite(adminSupabase, caller.id, caller.role, siteId);
  if (!hasAccess) {
    return { error: 'You do not have access to this site', status: 403 };
  }

  return { caller, siteOrgId: site.organization_id };
}
