import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteFormConfigProvider } from '@/components/templates/site-form-config';
import { SiteNavProvider, type SiteNav } from '@/components/templates/site-nav';
import { getStoredSitePlan, cityTreatmentByName } from '@/lib/sites/site-plan-store';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';
import type { SiteSettings } from '@/types/database';

export const metadata: Metadata = {
  title: {
    default: '',
    template: '%s',
  },
};

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // One lookup per request (same slug resolution as getSiteBySlug) for the
  // things every page shares: CTA / lead-form overrides and the footer nav.
  const supabase = createAdminClient();
  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug, settings, custom_domain, custom_domain_verified')
    .eq('slug', slug)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  const site = sites?.[0];
  const settings = (site?.settings || {}) as SiteSettings;

  // Absolute origin for schema.org URLs (Google rejects relative ids in BreadcrumbList).
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const siteUrl = site
    ? `https://${site.custom_domain_verified && site.custom_domain ? site.custom_domain : `${site.slug}.${appDomain}`}`
    : '';

  let nav: SiteNav = { services: [], areas: [], siteUrl };
  if (site?.id) {
    const [{ data: services }, { data: areas }, plan] = await Promise.all([
      supabase
        .from('services')
        .select('name, slug, site_category:site_categories(is_primary, gbp_category:gbp_categories(display_name))')
        .eq('site_id', site.id)
        .eq('is_active', true)
        .order('sort_order')
        .limit(12),
      supabase.from('service_areas').select('name').eq('site_id', site.id).order('sort_order').limit(12),
      getStoredSitePlan(site.id),
    ]);
    const treatment = plan ? cityTreatmentByName(plan) : null;
    nav = {
      siteUrl,
      services: (services || []).map((s) => {
        const cat = Array.isArray(s.site_category) ? s.site_category[0] : s.site_category;
        const gbp = cat ? (Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category) : null;
        const catSlug = gbp?.display_name ? normalizeCategorySlug(gbp.display_name) : undefined;
        return { name: s.name as string, href: paths.servicePage(s.slug as string, catSlug, cat?.is_primary ?? true) };
      }),
      // Cities link only when the Site Plan gave them a page; the rest are plain text
      // (same rule as /service-areas/). No plan (pre-v5 site) → text only.
      areas: (areas || []).map((a) => {
        const c = treatment?.get((a.name as string).trim().toLowerCase());
        return { name: a.name as string, href: c?.has_page ? c.page_url : null };
      }),
    };
  }

  return (
    <SiteFormConfigProvider
      value={{
        ctaText: settings.cta_text || null,
        formHeading: settings.form_heading || null,
        formSubheading: settings.form_subheading || null,
        formServiceOptions: settings.form_service_options?.length ? settings.form_service_options : null,
      }}
    >
      <SiteNavProvider value={nav}>{children}</SiteNavProvider>
    </SiteFormConfigProvider>
  );
}
