import { NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/sites/get-site';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = data?.site.custom_domain || `${slug}.${appDomain}`;

  let content: string;

  if (!data || data.site.status !== 'active') {
    content = `User-agent: *\nDisallow: /\n`;
  } else {
    content = [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: https://${domain}/sitemap.xml`,
      '',
    ].join('\n');
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
