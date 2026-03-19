import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/job-snaps/services?siteId=...
 *
 * Returns the site's categories with their services, for the
 * category/service selector in the Job Snap creation flow.
 */
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase
      .from('site_categories')
      .select('id, is_primary, gbp_category:gbp_categories(name, display_name)')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false }),
    supabase
      .from('services')
      .select('id, name, slug, site_category_id')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  if (!categories) {
    return NextResponse.json({ categories: [] });
  }

  const result = categories.map((cat) => {
    const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
    return {
      id: cat.id,
      name: gbp?.display_name || gbp?.name || 'Uncategorized',
      isPrimary: cat.is_primary,
      services: (services || [])
        .filter((s: { site_category_id: string | null }) => s.site_category_id === cat.id)
        .map((s: { id: string; name: string; slug: string }) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
        })),
    };
  });

  return NextResponse.json({ categories: result });
}
