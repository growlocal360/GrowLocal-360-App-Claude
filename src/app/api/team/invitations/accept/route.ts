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
    // Still apply site assignments — the trigger may have created the profile
    // but skipped or failed on site assignments
    if (invitation.site_ids && invitation.site_ids.length > 0) {
      for (const siteId of invitation.site_ids) {
        await adminSupabase
          .from('profile_site_assignments')
          .upsert(
            { profile_id: existingProfile.id, site_id: siteId },
            { onConflict: 'profile_id,site_id' }
          );
      }
    }

    // For 'user' role (technicians): ensure a linked staff_member exists
    if (invitation.role === 'user') {
      await ensureStaffMember(adminSupabase, existingProfile.id, invitation, user);
    }

    // Mark invitation as accepted
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

  // For 'user' role (technicians): auto-create a linked staff_member
  if (invitation.role === 'user') {
    await ensureStaffMember(adminSupabase, newProfile.id, invitation, user);
  }

  // Mark invitation as accepted
  await adminSupabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  // Clean up orphaned empty orgs — if the user had an auto-created org
  // with no sites and no other members, delete it to prevent clutter
  const { data: userOrgs } = await adminSupabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('user_id', user.id);

  if (userOrgs && userOrgs.length > 1) {
    for (const orgProfile of userOrgs) {
      // Skip the org we just joined
      if (orgProfile.organization_id === invitation.organization_id) continue;
      // Only clean up orgs where user is the owner
      if (orgProfile.role !== 'owner') continue;

      // Check if this org has any sites
      const { count: siteCount } = await adminSupabase
        .from('sites')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgProfile.organization_id);

      if (siteCount && siteCount > 0) continue;

      // Check if this org has other members besides this user
      const { count: memberCount } = await adminSupabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgProfile.organization_id);

      if (memberCount && memberCount > 1) continue;

      // Safe to delete — empty org with only this user
      await adminSupabase
        .from('profiles')
        .delete()
        .eq('id', orgProfile.id);
      await adminSupabase
        .from('organizations')
        .delete()
        .eq('id', orgProfile.organization_id);
    }
  }

  // Set the active org cookie to the newly joined org
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('active_org_id', invitation.organization_id, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

// Auto-create a linked staff_member for 'user' role (technicians) so they can be scheduled
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureStaffMember(admin: any, profileId: string, invitation: any, user: any) {
  try {
    // Check if a staff_member already exists for this profile
    const { data: existing } = await admin
      .from('staff_members')
      .select('id')
      .eq('profile_id', profileId)
      .single();

    if (existing) return;

    // Create staff_member linked to the profile
    const { data: staffMember } = await admin
      .from('staff_members')
      .insert({
        organization_id: invitation.organization_id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unnamed',
        email: user.email,
        profile_id: profileId,
        show_on_site: false,
        is_active: true,
      })
      .select('id')
      .single();

    // Mirror site assignments to staff_site_assignments
    if (staffMember && invitation.site_ids && invitation.site_ids.length > 0) {
      const staffAssignments = invitation.site_ids.map((siteId: string) => ({
        staff_member_id: staffMember.id,
        site_id: siteId,
      }));
      await admin.from('staff_site_assignments').insert(staffAssignments);
    }
  } catch (err) {
    console.error('ensureStaffMember: failed for profile', profileId, err);
  }
}
