import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { sendInviteEmail } from '@/lib/email/resend';

// GET - List pending invitations
export async function GET() {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller || !hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: invitations, error } = await adminSupabase
    .from('invitations')
    .select('id, email, role, site_ids, expires_at, created_at, invited_by, inviter:profiles!invited_by(full_name)')
    .eq('organization_id', caller.organization_id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }

  return NextResponse.json({ invitations });
}

// POST - Create and send an invitation
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller || !hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, role, siteIds } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Admins can only invite Users
  if (caller.role === 'admin' && role !== 'user') {
    return NextResponse.json({ error: 'Admins can only invite users' }, { status: 403 });
  }

  // Cannot invite as owner
  if (role === 'owner') {
    return NextResponse.json({ error: 'Cannot invite as owner' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Check if email is already in the org
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
  const existingUser = authUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('organization_id', caller.organization_id)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'This person is already a member of your team' },
        { status: 400 }
      );
    }
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await adminSupabase
    .from('invitations')
    .select('id')
    .eq('organization_id', caller.organization_id)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .single();

  if (existingInvite) {
    return NextResponse.json(
      { error: 'An invitation is already pending for this email' },
      { status: 400 }
    );
  }

  // Get org name for the email
  const { data: org } = await adminSupabase
    .from('organizations')
    .select('name')
    .eq('id', caller.organization_id)
    .single();

  // Create the invitation
  const { data: invitation, error: insertError } = await adminSupabase
    .from('invitations')
    .insert({
      organization_id: caller.organization_id,
      email: email.toLowerCase(),
      role: role || 'user',
      invited_by: caller.id,
      site_ids: siteIds || [],
    })
    .select('id, token')
    .single();

  if (insertError || !invitation) {
    console.error('Failed to create invitation:', insertError);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }

  // Send invitation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.goleadflow.com';
  const inviteUrl = `${appUrl}/invite/${invitation.token}`;

  try {
    await sendInviteEmail({
      to: email,
      inviterName: caller.full_name || 'A team member',
      orgName: org?.name || 'your team',
      role: role || 'user',
      inviteUrl,
    });
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError);
    // Invitation was created but email failed — don't delete, let them retry
  }

  return NextResponse.json({ success: true, invitationId: invitation.id });
}

// DELETE - Cancel a pending invitation
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller || !hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const invitationId = searchParams.get('id');

  if (!invitationId) {
    return NextResponse.json({ error: 'Missing invitation id' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', caller.organization_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
