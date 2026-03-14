import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { getActiveOrgId } from '@/lib/auth/active-org';
import type { UserRole } from '@/types/database';
import type { OrgOption } from '@/components/layout/org-switcher';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get all profiles + org names for this user
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, organization:organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) {
    redirect('/login');
  }

  // Read active org from cookie
  let activeOrgId = await getActiveOrgId();

  // Validate the cookie — must match one of the user's orgs
  const validOrg = activeOrgId && profiles.some(p => p.organization_id === activeOrgId);
  if (!validOrg) {
    // Auto-select: first profile's org (cookie will be set on next org-switch action)
    activeOrgId = profiles[0].organization_id as string;
  }

  // Pick the profile for the active org
  const profile = profiles.find(p => p.organization_id === activeOrgId) || profiles[0];

  const userData = {
    name: profile?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url,
  };

  // Build org list for the switcher
  const orgs: OrgOption[] = profiles.map(p => ({
    orgId: p.organization_id,
    orgName: p.organization?.name || 'Unnamed Org',
    role: p.role as UserRole,
  }));

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={userData}
        role={(profile?.role as UserRole) || 'user'}
        orgs={orgs}
        activeOrgId={activeOrgId!}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
