import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConnectGbpForm } from './connect-form';

/**
 * Dedicated GBP setup page. One canonical place for connecting/reconnecting
 * Google Business Profile to a site, and picking which listing to publish to.
 *
 * Used by the toast "Connect Google" button + amber banner on snap pages —
 * those just navigate here. Works for both full GL360 sites (writes the GBP
 * IDs onto the primary location row) and workspace-only Job Snaps sites
 * (writes the location resource to sites.settings).
 */
export default async function ConnectGbpPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { siteId } = await params;
  const { next } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const admin = createAdminClient();

  // Verify the user has access to this site (via org membership)
  const [{ data: profiles }, { data: site }] = await Promise.all([
    admin.from('profiles').select('organization_id').eq('user_id', user.id),
    admin.from('sites').select('id, name, organization_id, settings').eq('id', siteId).maybeSingle(),
  ]);

  const orgIds = (profiles || []).map((p) => p.organization_id);
  if (!site || !orgIds.includes(site.organization_id)) {
    redirect('/dashboard');
  }

  return (
    <ConnectGbpForm
      siteId={siteId}
      siteName={site.name as string}
      nextPath={next || '/dashboard/job-snaps'}
    />
  );
}
