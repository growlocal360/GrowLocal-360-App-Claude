import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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

  return <SetupForm defaultName={defaultName} />;
}
