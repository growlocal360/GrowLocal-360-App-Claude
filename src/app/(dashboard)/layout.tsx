import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  // A pending invitation for this exact email that was never accepted: the
  // signup trigger only joins people who sign up AFTER the invite exists, and
  // the invite page used to wait for a click. Anyone who already had a login,
  // or who came in through the normal login page, landed in their own empty
  // org with the invite still pending. Send them to the invite, which now
  // accepts on its own. A token the invite page could not accept is skipped
  // (cookie set there) so a failure never traps someone away from the dashboard.
  if (user.email) {
    const skipped = new Set(
      ((await cookies()).get('invite_skip')?.value || '').split(',').filter(Boolean)
    );
    const { data: pending } = await createAdminClient()
      .from('invitations')
      .select('token, email')
      .ilike('email', user.email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    const invite = (pending || []).find(
      (i) => i.email?.toLowerCase() === user.email!.toLowerCase() && !skipped.has(i.token)
    );
    if (invite) redirect(`/invite/${invite.token}`);
  }

  // Get all profiles + org names for this user
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, organization:organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) {
    // User is authenticated but has no org profile — either they were removed
    // from their only team, or signed up without joining one. Send them to the
    // self-service setup page (top-level route, outside this layout, so no loop)
    // where they can create their own business.
    redirect('/setup');
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
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
