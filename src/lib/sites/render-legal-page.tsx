import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getTemplate } from '@/lib/templates/registry';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicAreaListing } from '@/lib/sites/public-render-model';
import { defaultPrivacyPolicy, defaultTermsOfService, type LegalContext } from '@/lib/sites/legal-defaults';

export type LegalPageType = 'privacy' | 'terms';

function siteDomain(slug: string, site: { custom_domain?: string | null; custom_domain_verified?: boolean | null }) {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  return site.custom_domain_verified && site.custom_domain ? site.custom_domain : `${slug}.${appDomain}`;
}

/** Resolve the legal page's content: the owner's edited row, else the generated default. */
export async function getLegalContent(slug: string, kind: LegalPageType) {
  const data = await getSiteBySlug(slug);
  if (!data) return null;
  const domain = siteDomain(slug, data.site);
  const ctx: LegalContext = {
    businessName: data.site.name,
    domain,
    phone: (data.site.settings as { phone?: string } | null)?.phone || data.primaryLocation?.phone || null,
    email: (data.site.settings as { email?: string } | null)?.email || null,
    city: data.primaryLocation?.city || null,
    state: data.primaryLocation?.state || null,
  };
  const fallback = kind === 'privacy' ? defaultPrivacyPolicy(ctx) : defaultTermsOfService(ctx);
  const row = data.sitePages?.find((p) => p.page_type === kind) || null;
  return {
    data,
    domain,
    h1: row?.h1 || fallback.h1,
    body: row?.body_copy || fallback.body,
    metaTitle: row?.meta_title || `${fallback.h1} | ${data.site.name}`,
    metaDescription: row?.meta_description || `${fallback.h1} for ${data.site.name}.`,
    updatedAt: row?.updated_at || null,
  };
}

export async function legalMetadata(slug: string, kind: LegalPageType): Promise<Metadata> {
  const c = await getLegalContent(slug, kind);
  if (!c) return { title: 'Site Not Found' };
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `https://${c.domain}/${kind}` },
    robots: { index: true, follow: true },
  };
}

export async function renderLegalPage(slug: string, kind: LegalPageType) {
  const c = await getLegalContent(slug, kind);
  if (!c) notFound();
  const { data } = c;
  const { categories } = await getCategoriesWithServices(data.site.id);
  const navCategories: NavCategory[] = categories.map((cat) => ({
    id: cat.id,
    name: cat.gbp_category.display_name,
    slug: normalizeCategorySlug(cat.gbp_category.display_name),
    isPrimary: cat.is_primary,
  }));
  const Legal = getTemplate(data.site.template_id).Legal;
  return (
    <Legal
      site={toPublicSite(data.site, { hasBrands: (data.brands || []).length > 0 })}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
      kind={kind}
      h1={c.h1}
      body={c.body}
      updatedAt={c.updatedAt}
    />
  );
}
