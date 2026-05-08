import type { PublicJobSnap } from '@/lib/api-keys/serialize-snap';
import type { HLBlogPostInput } from './client';

interface SnapToBlogPostArgs {
  snap: PublicJobSnap;
  locationId: string;
  blogId: string;
  /** Optional URL prefix override; defaults to "work". */
  urlPrefix?: string;
}

/**
 * Convert a published Job Snap into a HighLevel Blog Post payload.
 *
 * - Builds an HTML body that embeds all photos plus the AI-generated
 *   description and location text. Photos use loading="lazy" and have
 *   alt attributes for accessibility/SEO.
 * - Slug strategy: slugify the title, fall back to snap id if title is
 *   missing. HL stores slugs under `urlSlug` and renders pages at
 *   /<urlPrefix>/<urlSlug>.
 * - Tags pulled from service_type + brand for content discoverability.
 */
export function snapToBlogPost(args: SnapToBlogPostArgs): HLBlogPostInput {
  const { snap, locationId, blogId, urlPrefix = 'work' } = args;

  const title = (snap.title || 'Job').toString().trim();
  const description = (snap.description || '').toString().trim();
  const slug = slugify(title) || `job-${snap.id.slice(0, 8)}`;

  const featured = snap.media?.[0];
  const tags: string[] = [];
  if (snap.service_type) tags.push(String(snap.service_type));
  if (snap.brand) tags.push(String(snap.brand));

  return {
    blogId,
    locationId,
    title,
    description: description.slice(0, 300), // HL meta description cap
    rawHTML: buildHtmlBody(snap, urlPrefix),
    imageUrl: featured?.url || undefined,
    imageAltText: featured?.alt || title,
    urlSlug: `${urlPrefix}/${slug}`,
    status: 'PUBLISHED',
    publishedAt: snap.published_at || new Date().toISOString(),
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Build the rich HTML body for the blog post. Includes:
 *   - Hero image (first photo)
 *   - Description paragraph
 *   - Additional photos (if multiple)
 *   - Location footer
 */
function buildHtmlBody(snap: PublicJobSnap, _urlPrefix: string): string {
  const photos = snap.media || [];
  const description = (snap.description || '').toString();
  const locText = [snap.location?.city, snap.location?.state]
    .filter(Boolean)
    .join(', ');

  const parts: string[] = [];

  // Description
  if (description) {
    parts.push(`<p>${escapeHTML(description)}</p>`);
  }

  // Additional photos (skip the first since HL uses it as featured image)
  if (photos.length > 1) {
    parts.push('<div class="jobsnaps-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin:1.5rem 0;">');
    for (let i = 1; i < photos.length; i++) {
      const p = photos[i];
      const alt = p.alt || snap.title || 'Job photo';
      parts.push(
        `<img src="${escapeAttr(p.url)}" alt="${escapeAttr(alt)}" loading="lazy" style="width:100%;height:auto;border-radius:8px;" />`
      );
    }
    parts.push('</div>');
  }

  // Location footer
  if (locText) {
    parts.push(
      `<p style="color:#6b7280;font-size:0.9rem;margin-top:2rem;">📍 ${escapeHTML(locText)}</p>`
    );
  }

  return parts.join('\n');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHTML(s);
}
