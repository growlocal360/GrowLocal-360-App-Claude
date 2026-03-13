import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';

// PUT - Replace site assignments for a member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);

  if (!caller || !hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteIds } = await request.json();

  if (!Array.isArray(siteIds)) {
    return NextResponse.json({ error: 'siteIds must be an array' }, { status: 400 });
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

  // Cannot modify owner's site assignments
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot modify owner site access' }, { status: 400 });
  }

  // Admins can only manage Users' assignments
  if (caller.role === 'admin' && target.role !== 'user') {
    return NextResponse.json({ error: 'Admins can only manage user site assignments' }, { status: 403 });
  }

  // Delete existing assignments
  await adminSupabase
    .from('profile_site_assignments')
    .delete()
    .eq('profile_id', profileId);

  // Insert new assignments (if any)
  if (siteIds.length > 0) {
    const assignments = siteIds.map((siteId: string) => ({
      profile_id: profileId,
      site_id: siteId,
    }));

    const { error } = await adminSupabase
      .from('profile_site_assignments')
      .insert(assignments);

    if (error) {
      console.error('Failed to update site assignments:', error);
      return NextResponse.json({ error: 'Failed to update site assignments' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
