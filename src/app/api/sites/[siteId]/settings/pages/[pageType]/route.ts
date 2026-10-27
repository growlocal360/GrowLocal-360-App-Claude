import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import type { SitePageSections } from '@/types/database';
import { defaultPrivacyPolicy, defaultTermsOfService } from '@/lib/sites/legal-defaults';

const PAGE_TYPES = ['home', 'about', 'contact', 'privacy', 'terms'] as const;
type CorePageType = (typeof PAGE_TYPES)[number];

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;
const paragraphs = (v: unknown, max = 3000): string[] =>
  Array.isArray(v) ? v.map((p) => str(p, max)).filter((p): p is string => !!p) : [];
const items = (v: unknown, a: string, b: string, maxA = 120, maxB = 600) =>
  Array.isArray(v)
    ? v
        .map((it) => ({ [a]: str(it?.[a], maxA) || '', [b]: str(it?.[b], maxB) || '' }))
        .filter((it) => it[a])
    : [];

/**
 * Build the `sections` JSON for a core page from the editor payload. Only the
 * keys the templates read are kept; empty blocks are dropped so the template
 * falls back to its default for that block.
 */
function buildSections(pageType: CorePageType, s: Record<string, unknown> | undefined): SitePageSections | null {
  if (!s || typeof s !== 'object') return null;
  const out: SitePageSections = {};
  if (pageType === 'home') {
    const p = s.process as { heading?: unknown; steps?: unknown } | undefined;
    const steps = items(p?.steps, 'title', 'description', 60, 200) as { title: string; description: string }[];
    if (steps.length) out.process = { heading: str(p?.heading, 80) || 'How it works', steps: steps.slice(0, 3) };
    const w = s.why as { heading?: unknown; intro?: unknown; points?: unknown } | undefined;
    const points = items(w?.points, 'title', 'description', 60, 200) as { title: string; description: string }[];
    if (points.length) out.why = { heading: str(w?.heading, 80) || 'Why choose us', intro: str(w?.intro, 200) || '', points: points.slice(0, 3) };
  }
  if (pageType === 'about') {
    const block = (key: 'founder_story' | 'mission_values' | 'local_connection') => {
      const b = s[key] as { heading?: unknown; paragraphs?: unknown } | undefined;
      const ps = paragraphs(b?.paragraphs);
      if (ps.length) out[key] = { heading: str(b?.heading, 120) || '', paragraphs: ps };
    };
    block('founder_story'); block('mission_values'); block('local_connection');
    const ec = s.experience_credentials as { heading?: unknown; paragraphs?: unknown; highlights?: unknown } | undefined;
    const ecp = paragraphs(ec?.paragraphs);
    const hl = paragraphs(ec?.highlights, 120);
    if (ecp.length || hl.length) out.experience_credentials = { heading: str(ec?.heading, 120) || '', paragraphs: ecp, highlights: hl };
    const tp = s.trust_points as { heading?: unknown; points?: unknown } | undefined;
    const pts = items(tp?.points, 'title', 'description', 80, 300) as { title: string; description: string }[];
    if (pts.length) out.trust_points = { heading: str(tp?.heading, 120) || '', points: pts.slice(0, 6) };
    const cta = s.cta as { heading?: unknown; description?: unknown } | undefined;
    const ch = str(cta?.heading, 120);
    if (ch) out.cta = { heading: ch, description: str(cta?.description, 300) || '' };
  }
  return Object.keys(out).length ? out : null;
}

async function loadPage(siteId: string, pageType: CorePageType) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('site_pages')
    .select('*')
    .eq('site_id', siteId)
    .eq('page_type', pageType)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; pageType: string }> }) {
  const { siteId, pageType } = await params;
  if (!PAGE_TYPES.includes(pageType as CorePageType)) return NextResponse.json({ error: 'Unknown page' }, { status: 404 });
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const page = await loadPage(siteId, pageType as CorePageType);

  // Legal pages render generated boilerplate until the owner saves their own text;
  // hand the editor that default so it starts from something real.
  let defaults: { h1: string; body: string } | null = null;
  if (pageType === 'privacy' || pageType === 'terms') {
    const { data: siteRow } = await admin.from('sites').select('name, slug, settings, custom_domain, custom_domain_verified').eq('id', siteId).single();
    const { data: loc } = await admin.from('locations').select('city, state, phone').eq('site_id', siteId).eq('is_primary', true).limit(1).maybeSingle();
    const st = (siteRow?.settings || {}) as { phone?: string; email?: string };
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
    const ctx = {
      businessName: siteRow?.name || 'This business',
      domain: siteRow?.custom_domain_verified && siteRow?.custom_domain ? siteRow.custom_domain : `${siteRow?.slug}.${appDomain}`,
      phone: st.phone || loc?.phone || null,
      email: st.email || null,
      city: loc?.city || null,
      state: loc?.state || null,
    };
    defaults = pageType === 'privacy' ? defaultPrivacyPolicy(ctx) : defaultTermsOfService(ctx);
  }
  const toDashboardUrl = (u: string | null | undefined) =>
    u && u.startsWith('/public/assets/') ? `/api/sites/${siteId}/${u.replace('/public/', '')}` : u || null;
  return NextResponse.json({
    pageType,
    exists: !!page,
    h1: page?.h1 || defaults?.h1 || '',
    h2: page?.h2 || '',
    heroDescription: page?.hero_description || '',
    bodyCopy: page?.body_copy || defaults?.body || '',
    usingDefaults: !!defaults && !page?.body_copy,
    bodyCopy2: page?.body_copy_2 || '',
    metaTitle: page?.meta_title || '',
    metaDescription: page?.meta_description || '',
    sections: page?.sections || null,
    heroImageUrl: toDashboardUrl(page?.hero_image_url),
    generatedHeroUrl: Array.isArray(page?.generated_images) && page.generated_images[0]?.url ? page.generated_images[0].url : null,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageType: string }> }) {
  const { siteId, pageType } = await params;
  if (!PAGE_TYPES.includes(pageType as CorePageType)) return NextResponse.json({ error: 'Unknown page' }, { status: 404 });
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.h1 !== undefined) update.h1 = str(body.h1, 140);
  if (body.h2 !== undefined) update.h2 = str(body.h2, 160);
  if (body.heroDescription !== undefined) update.hero_description = str(body.heroDescription, 600);
  if (body.bodyCopy !== undefined) update.body_copy = str(body.bodyCopy, 8000);
  if (body.bodyCopy2 !== undefined) update.body_copy_2 = str(body.bodyCopy2, 4000);
  if (body.metaTitle !== undefined) update.meta_title = str(body.metaTitle, 70);
  if (body.metaDescription !== undefined) update.meta_description = str(body.metaDescription, 200);
  if (body.sections !== undefined) update.sections = buildSections(pageType as CorePageType, body.sections as Record<string, unknown> | undefined);
  if (body.heroImageUrl !== undefined) {
    const v = body.heroImageUrl;
    const m = typeof v === 'string' ? v.match(/^\/api\/sites\/[^/]+\/(.+)$/) : null;
    update.hero_image_url = v ? (m ? `/public/${m[1]}` : v) : null;
  }

  const admin = createAdminClient();
  const existing = await loadPage(siteId, pageType as CorePageType);
  const { error } = existing
    ? await admin.from('site_pages').update(update).eq('id', existing.id)
    : await admin.from('site_pages').insert({ site_id: siteId, page_type: pageType, slug: pageType, is_active: true, ...update });
  if (error) {
    console.error('Failed to update page content:', error);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
  await revalidateSite(siteId);
  return NextResponse.json({ success: true });
}
