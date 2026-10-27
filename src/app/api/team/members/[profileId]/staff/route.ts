import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';

/**
 * PUT — Make a dashboard user schedulable (or not).
 *
 * Owners and admins who also work in the field need a staff_member record
 * linked to their login so scheduling, the hero availability badge and the
 * "my schedule" view all see them. Invited technicians get this automatically
 * on invitation accept; this route gives everyone else the same switch.
 *
 * Body: { enabled: boolean, siteIds?: string[] }
 *   enabled=true  → create (or reactivate) the linked staff record and set its
 *                   site assignments: siteIds if given, else the user's site
 *                   access, else every active site in the org.
 *   enabled=false → deactivate the record and drop its site assignments so it
 *                   no longer counts toward availability.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase, await getActiveOrgId());

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owners/admins can toggle anyone in the org; anyone can toggle themselves.
  if (!hasRole(caller, 'owner', 'admin') && caller.id !== profileId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled === true;
  const requestedSiteIds: string[] | undefined = Array.isArray(body?.siteIds) ? body.siteIds : undefined;

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('profiles')
    .select('id, user_id, organization_id, full_name, avatar_url, title, bio')
    .eq('id', profileId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const { data: existing } = await admin
    .from('staff_members')
    .select('id, is_active')
    .eq('profile_id', profileId)
    .eq('organization_id', caller.organization_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enabled) {
    if (existing) {
      await admin.from('staff_site_assignments').delete().eq('staff_member_id', existing.id);
      await admin
        .from('staff_members')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return NextResponse.json({ success: true, staff: null });
  }

  // Resolve a display name + email for a brand-new record
  let email: string | null = null;
  if (!existing) {
    const { data: authUser } = await admin.auth.admin.getUserById(target.user_id);
    email = authUser?.user?.email || null;
  }
  const fullName = target.full_name?.trim() || email?.split('@')[0] || 'Team member';

  let staffId: string;
  if (existing) {
    staffId = existing.id;
    await admin
      .from('staff_members')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', staffId);
  } else {
    const { data: created, error } = await admin
      .from('staff_members')
      .insert({
        organization_id: caller.organization_id,
        profile_id: profileId,
        full_name: fullName,
        email,
        title: target.title || null,
        bio: target.bio || null,
        avatar_url: target.avatar_url || null,
        show_on_site: false,
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('owner-as-staff: insert failed', error);
      return NextResponse.json({ error: 'Failed to create staff record' }, { status: 500 });
    }
    staffId = created.id;
  }

  // Site assignments: explicit → user's site access → every active site in the org
  let siteIds = requestedSiteIds;
  if (!siteIds) {
    const { data: access } = await admin
      .from('profile_site_assignments')
      .select('site_id')
      .eq('profile_id', profileId);
    siteIds = (access || []).map((a) => a.site_id as string);
  }
  if (siteIds.length === 0) {
    const { data: orgSites } = await admin
      .from('sites')
      .select('id')
      .eq('organization_id', caller.organization_id)
      .eq('is_active', true);
    siteIds = (orgSites || []).map((s) => s.id as string);
  }

  await admin.from('staff_site_assignments').delete().eq('staff_member_id', staffId);
  if (siteIds.length > 0) {
    const { error } = await admin
      .from('staff_site_assignments')
      .insert(siteIds.map((site_id) => ({ staff_member_id: staffId, site_id })));
    if (error) {
      console.error('owner-as-staff: assignments failed', error);
    }
  }

  return NextResponse.json({ success: true, staff: { id: staffId, siteIds } });
}
