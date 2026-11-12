import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCategoriesWithServices } from '@/lib/sites/get-services';

/**
 * The facts image filenames are built from: the trade (primary GBP category),
 * the Primary Market city/state and the business name.
 * e.g. { trade: 'Plumber', city: 'Lake Charles', state: 'LA', siteName: "Anthony's Plumbing" }
 */
export interface SiteImageContext {
  siteName: string;
  trade: string | null;
  city: string | null;
  state: string | null;
}

export async function getSiteImageContext(siteId: string): Promise<SiteImageContext> {
  const admin = createAdminClient();
  const [{ data: site }, { data: location }, { categories }] = await Promise.all([
    admin.from('sites').select('name, settings').eq('id', siteId).maybeSingle(),
    admin.from('locations').select('city, state').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
    getCategoriesWithServices(siteId),
  ]);
  const settings = (site?.settings || {}) as { primary_market_city?: string; primary_market_state?: string };
  const primary = categories.find((c) => c.is_primary) || categories[0];
  return {
    siteName: site?.name || 'site',
    trade: primary?.gbp_category?.display_name || null,
    city: settings.primary_market_city || location?.city || null,
    state: settings.primary_market_state || location?.state || null,
  };
}

/**
 * The company a person's avatar is named after: the first site they are
 * assigned to (a client set up under an agency org belongs to THEIR business,
 * not the agency), falling back to the organization name.
 */
export async function avatarCompanyName(
  admin: SupabaseClient,
  organizationId: string,
  assignmentTable: 'profile_site_assignments' | 'staff_site_assignments',
  idColumn: 'profile_id' | 'staff_member_id',
  id: string
): Promise<string | null> {
  const { data: assigned } = await admin
    .from(assignmentTable)
    .select('site:sites(name)')
    .eq(idColumn, id)
    .limit(1)
    .maybeSingle();
  const site = assigned?.site as { name?: string } | { name?: string }[] | null | undefined;
  const siteName = Array.isArray(site) ? site[0]?.name : site?.name;
  if (siteName) return siteName;
  const { data: org } = await admin.from('organizations').select('name').eq('id', organizationId).maybeSingle();
  return org?.name || null;
}
