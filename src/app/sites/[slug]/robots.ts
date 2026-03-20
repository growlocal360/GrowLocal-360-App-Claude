import { MetadataRoute } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';

export default async function robots({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<MetadataRoute.Robots> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = data?.site.custom_domain || `${slug}.${appDomain}`;

  // Block indexing for non-active sites
  if (!data || data.site.status !== 'active') {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `https://${domain}/sitemap.xml`,
  };
}
