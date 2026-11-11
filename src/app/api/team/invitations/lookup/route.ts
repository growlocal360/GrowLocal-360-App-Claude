import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Public lookup of invitation by token (no auth required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: invitation, error } = await adminSupabase
    .from('invitations')
    .select(
      'id, email, role, expires_at, site_ids, organization:organizations(name), inviter:profiles!invited_by(full_name)'
    )
    .eq('token', token)
    .is('accepted_at', null)
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
  }

  // Which businesses the invite covers (empty = every site in the org), so
  // the accept page can name them instead of the org (often just a person's
  // name).
  const siteIds: string[] = (invitation as { site_ids?: string[] | null }).site_ids || [];
  let siteNames: string[] = [];
  if (siteIds.length > 0) {
    const { data: sites } = await adminSupabase
      .from('sites')
      .select('name')
      .in('id', siteIds)
      .order('name');
    siteNames = (sites || []).map((s: { name: string }) => s.name);
  }

  // Does the invited address already have a GrowLocal 360 login? Lets the
  // accept page lead with "Sign in" or "Create account" instead of both.
  const invitedEmail = String(invitation.email || '').toLowerCase();
  let hasAccount = false;
  try {
    const { data: authUsers } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
    hasAccount = (authUsers?.users || []).some((u) => (u.email || '').toLowerCase() === invitedEmail);
  } catch {
    // Non-fatal: the page falls back to showing both options.
  }

  const { site_ids: _siteIds, ...rest } = invitation as typeof invitation & { site_ids?: string[] | null };
  void _siteIds;
  return NextResponse.json({ invitation: { ...rest, site_names: siteNames, has_account: hasAccount } });
}
