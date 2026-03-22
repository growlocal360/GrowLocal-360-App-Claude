import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';

// GET — List staff members for the org (with site assignments)
export async function GET() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: staff, error } = await admin
    .from('staff_members')
    .select('*')
    .eq('organization_id', caller.organization_id)
    .eq('is_active', true)
    .order('display_order')
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }

  // Fetch site assignments
  const staffIds = (staff || []).map(s => s.id);
  const { data: assignments } = staffIds.length > 0
    ? await admin
        .from('staff_site_assignments')
        .select('staff_member_id, site_id, site:sites(id, name, slug)')
        .in('staff_member_id', staffIds)
    : { data: [] };

  const assignmentMap = new Map<string, { site_id: string; site_name: string; site_slug: string }[]>();
  for (const a of assignments || []) {
    const site = a.site as unknown as { id: string; name: string; slug: string } | null;
    if (!assignmentMap.has(a.staff_member_id)) {
      assignmentMap.set(a.staff_member_id, []);
    }
    if (site) {
      assignmentMap.get(a.staff_member_id)!.push({
        site_id: site.id,
        site_name: site.name,
        site_slug: site.slug,
      });
    }
  }

  const staffWithAssignments = (staff || []).map(s => ({
    ...s,
    site_assignments: assignmentMap.get(s.id) || [],
  }));

  return NextResponse.json({ staff: staffWithAssignments });
}

// POST — Create a new staff member
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Only owners and admins can add staff' }, { status: 403 });
  }

  const { fullName, title, email, bio, siteIds } = await request.json();

  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: staffMember, error } = await admin
    .from('staff_members')
    .insert({
      organization_id: caller.organization_id,
      full_name: fullName.trim(),
      title: title?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      bio: bio?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }

  // Create site assignments
  if (siteIds?.length > 0) {
    const assignments = siteIds.map((siteId: string) => ({
      staff_member_id: staffMember.id,
      site_id: siteId,
    }));
    await admin.from('staff_site_assignments').insert(assignments);
  }

  return NextResponse.json({ staffMember });
}

// PATCH — Update a staff member
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Only owners and admins can edit staff' }, { status: 403 });
  }

  const { staffId, fullName, title, email, bio, siteIds, showOnSite, avatarUrl } = await request.json();

  if (!staffId) {
    return NextResponse.json({ error: 'Missing staffId' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify staff belongs to same org
  const { data: existing } = await admin
    .from('staff_members')
    .select('id')
    .eq('id', staffId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  // Build update object (only include provided fields)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName.trim();
  if (title !== undefined) updates.title = title?.trim() || null;
  if (email !== undefined) updates.email = email?.trim().toLowerCase() || null;
  if (bio !== undefined) updates.bio = bio?.trim() || null;
  if (showOnSite !== undefined) updates.show_on_site = showOnSite;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  const { error } = await admin
    .from('staff_members')
    .update(updates)
    .eq('id', staffId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }

  // Update site assignments if provided
  if (siteIds !== undefined) {
    await admin.from('staff_site_assignments').delete().eq('staff_member_id', staffId);
    if (siteIds.length > 0) {
      const assignments = siteIds.map((siteId: string) => ({
        staff_member_id: staffId,
        site_id: siteId,
      }));
      await admin.from('staff_site_assignments').insert(assignments);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE — Remove a staff member
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Only owners and admins can remove staff' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');

  if (!staffId) {
    return NextResponse.json({ error: 'Missing staffId' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify staff belongs to same org
  const { data: existing } = await admin
    .from('staff_members')
    .select('id')
    .eq('id', staffId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  // Soft-delete (set is_active = false)
  const { error } = await admin
    .from('staff_members')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', staffId);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove staff member' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
