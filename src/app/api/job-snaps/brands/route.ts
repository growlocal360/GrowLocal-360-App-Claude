import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/job-snaps/brands?siteId=xxx
 *
 * Returns all distinct brand/client names previously used on job snaps
 * for the given site. Used to power the BrandCombobox autocomplete.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    // Verify user has access to this site
    const { data: profiles } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id);

    const orgIds = (profiles || []).map((p: { organization_id: string }) => p.organization_id);
    if (orgIds.length === 0) {
      return NextResponse.json({ brands: [] });
    }

    const admin = createAdminClient();

    const { data: site } = await admin
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .in('organization_id', orgIds)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: snaps } = await admin
      .from('job_snaps')
      .select('brand')
      .eq('site_id', siteId)
      .not('brand', 'is', null)
      .neq('brand', '');

    const brands = [
      ...new Set((snaps || []).map((s: { brand: string }) => s.brand)),
    ].sort() as string[];

    return NextResponse.json({ brands });
  } catch (error) {
    console.error('Failed to fetch job snap brands:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}
