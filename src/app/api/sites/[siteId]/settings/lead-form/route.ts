import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import type { SiteSettings } from '@/types/database';

const MAX_LABEL = 40;
const MAX_SUBHEADING = 80;
const MAX_OPTIONS = 40;
const MAX_OPTION_LENGTH = 80;

// GET - current CTA / lead form overrides, plus the categories and services the
// owner can pick dropdown options from.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createAdminClient();
  const [{ data: site, error }, { data: categories }, { data: services }] = await Promise.all([
    admin.from('sites').select('settings').eq('id', siteId).single(),
    admin
      .from('site_categories')
      .select('is_primary, sort_order, gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false })
      .order('sort_order'),
    admin.from('services').select('name').eq('site_id', siteId).eq('is_active', true).order('sort_order'),
  ]);

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const settings = (site.settings || {}) as SiteSettings;
  const categoryNames = (categories || [])
    .map((c) => {
      const gbp = Array.isArray(c.gbp_category) ? c.gbp_category[0] : c.gbp_category;
      return gbp?.display_name as string | undefined;
    })
    .filter((n): n is string => !!n);

  return NextResponse.json({
    ctaText: settings.cta_text || '',
    formHeading: settings.form_heading || '',
    formSubheading: settings.form_subheading || '',
    serviceOptions: settings.form_service_options || [],
    available: {
      categories: categoryNames,
      services: (services || []).map((s) => s.name as string).filter(Boolean),
    },
  });
}

// PATCH - update overrides. Empty string / empty array restores the default.
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

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ctaText?: string;
    formHeading?: string;
    formSubheading?: string;
    serviceOptions?: string[];
  };

  const current = (site.settings || {}) as SiteSettings;
  const updated: SiteSettings = { ...current };

  if (typeof body.ctaText === 'string') updated.cta_text = body.ctaText.trim().slice(0, MAX_LABEL);
  if (typeof body.formHeading === 'string') updated.form_heading = body.formHeading.trim().slice(0, MAX_LABEL);
  if (typeof body.formSubheading === 'string') {
    updated.form_subheading = body.formSubheading.trim().slice(0, MAX_SUBHEADING);
  }
  if (Array.isArray(body.serviceOptions)) {
    const seen = new Set<string>();
    updated.form_service_options = body.serviceOptions
      .filter((o): o is string => typeof o === 'string')
      .map((o) => o.trim().slice(0, MAX_OPTION_LENGTH))
      .filter((o) => {
        const key = o.toLowerCase();
        if (!o || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_OPTIONS);
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from('sites')
    .update({ settings: updated, updated_at: new Date().toISOString() })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update lead form settings:', updateError);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  // The CTA label and form appear on every page.
  await revalidateSite(siteId);

  return NextResponse.json({
    success: true,
    ctaText: updated.cta_text || '',
    formHeading: updated.form_heading || '',
    formSubheading: updated.form_subheading || '',
    serviceOptions: updated.form_service_options || [],
  });
}
