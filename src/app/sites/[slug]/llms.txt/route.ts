import { NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';

/**
 * GET /llms.txt
 *
 * Structured summary of the site for LLM crawlers (GPTBot, Claude-Web, etc.).
 * Returns plain text describing the business, services, and contact info.
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

  const { categories, services } = await getCategoriesWithServices(site.id);

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

  if (phone) lines.push(`- Phone: ${phone}`);
  if (site.settings?.email) lines.push(`- Email: ${site.settings.email}`);
  if (primaryLocation) {
    lines.push(`- Address: ${primaryLocation.address_line1}, ${city}, ${state} ${primaryLocation.zip_code}`);
  }

  // Services
  if (services.length > 0) {
    lines.push('', '## Services');
    const catMap = new Map(categories.map(c => [c.id, c.gbp_category.display_name]));
    for (const service of services) {
      const catName = service.site_category_id ? catMap.get(service.site_category_id) : null;
      lines.push(`- ${service.name}${catName ? ` (${catName})` : ''}`);
    }
  }

  // Service areas
  if (serviceAreas.length > 0) {
    lines.push('', '## Service Areas');
    lines.push(serviceAreas.map(a => a.name).join(', '));
  }

  // Key pages
  lines.push(
    '',
    '## Pages',
    `- Home: ${siteUrl}`,
    `- About: ${siteUrl}/about`,
    `- Contact: ${siteUrl}/contact`,
    `- Services: ${siteUrl}/services`,
    `- FAQ: ${siteUrl}/faq`,
    `- Recent Work: ${siteUrl}/work`,
  );

  if (data.brands.length > 0) {
    lines.push(`- Brands: ${siteUrl}/brands`);
  }

  const content = lines.join('\n') + '\n';

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
