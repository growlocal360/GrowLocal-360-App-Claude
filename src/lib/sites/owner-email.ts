import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Where owner-facing email for a site goes:
 *   1. settings.lead_notification_email
 *   2. scheduling_configs.notification_email
 *   3. the organization owner's login email
 */
export async function resolveOwnerEmail(supabase: SupabaseClient, siteId: string): Promise<string | null> {
  const { data: site } = await supabase.from('sites').select('organization_id, settings').eq('id', siteId).single();
  if (!site) return null;
  const settings = (site.settings || {}) as { lead_notification_email?: string };
  if (settings.lead_notification_email) return settings.lead_notification_email;
  const { data: config } = await supabase.from('scheduling_configs').select('notification_email').eq('site_id', siteId).maybeSingle();
  if (config?.notification_email) return config.notification_email;
  const { data: owner } = await supabase.from('profiles').select('user_id').eq('organization_id', site.organization_id).eq('role', 'owner').limit(1).maybeSingle();
  if (!owner?.user_id) return null;
  const { data: authUser } = await supabase.auth.admin.getUserById(owner.user_id);
  return authUser.user?.email || null;
}
