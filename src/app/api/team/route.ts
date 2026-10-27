import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';

// GET - List team members with their site assignments
export async function GET() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Fetch all profiles in the org with their auth user emails
  const { data: profiles, error } = await adminSupabase
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, avatar_url, bio, title, created_at')
    .eq('organization_id', caller.organization_id)
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }

  // Fetch emails from auth.users for each profile
  const userIds = profiles.map((p) => p.user_id);
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  for (const u of authUsers?.users || []) {
    if (userIds.includes(u.id)) {
      emailMap.set(u.id, u.email || '');
    }
  }

  // Fetch site assignments for all profiles
  const profileIds = profiles.map((p) => p.id);
  const { data: assignments } = await adminSupabase
    .from('profile_site_assignments')
    .select('profile_id, site_id, site:sites(id, name, slug)')
    .in('profile_id', profileIds);

  // Group assignments by profile
  const assignmentMap = new Map<string, { site_id: string; site_name: string; site_slug: string }[]>();
  for (const a of assignments || []) {
    const site = a.site as unknown as { id: string; name: string; slug: string } | null;
    if (!assignmentMap.has(a.profile_id)) {
      assignmentMap.set(a.profile_id, []);
    }
    if (site) {
      assignmentMap.get(a.profile_id)!.push({
        site_id: site.id,
        site_name: site.name,
        site_slug: site.slug,
      });
    }
  }

  // Linked staff records (people who can be scheduled) keyed by profile
  const { data: linkedStaff } = await adminSupabase
    .from('staff_members')
    .select('id, profile_id, is_active, assignments:staff_site_assignments(site_id, site:sites(name))')
    .in('profile_id', profileIds)
    .eq('is_active', true);
  const staffMap = new Map<string, { id: string; site_names: string[] }>();
  for (const s of linkedStaff || []) {
    if (!s.profile_id) continue;
    const rows = (s.assignments || []) as unknown as { site_id: string; site: { name: string } | { name: string }[] | null }[];
    const names = rows
      .map((r) => (Array.isArray(r.site) ? r.site[0]?.name : r.site?.name))
      .filter((n): n is string => !!n);
    staffMap.set(s.profile_id, { id: s.id, site_names: names });
  }

  const members = profiles.map((p) => ({
    ...p,
    email: emailMap.get(p.user_id) || '',
    site_assignments: assignmentMap.get(p.id) || [],
    staff_link: staffMap.get(p.id) || null,
  }));

  return NextResponse.json({ members, callerRole: caller.role, callerProfileId: caller.id });
}

// PATCH - Update a member's role or profile fields
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner')) {
    return NextResponse.json({ error: 'Only the account owner can edit members' }, { status: 403 });
  }

  const { profileId, role, fullName, title, bio, avatarUrl } = await request.json();

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Verify target is in same org
  const { data: target } = await adminSupabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', profileId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Role change (only for non-owners, can't self-assign owner)
  if (role !== undefined) {
    if (role === 'owner') {
      return NextResponse.json({ error: 'Cannot assign owner role' }, { status: 400 });
    }
    if (profileId === caller.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }
    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }
    updates.role = role;
  }

  // Profile field updates
  if (fullName !== undefined) updates.full_name = fullName.trim();
  if (title !== undefined) updates.title = title?.trim() || null;
  if (bio !== undefined) updates.bio = bio?.trim() || null;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  const { error } = await adminSupabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Remove a member from the org
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner')) {
    return NextResponse.json({ error: 'Only the account owner can remove members' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  // Cannot remove yourself
  if (profileId === caller.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Verify target is in same org and not owner
  const { data: target } = await adminSupabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', profileId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the account owner' }, { status: 400 });
  }

  // Delete profile (cascades to site assignments)
  const { error } = await adminSupabase
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
