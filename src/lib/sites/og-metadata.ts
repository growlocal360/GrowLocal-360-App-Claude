import type { Metadata } from 'next';

/**
 * Builds Open Graph and Twitter Card metadata for public site pages.
 * Merges with existing metadata fields (title, description, alternates).
 */
export function withOpenGraph(
  base: Metadata,
  options: {
    url: string;
    siteName: string;
    logoUrl?: string | null;
    imageUrl?: string | null;
    type?: 'website' | 'article';
  }
): Metadata {
  const title = typeof base.title === 'string' ? base.title : (base.title as { default?: string })?.default || '';
  const description = typeof base.description === 'string' ? base.description : '';
  const ogImage = options.imageUrl || options.logoUrl || undefined;

  return {
    ...base,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      url: options.url,
      siteName: options.siteName,
      type: options.type || 'website',
      locale: 'en_US',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/**
 * Resolves the site's OG image URL.
 * Priority: explicit image > site logo > null
 */
export function getSiteOgImage(
  settings: { logo_url?: string } | null,
  explicitImage?: string | null
): string | null {
  if (explicitImage) return explicitImage;
  if (settings?.logo_url) return settings.logo_url;
  return null;
}
