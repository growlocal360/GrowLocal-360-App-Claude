import { NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { profileLinks } from '@/lib/sites/profiles';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getStoredSitePlan, cityTreatmentByName, isV6Plan } from '@/lib/sites/site-plan-store';

/**
 * GET /llms.txt
 *
 * Structured summary of the site for LLM crawlers (GPTBot, Claude-Web, etc.).
 * Follows llmstxt.org: H1, blockquote summary, then H2 sections of markdown
 * link lists — crawlers (and Lighthouse's agentic audit) look for the links.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return new NextResponse('# Site not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { site, primaryLocation, serviceAreas } = data;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const siteUrl = `https://${domain}`;

  const [{ categories, services }, sitePlan] = await Promise.all([
    getCategoriesWithServices(site.id),
    getStoredSitePlan(site.id),
  ]);

  const city = primaryLocation?.city || '';
  const state = primaryLocation?.state || '';
  const phone = site.settings?.phone || primaryLocation?.phone || '';

  const lines: string[] = [
    `# ${site.name}`,
    '',
    `> ${site.name} is a local service business${city ? ` based in ${city}, ${state}` : ''}.`,
    '',
    `## Contact`,
    `- Website: ${siteUrl}`,
  ];

  if (phone) lines.push(`- [Call ${phone}](tel:${phone.replace(/\D/g, '')})`);
  if (site.settings?.email) lines.push(`- [Email ${site.settings.email}](mailto:${site.settings.email})`);
  if (primaryLocation) {
    lines.push(`- Address: ${primaryLocation.address_line1}, ${city}, ${state} ${primaryLocation.zip_code}`);
  }

  // Services
  if (services.length > 0) {
    lines.push('', '## Services');
    // Same URL rule as the sitemap: primary-category services sit flat at root,
    // secondary categories are hubs with their services beneath.
    const catMap = new Map(categories.map(c => [c.id, { name: c.gbp_category.display_name, slug: normalizeCategorySlug(c.gbp_category.display_name), isPrimary: c.is_primary }]));
    for (const cat of categories.filter(c => !c.is_primary)) {
      lines.push(`- [${cat.gbp_category.display_name}](${siteUrl}/${normalizeCategorySlug(cat.gbp_category.display_name)})`);
    }
    for (const service of services) {
      const cat = service.site_category_id ? catMap.get(service.site_category_id) : null;
      const path = cat && !cat.isPrimary ? `/${cat.slug}/${service.slug}` : `/${service.slug}`;
      lines.push(`- [${service.name}](${siteUrl}${path})${cat ? `: ${cat.name}` : ''}`);
    }
  }

  // Service areas
  if (serviceAreas.length > 0) {
    lines.push('', '## Service Areas', `- [All areas we serve](${siteUrl}/service-areas)`);
    // A town links to its page when the Site Plan gave it one; otherwise it is a mention.
    const treatment = isV6Plan(sitePlan) && sitePlan ? cityTreatmentByName(sitePlan) : null;
    for (const a of serviceAreas) {
      const c = treatment?.get(a.name.trim().toLowerCase());
      const path = treatment
        ? (c?.has_page && c.page_url && c.page_url !== '/' ? c.page_url.replace(/\/$/, '') : null)
        : `/service-areas/${a.slug}`;
      lines.push(path ? `- [${a.name}](${siteUrl}${path})` : `- ${a.name}`);
    }
  }

  // Key pages
  lines.push(
    '',
    '## Pages',
    `- [Home](${siteUrl}): ${site.name}${city ? ` in ${city}, ${state}` : ''}`,
    `- [About](${siteUrl}/about)`,
    `- [Contact](${siteUrl}/contact)`,
    `- [Book an appointment / request an estimate](${siteUrl}/book)`,
    `- [Services](${siteUrl}/services)`,
    `- [FAQ](${siteUrl}/faq)`,
    `- [Recent Work](${siteUrl}/work)`,
    `- [Reviews](${siteUrl}/reviews)`,
  );

  if (data.brands.length > 0) {
    lines.push(`- [Brands](${siteUrl}/brands)`);
  }

  const profiles = profileLinks((site.settings as { profiles?: Parameters<typeof profileLinks>[0] } | null)?.profiles);
  if (profiles.length > 0) {
    lines.push('', '## Profiles', `The same business on other platforms:`);
    for (const p of profiles) lines.push(`- [${p.label}](${p.url})`);
  }

  const content = lines.join('\n') + '\n';

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
