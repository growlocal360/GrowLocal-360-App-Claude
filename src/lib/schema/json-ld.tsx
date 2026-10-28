'use client';

import { useSiteNav } from '@/components/templates/site-nav';

interface JsonLdProps {
  data: Record<string, unknown> | (Record<string, unknown> | null)[];
}

// Keys whose string values are URLs in schema.org. Relative values ("/contact")
// are rewritten to absolute ones: Search Console flags relative ids in
// BreadcrumbList ("Invalid URL in field id") and other types prefer absolute.
const URL_KEYS = new Set(['item', 'url', '@id', 'mainEntityOfPage', 'image', 'logo', 'contentUrl', 'thumbnailUrl']);

function absolutize(value: unknown, base: string, key?: string): unknown {
  if (typeof value === 'string') {
    return key && URL_KEYS.has(key) && value.startsWith('/') && !value.startsWith('//') ? `${base}${value}` : value;
  }
  if (Array.isArray(value)) return value.map((v) => absolutize(v, base, key));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = absolutize(v, base, k);
    return out;
  }
  return value;
}

/** Renders one or more schema.org JSON-LD script tags. Filters out null entries. */
export function JsonLd({ data }: JsonLdProps) {
  const { siteUrl } = useSiteNav();
  const schemas = (Array.isArray(data) ? data : [data]).filter(Boolean) as Record<string, unknown>[];

  if (schemas.length === 0) return null;

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteUrl ? absolutize(schema, siteUrl) : schema) }}
        />
      ))}
    </>
  );
}
