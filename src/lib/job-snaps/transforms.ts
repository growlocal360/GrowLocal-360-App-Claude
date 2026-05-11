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
  technician_name: string | null;
  technician_title: string | null;
  technician_avatar_url: string | null;
  performed_at: string | null;
}

/**
 * Maps a JobSnapWithRelations to a work_item insert payload.
 *
 * Generated SEO fields on the snap (set by the naming engine in
 * `src/lib/job-snaps/naming.ts`) are AUTHORITATIVE — they flow directly
 * into the work_item without recomputation. Legacy snaps with null naming
 * fields fall back to the original on-render computation below.
 *
 * Privacy rules enforced:
 * - address_street_name uses snap.street_name_public (preferred) or address_public
 * - address_full is never included
 */
export function jobSnapToWorkItemPayload(
  snap: JobSnapWithRelations,
  slug: string,
  mediaImages: WorkItemImage[]
): WorkItemInsertPayload {
  const title = snap.title || snap.ai_generated_title || 'Job Snap';
  const description = snap.description || snap.ai_generated_description || null;

  // ── Prefer naming-engine values; fall back for legacy snaps ─────────────
  const locationTag = [snap.city, snap.state_abbr || snap.state].filter(Boolean).join(', ');
  const serviceTag = snap.service_type || snap.service?.name || null;
  const fallbackMetaTitle =
    [title, serviceTag, locationTag].filter(Boolean).join(' | ').slice(0, 120) || null;
  const fallbackMetaDescription = description
    ? description.slice(0, 160)
    : [serviceTag, locationTag].filter(Boolean).join(' in ').slice(0, 160) || null;

  const metaTitle = snap.meta_title || fallbackMetaTitle;
  const metaDescription = snap.meta_description || fallbackMetaDescription;
  const h1 = snap.h1 || title;

  // Summary: prefer first sentence of description; legacy fallback.
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

  // Street name: prefer the snap's pre-sanitized form.
  const streetName =
    snap.street_name_public ||
    (snap.address_public ? snap.address_public.split(',')[0]?.trim() || null : null);

  // Brand slug: slugify brand name for URL use.
  const brandSlug = snap.brand ? slugifyTitle(snap.brand) : null;

  return {
    site_id: snap.site_id,
    status: 'published',
    slug,
    title,
    h1,
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
    // Technician snapshot — denormalized for fast public-page rendering.
    technician_name: snap.technician?.full_name ?? null,
    technician_title: snap.technician?.title ?? null,
    technician_avatar_url: snap.technician?.avatar_url ?? null,
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
  topicType: 'STANDARD';
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
 *
 * Prefers the naming engine's outputs (snap.h1 / snap.meta_description)
 * when present — keeps GBP, website, and webhook copy consistent.
 *
 * Max 1500 chars; aim for 300–500 for readability.
 */
export function toGbpPostSummary(snap: JobSnapWithRelations): string {
  const title = snap.title || snap.ai_generated_title || '';
  const desc = snap.description || snap.ai_generated_description || '';
  const locationTag = [snap.city, snap.state_abbr || snap.state].filter(Boolean).join(', ');
  const serviceTag = snap.service_type || snap.service?.name || '';

  const parts: string[] = [];

  // Prefer naming-engine H1 as the leading sentence (SEO-tuned).
  if (snap.h1) {
    parts.push(snap.h1.replace(/\.+$/, '') + '.');
  } else if (title) {
    parts.push(title.replace(/\.+$/, '') + '.');
  }

  // Service + location context (skipped if already encoded in H1 above).
  if (!snap.h1) {
    if (serviceTag && locationTag) parts.push(`${serviceTag} in ${locationTag}.`);
    else if (locationTag) parts.push(`Job completed in ${locationTag}.`);
  }

  // Body: prefer the engine's meta_description; fall back to first 2 sentences.
  const body = snap.meta_description || desc;
  if (body) {
    if (snap.meta_description) {
      parts.push(body);
    } else {
      const sentences = body.match(/[^.!?]+[.!?]+/g) || [body];
      parts.push(sentences.slice(0, 2).join(' ').trim());
    }
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
    topicType: 'STANDARD',
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
