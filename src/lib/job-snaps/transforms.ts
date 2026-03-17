/**
 * Transforms between the Job Snaps admin model and the public-facing data models.
 *
 * Job Snaps (job_snaps table) — admin workflow: capture, AI analysis, review, publish.
 * Work Items (work_items table) — public portfolio entries read by /work/ routes.
 * GBP Posts — short-form content for Google Business Profile local posts.
 */

import type { JobSnapWithRelations } from '@/types/database';
import type { WorkItemImage } from '@/types/database';

// ─── Slug helpers ──────────────────────────────────────────────────────────────

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─── Website / Work Item transform ────────────────────────────────────────────

export interface WorkItemInsertPayload {
  site_id: string;
  status: 'published';
  slug: string;
  title: string;
  h1: string | null;
  meta_title: string | null;
  meta_description: string | null;
  summary: string | null;
  description: string | null;
  service_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  images: WorkItemImage[];
  address_street_name: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  performed_at: string | null;
}

/**
 * Maps a JobSnapWithRelations to a work_item insert payload.
 *
 * Privacy rules enforced:
 * - address_street_name uses address_public (house number stripped)
 * - address_full is never included
 */
export function jobSnapToWorkItemPayload(
  snap: JobSnapWithRelations,
  slug: string,
  mediaImages: WorkItemImage[]
): WorkItemInsertPayload {
  const title = snap.title || snap.ai_generated_title || 'Job Snap';
  const description = snap.description || snap.ai_generated_description || null;

  // Build SEO meta from title + service + location
  const locationTag = [snap.city, snap.state].filter(Boolean).join(', ');
  const serviceTag = snap.service_type || snap.service?.name || null;
  const metaParts = [title, serviceTag, locationTag].filter(Boolean);
  const metaTitle = metaParts.join(' | ').slice(0, 120) || null;
  const metaDescription = description
    ? description.slice(0, 160)
    : [serviceTag, locationTag].filter(Boolean).join(' in ').slice(0, 160) || null;

  // Summary: first 200 chars of description, ending at a sentence boundary if possible
  let summary: string | null = null;
  if (description) {
    if (description.length <= 200) {
      summary = description;
    } else {
      const cut = description.slice(0, 200);
      const lastPeriod = cut.lastIndexOf('.');
      summary = lastPeriod > 100 ? cut.slice(0, lastPeriod + 1) : cut + '…';
    }
  }

  // address_public already has house number stripped (via toPublicAddress in save route)
  // Extract street name portion (everything before the first comma)
  const streetName = snap.address_public
    ? snap.address_public.split(',')[0]?.trim() || null
    : null;

  // Brand slug: slugify brand name for URL use
  const brandSlug = snap.brand ? slugifyTitle(snap.brand) : null;

  return {
    site_id: snap.site_id,
    status: 'published',
    slug,
    title,
    h1: title,
    meta_title: metaTitle,
    meta_description: metaDescription,
    summary,
    description,
    service_id: snap.service_id,
    brand_name: snap.brand,
    brand_slug: brandSlug,
    images: mediaImages,
    address_street_name: streetName,
    address_city: snap.city,
    address_state: snap.state,
    address_zip: snap.zip,
    performed_at: snap.created_at,
  };
}

// ─── GBP Local Post transform ─────────────────────────────────────────────────

/**
 * Google Business Profile Local Post payload contract.
 *
 * GBP Local Posts API (mybusiness.googleapis.com/v4):
 *   POST /{parent}/localPosts
 *
 * Summary field limit: 1500 characters.
 * Media: up to 1 photo via sourceUrl or mediaFormat: 'PHOTO'.
 *
 * NOTE: GBP posting is not yet implemented in gbp-client.ts.
 * This interface defines what WILL be sent once the client supports posting.
 */
export interface GbpPostPayload {
  languageCode: 'en-US';
  summary: string;
  callToAction?: {
    actionType: 'LEARN_MORE';
    url: string;
  };
  media?: {
    mediaFormat: 'PHOTO';
    sourceUrl: string;
  }[];
}

/**
 * Builds a GBP-friendly short post summary from a job snap.
 * GBP posts are closer to social copy than full page descriptions.
 * Max 1500 chars; aim for 300–500 for readability.
 */
export function toGbpPostSummary(snap: JobSnapWithRelations): string {
  const title = snap.title || snap.ai_generated_title || '';
  const desc = snap.description || snap.ai_generated_description || '';
  const locationTag = [snap.city, snap.state].filter(Boolean).join(', ');
  const serviceTag = snap.service_type || snap.service?.name || '';

  // Build: "Title. Service in City, State. First 1-2 sentences of description."
  const parts: string[] = [];
  if (title) parts.push(title + '.');
  if (serviceTag && locationTag) parts.push(`${serviceTag} in ${locationTag}.`);
  else if (locationTag) parts.push(`Job completed in ${locationTag}.`);

  if (desc) {
    // Take first 2 sentences of description
    const sentences = desc.match(/[^.!?]+[.!?]+/g) || [desc];
    const twoSentences = sentences.slice(0, 2).join(' ').trim();
    parts.push(twoSentences);
  }

  const combined = parts.join(' ').trim();
  return combined.length > 1500 ? combined.slice(0, 1497) + '…' : combined;
}

/**
 * Builds a complete GBP Local Post payload from a job snap.
 * The publicUrl should be the full public URL to the work detail page.
 * The primaryImageUrl is the public storage URL of the first/primary image.
 */
export function toGbpPostPayload(
  snap: JobSnapWithRelations,
  publicUrl: string,
  primaryImageUrl?: string
): GbpPostPayload {
  const payload: GbpPostPayload = {
    languageCode: 'en-US',
    summary: toGbpPostSummary(snap),
    callToAction: {
      actionType: 'LEARN_MORE',
      url: publicUrl,
    },
  };

  if (primaryImageUrl) {
    payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: primaryImageUrl }];
  }

  return payload;
}
