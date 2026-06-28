import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import type { SiteSettings } from '@/types/database';

const TRAVEL_STRATEGIES = ['local', 'regional', 'metro', 'multi-market'] as const;
type TravelStrategy = (typeof TRAVEL_STRATEGIES)[number];

// GET — current Primary Market config + the choices a picker needs.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createAdminClient();
  const [{ data: site }, { data: location }, { data: areas }] = await Promise.all([
    admin.from('sites').select('settings, website_type').eq('id', siteId).single(),
    admin.from('locations').select('city, state').eq('site_id', siteId).eq('is_primary', true).maybeSingle(),
    admin.from('service_areas').select('name, state').eq('site_id', siteId).order('sort_order'),
  ]);

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const s = (site.settings || {}) as SiteSettings;

  // Candidate cities for the picker: the primary location + every service area.
  const candidates: { city: string; state: string | null }[] = [];
  if (location?.city) candidates.push({ city: location.city, state: location.state });
  for (const a of areas || []) {
    if (a.name && !candidates.some((c) => c.city.toLowerCase() === a.name.toLowerCase())) {
      candidates.push({ city: a.name, state: a.state });
    }
  }

  return NextResponse.json({
    travelStrategy: s.travel_strategy ?? null,
    primaryMarketCity: s.primary_market_city ?? null,
    primaryMarketState: s.primary_market_state ?? null,
    primaryMarketSource: s.primary_market_source ?? null,
    homepageIsPrimaryMarket: s.homepage_is_primary_market === true,
    websiteType: site.website_type,
    candidates,
  });
}

// PATCH — update Primary Market / travel strategy / homepage model.
// Structural change: callers should confirm the GBP-ranking warning first, then
// regenerate the site for it to take effect.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => ({}));
  const { travelStrategy, primaryMarketCity, primaryMarketState, homepageIsPrimaryMarket } = body as {
    travelStrategy?: string;
    primaryMarketCity?: string;
    primaryMarketState?: string;
    homepageIsPrimaryMarket?: boolean;
  };

  if (travelStrategy !== undefined && !TRAVEL_STRATEGIES.includes(travelStrategy as TravelStrategy)) {
    return NextResponse.json(
      { error: `Invalid travel strategy. Use one of: ${TRAVEL_STRATEGIES.join(', ')}` },
      { status: 400 }
    );
  }
  if (primaryMarketCity !== undefined && (typeof primaryMarketCity !== 'string' || !primaryMarketCity.trim())) {
    return NextResponse.json({ error: 'Primary market city cannot be empty' }, { status: 400 });
  }
  if (homepageIsPrimaryMarket !== undefined && typeof homepageIsPrimaryMarket !== 'boolean') {
    return NextResponse.json({ error: 'homepageIsPrimaryMarket must be a boolean' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: site, error: siteError } = await admin
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single();
  if (siteError || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const current = (site.settings || {}) as Record<string, unknown>;
  const updated: Record<string, unknown> = { ...current };
  if (travelStrategy !== undefined) updated.travel_strategy = travelStrategy;
  if (primaryMarketCity !== undefined) {
    updated.primary_market_city = primaryMarketCity.trim();
    updated.primary_market_source = 'user_input';
  }
  if (primaryMarketState !== undefined) updated.primary_market_state = (primaryMarketState || '').trim() || null;
  if (homepageIsPrimaryMarket !== undefined) updated.homepage_is_primary_market = homepageIsPrimaryMarket;

  const { error: updateError } = await admin.from('sites').update({ settings: updated }).eq('id', siteId);
  if (updateError) {
    return NextResponse.json({ error: 'Failed to save Primary Market settings' }, { status: 500 });
  }

  await revalidateSite(siteId);

  return NextResponse.json({
    success: true,
    // The plan + content only restructure on a regenerate.
    requiresRegenerate: true,
    travelStrategy: updated.travel_strategy ?? null,
    primaryMarketCity: updated.primary_market_city ?? null,
    primaryMarketState: updated.primary_market_state ?? null,
    homepageIsPrimaryMarket: updated.homepage_is_primary_market === true,
  });
}
