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
 * If activeOrgId is provided, returns the profile for that org.
 * Otherwise returns the first (most recent) profile.
 */
export async function getCallerProfile(
  supabase: SupabaseClient,
  activeOrgId?: string | null
): Promise<CallerProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) return null;

  // If activeOrgId specified, use that org's profile
  if (activeOrgId) {
    const match = profiles.find(p => p.organization_id === activeOrgId);
    if (match) return match as CallerProfile;
  }

  // Fallback: first profile (most recent)
  return profiles[0] as CallerProfile;
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
 * Resolves the correct profile by looking up which org the site belongs to.
 * Returns { caller, siteOrgId } on success, or { error, status } on failure.
 */
export async function verifySiteAccess(
  supabase: SupabaseClient,
  siteId: string
): Promise<
  | { caller: CallerProfile; siteOrgId: string; error?: never; status?: never }
  | { error: string; status: number; caller?: never; siteOrgId?: never }
> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const adminSupabase = createAdminClient();

  // Look up the site's org
  const { data: site } = await adminSupabase
    .from('sites')
    .select('id, organization_id')
    .eq('id', siteId)
    .single();

  if (!site) {
    return { error: 'Site not found', status: 404 };
  }

  // Find the user's profile in this site's org
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name')
    .eq('user_id', user.id)
    .eq('organization_id', site.organization_id);

  const caller = profiles?.[0] as CallerProfile | undefined;

  if (!caller) {
    return { error: 'Site not found', status: 404 };
  }

  // Check site-level access
  const hasAccess = await canAccessSite(adminSupabase, caller.id, caller.role, siteId);
  if (!hasAccess) {
    return { error: 'You do not have access to this site', status: 403 };
  }

  return { caller, siteOrgId: site.organization_id };
}
