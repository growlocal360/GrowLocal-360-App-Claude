import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Temporary diagnostic endpoint — DELETE after debugging.
 * GET /api/debug/site-pages?siteId=xxx
 */
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Exactly the same queries as getSiteBySlug
  const { data: sites, error: siteError } = await supabase
    .from('sites')
    .select('id, slug, name, is_active, status')
    .eq('id', siteId)
    .limit(1);

  const { data: sitePages, error: pagesError } = await supabase
    .from('site_pages')
    .select('id, site_id, page_type, slug, is_active, h1, sections')
    .eq('site_id', siteId)
    .eq('is_active', true);

  return NextResponse.json({
    site: sites?.[0] || null,
    siteError,
    sitePages: (sitePages || []).map(p => ({
      id: p.id,
      page_type: p.page_type,
      slug: p.slug,
      is_active: p.is_active,
      h1: p.h1,
      has_sections: p.sections !== null && p.sections !== undefined,
      sections_keys: p.sections ? Object.keys(p.sections) : null,
    })),
    pagesError,
    totalPages: sitePages?.length || 0,
  });
}
