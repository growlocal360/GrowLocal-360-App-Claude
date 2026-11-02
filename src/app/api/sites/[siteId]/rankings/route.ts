import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import { rankSettings, resolveKeywords, latestScans, resolveCenter } from '@/lib/rank/scan';
import { dataForSeoConfigured } from '@/lib/rank/dataforseo';
import { aiModelsAvailable, latestAiVisibility } from '@/lib/rank/ai-visibility';
import { GRID_SIZES, SPACINGS_MILES, MAX_KEYWORDS, cleanKeyword } from '@/lib/rank/grid';
import { getBalance, orgIdForSite, spendCredits, CREDIT_PACKS } from '@/lib/rank/credits';

/**
 * GET   -> settings (with resolved keywords), readiness, latest scan per keyword (+previous), AI visibility roll-up
 * PATCH -> { enabled?, keywords?, gridSize?, spacingMiles? }
 * POST  -> { keywords?: string[] } start a scan now (background; page polls GET)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const { data: site } = await admin.from('sites').select('settings, name').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const settings = rankSettings(site.settings);
  const orgId = await orgIdForSite(admin, siteId);
  const [keywords, scans, ai, center, balance] = await Promise.all([
    resolveKeywords(admin, siteId, settings),
    latestScans(admin, siteId),
    latestAiVisibility(admin, siteId),
    resolveCenter(admin, siteId),
    orgId ? getBalance(admin, orgId) : Promise.resolve(0),
  ]);
  return NextResponse.json({
    credits: { balance, perManualScan: keywords.length, packs: CREDIT_PACKS },
    settings: { ...settings, keywords, keywordsAreDefaults: settings.keywords.length === 0 },
    providerConfigured: dataForSeoConfigured(),
    aiModels: aiModelsAvailable(),
    hasCenter: !!center,
    center: center ? { lat: center.lat, lng: center.lng, city: center.city } : null,
    scans,
    ai,
    estimatedCostPerScan: Math.round(settings.gridSize * settings.gridSize * keywords.length * 0.002 * 100) / 100,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean; keywords?: string[]; gridSize?: number; spacingMiles?: number };
  const admin = createAdminClient();
  const { data: site } = await admin.from('sites').select('settings').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const settings = (site.settings || {}) as Record<string, unknown>;
  const automation = { ...((settings.automation as Record<string, unknown> | undefined) || {}) };
  const rt = { ...((automation.rank_tracking as Record<string, unknown> | undefined) || {}) };
  if (typeof body.enabled === 'boolean') rt.enabled = body.enabled;
  if (Array.isArray(body.keywords)) {
    const cleaned = Array.from(new Set(body.keywords.map((k) => cleanKeyword(String(k))).filter((k) => k.length >= 3))).slice(0, MAX_KEYWORDS);
    rt.keywords = cleaned;
  }
  if (typeof body.gridSize === 'number' && (GRID_SIZES as readonly number[]).includes(body.gridSize)) rt.grid_size = body.gridSize;
  if (typeof body.spacingMiles === 'number' && (SPACINGS_MILES as readonly number[]).includes(body.spacingMiles)) rt.spacing_miles = body.spacingMiles;
  automation.rank_tracking = rt;
  const { error } = await admin.from('sites').update({ settings: { ...settings, automation } }).eq('id', siteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: rankSettings({ ...settings, automation } as never) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!dataForSeoConfigured()) return NextResponse.json({ error: 'Rank tracking needs the DataForSEO account connected (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { keywords?: string[]; ai?: boolean };
  const admin = createAdminClient();
  const { data: site } = await admin.from('sites').select('settings, organization_id').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Manual scans spend one credit per keyword; the weekly scheduled scan is free.
  const settings = rankSettings(site.settings);
  const keywords = (body.keywords?.length ? body.keywords : await resolveKeywords(admin, siteId, settings)).slice(0, MAX_KEYWORDS);
  if (keywords.length === 0) return NextResponse.json({ error: 'Add at least one keyword first' }, { status: 400 });
  const spend = await spendCredits(admin, site.organization_id, keywords.length, 'manual_scan', siteId);
  if (!spend.ok) {
    return NextResponse.json({ error: `This scan needs ${keywords.length} credit${keywords.length === 1 ? '' : 's'} and you have ${spend.balance}. Buy credits or wait for the weekly scan.`, needCredits: keywords.length, balance: spend.balance }, { status: 402 });
  }

  await inngest.send({ name: 'rank/scan.requested', data: { siteId, keywords, ai: body.ai, charged: true } });
  return NextResponse.json({ ok: true, balance: spend.balance, charged: keywords.length });
}
