import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST - Accept an invitation (authenticated user)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Look up the invitation
  const { data: invitation, error: inviteError } = await adminSupabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .single();

  if (inviteError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
  }

  // Check if user is already in this org
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', invitation.organization_id)
    .single();

  if (existingProfile) {
    // Mark invitation as accepted even if already a member
    await adminSupabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: 'You are already a member of this team',
    });
  }

  // Create profile in the org
  const { data: newProfile, error: profileError } = await adminSupabase
    .from('profiles')
    .insert({
      user_id: user.id,
      organization_id: invitation.organization_id,
      role: invitation.role,
      full_name: user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    })
    .select('id')
    .single();

  if (profileError || !newProfile) {
    console.error('Failed to create profile:', profileError);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }

  // Create site assignments if specified
  if (invitation.site_ids && invitation.site_ids.length > 0) {
    const assignments = invitation.site_ids.map((siteId: string) => ({
      profile_id: newProfile.id,
      site_id: siteId,
    }));

    await adminSupabase.from('profile_site_assignments').insert(assignments);
  }

  // Mark invitation as accepted
  await adminSupabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return NextResponse.json({ success: true });
}
