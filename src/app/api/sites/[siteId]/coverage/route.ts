import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/coverage
 * Public — returns the lowercased city names a site covers (service areas +
 * primary market + physical location cities). The intake form uses this to give
 * a SOFT out-of-area heads-up (it never blocks submission). Only exposes city
 * names, which are already public on the site.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;
  const supabase = createAdminClient();

  const [areasRes, siteRes, locsRes] = await Promise.all([
    supabase.from('service_areas').select('name').eq('site_id', siteId),
    supabase.from('sites').select('settings').eq('id', siteId).single(),
    supabase.from('locations').select('city').eq('site_id', siteId),
  ]);

  const cities = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) cities.add(v.trim().toLowerCase());
  };

  for (const a of areasRes.data || []) add(a.name);
  for (const l of locsRes.data || []) add(l.city);
  const settings = (siteRes.data?.settings || {}) as Record<string, unknown>;
  add(settings.primary_market_city);

  return NextResponse.json({ cities: Array.from(cities) });
}
