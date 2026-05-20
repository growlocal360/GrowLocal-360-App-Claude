import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/job-snaps/attachment-targets?siteId=<id>
 *
 * Returns every taxonomy row a Job Snap can be attached to for the given
 * site: services (grouped by category), categories, brands, service areas.
 *
 * Response shape:
 * {
 *   services:      Array<{ id, name, slug, category_id, category_name }>,
 *   categories:    Array<{ id, name, is_primary }>,
 *   brands:        Array<{ id, name, slug }>,
 *   service_areas: Array<{ id, name, slug, state }>,
 * }
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

    // Verify the caller has access to this site's org.
    const { data: site } = await admin
      .from('sites')
      .select('organization_id')
      .eq('id', siteId)
      .single();
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id);
    const userOrgIds = (profiles || []).map(
      (p: { organization_id: string }) => p.organization_id
    );
    if (!userOrgIds.includes(site.organization_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Run the four queries in parallel ──────────────────────────────────
    const [servicesRes, categoriesRes, brandsRes, areasRes] = await Promise.all([
      admin
        .from('services')
        .select('id, name, slug, site_category_id, category:site_categories(id, gbp_category:gbp_categories(display_name))')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      admin
        .from('site_categories')
        .select('id, is_primary, gbp_category:gbp_categories(display_name)')
        .eq('site_id', siteId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
      admin
        .from('site_brands')
        .select('id, name, slug')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      admin
        .from('service_areas')
        .select('id, name, slug, state')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true }),
    ]);

    if (servicesRes.error || categoriesRes.error || brandsRes.error || areasRes.error) {
      console.error('attachment-targets query failed:', {
        services: servicesRes.error,
        categories: categoriesRes.error,
        brands: brandsRes.error,
        areas: areasRes.error,
      });
      return NextResponse.json(
        { error: 'Failed to load attachment targets' },
        { status: 500 }
      );
    }

    // Supabase types nested joins as arrays even for to-one relations,
    // so unwrap defensively.
    type RawJoin<T> = T | T[] | null;
    function first<T>(v: RawJoin<T>): T | null {
      if (!v) return null;
      return Array.isArray(v) ? (v[0] ?? null) : v;
    }

    type RawService = {
      id: string;
      name: string;
      slug: string;
      site_category_id: string | null;
      category: RawJoin<{ id: string; gbp_category: RawJoin<{ display_name: string }> }>;
    };
    type RawCategory = {
      id: string;
      is_primary: boolean;
      gbp_category: RawJoin<{ display_name: string }>;
    };

    const services = ((servicesRes.data || []) as unknown as RawService[]).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category_id: s.site_category_id,
      category_name: first(first(s.category)?.gbp_category ?? null)?.display_name ?? null,
    }));

    const categories = ((categoriesRes.data || []) as unknown as RawCategory[]).map((c) => ({
      id: c.id,
      name: first(c.gbp_category)?.display_name ?? 'Uncategorized',
      is_primary: !!c.is_primary,
    }));

    return NextResponse.json({
      services,
      categories,
      brands: brandsRes.data || [],
      service_areas: areasRes.data || [],
    });
  } catch (error) {
    console.error('GET /api/job-snaps/attachment-targets failed:', error);
    return NextResponse.json(
      { error: 'Failed to load attachment targets' },
      { status: 500 }
    );
  }
}
