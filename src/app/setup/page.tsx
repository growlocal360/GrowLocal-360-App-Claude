import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SetupForm } from './setup-form';

/**
 * Top-level "Create your business" page — intentionally OUTSIDE the (dashboard)
 * route group so the dashboard layout's zero-profile redirect can't loop here.
 *
 * Reachable by:
 *   - Stranded users (removed from their only org) — the dashboard layout
 *     redirects zero-profile users here instead of to a dead-end login.
 *   - Active team members who want to spin up their own separate business.
 */
export default async function SetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    '';

  // Surface any pending team invitations for this email so a re-invited user
  // can rejoin instead of being nudged to create their own business. Uses the
  // admin client because invitations aren't RLS-readable by the invitee yet.
  let invites: { token: string; orgName: string }[] = [];
  if (user.email) {
    const adminSupabase = createAdminClient();
    const { data } = await adminSupabase
      .from('invitations')
      .select('token, organization:organizations(name)')
      .eq('email', user.email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    invites = (data || []).map((row) => {
      const org = Array.isArray(row.organization) ? row.organization[0] : row.organization;
      return { token: row.token as string, orgName: org?.name || 'a team' };
    });
  }

  return <SetupForm defaultName={defaultName} invites={invites} />;
}
