import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/job-snaps/technicians?siteId=<id>
 *
 * Returns the list of profiles eligible to be credited as the technician
 * on a Job Snap for the given site.
 *
 * Visibility:
 *   - Owner / admin caller → every profile in the org
 *   - User-role caller    → only themselves (techs can't credit other techs)
 *
 * Response: { technicians: Array<{ id, full_name, avatar_url, title, role }> }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Find the caller's profile within the site's org.
    const { data: site } = await admin
      .from('sites')
      .select('organization_id')
      .eq('id', siteId)
      .single();
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('organization_id', site.organization_id)
      .single();
    if (!callerProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isPrivileged = callerProfile.role === 'owner' || callerProfile.role === 'admin';

    let query = admin
      .from('profiles')
      .select('id, full_name, avatar_url, title, role')
      .eq('organization_id', site.organization_id)
      .order('full_name', { ascending: true });

    if (!isPrivileged) {
      // Non-privileged caller can only credit themselves.
      query = query.eq('id', callerProfile.id);
    }

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) {
      return NextResponse.json({ error: 'Failed to load technicians' }, { status: 500 });
    }

    return NextResponse.json({
      technicians: profiles || [],
      caller_profile_id: callerProfile.id,
    });
  } catch (error) {
    console.error('GET /api/job-snaps/technicians failed:', error);
    return NextResponse.json({ error: 'Failed to load technicians' }, { status: 500 });
  }
}
