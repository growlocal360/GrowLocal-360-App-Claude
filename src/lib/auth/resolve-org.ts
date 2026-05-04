import { SupabaseClient } from '@supabase/supabase-js';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OrgContext {
  userId: string;
  organizationId: string;
  profileId: string;
  role: string;
}

/**
 * Resolve the active organization for the authenticated user.
 *
 * Reads the active org cookie if set; otherwise falls back to the user's
 * most recent profile. Returns the org context, or an error shape suitable
 * for direct return from a route handler.
 */
export async function resolveActiveOrg(
  supabase: SupabaseClient
): Promise<
  | OrgContext
  | { error: string; status: number }
> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, user_id, organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) {
    return { error: 'No profile found', status: 404 };
  }

  const activeOrgId = await getActiveOrgId();
  const profile = (activeOrgId
    ? profiles.find((p) => p.organization_id === activeOrgId)
    : null) || profiles[0];

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    profileId: profile.id,
    role: profile.role,
  };
}
