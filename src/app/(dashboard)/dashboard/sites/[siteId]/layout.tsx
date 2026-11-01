import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { Header } from '@/components/layout/header';

/**
 * Every page under /dashboard/sites/[siteId] shares one header that names the
 * site being worked on, so a user three settings pages deep never has to go
 * back to the overview to remember which client they are in. Pages render
 * their own page title below it.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';

  const [{ data: site }, profilesRes] = await Promise.all([
    admin.from('sites').select('id, name, slug, status, custom_domain, custom_domain_verified, organization_id').eq('id', siteId).maybeSingle(),
    user
      ? admin.from('profiles').select('organization_id, full_name, avatar_url').eq('user_id', user.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  // Only name the site to someone in its organization; otherwise fall through
  // and let the page handle "not found" the way it already does.
  const profiles = (profilesRes.data || []) as { organization_id: string; full_name: string | null; avatar_url: string | null }[];
  const member = site ? profiles.some((p) => p.organization_id === site.organization_id) : false;
  const activeOrgId = await getActiveOrgId();
  const profile = profiles.find((p) => p.organization_id === activeOrgId) || profiles[0];

  const userData = {
    name: profile?.full_name || user?.user_metadata?.full_name || 'User',
    email: user?.email || '',
    avatarUrl: profile?.avatar_url || user?.user_metadata?.avatar_url,
  };

  const siteUrl = site && member && site.status === 'active'
    ? `https://${site.custom_domain_verified && site.custom_domain ? site.custom_domain : `${site.slug}.${appDomain}`}`
    : undefined;

  return (
    <div className="flex flex-col min-h-full">
      <Header title={site && member ? site.name : 'Site'} eyebrow={site && member ? 'Site' : undefined} siteUrl={siteUrl} user={userData} />
      {children}
    </div>
  );
}
