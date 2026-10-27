import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/staff
 * Active staff members assigned to this site.
 *
 * staff_members / staff_site_assignments have RLS enabled with no read
 * policies (admin-client only), so the dashboard must go through the server
 * for this list; a browser-side query silently returns nothing.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createAdminClient();
  const { data: assignments } = await admin
    .from('staff_site_assignments')
    .select('staff_member_id')
    .eq('site_id', siteId);

  const staffIds = (assignments || []).map((a) => a.staff_member_id as string);
  if (staffIds.length === 0) return NextResponse.json([]);

  const { data: staff, error } = await admin
    .from('staff_members')
    .select('*')
    .in('id', staffIds)
    .eq('is_active', true)
    .order('display_order')
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
  return NextResponse.json(staff || []);
}
