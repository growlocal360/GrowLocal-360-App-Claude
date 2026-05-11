import { createAdminClient } from '@/lib/supabase/admin';
import type { JobSnapWithRelations } from '@/types/database';

/**
 * Public Job Snap serializer.
 * ----------------------------------------------------------------------------
 * This is the source-of-truth payload for all customer integrations (webhook
 * subscribers, the public REST API, GBP publishing, schema markup, sitemap
 * generation, vector indexing, etc.). The GL360-generated SEO fields below
 * are AUTHORITATIVE — customer handlers should use them verbatim unless an
 * explicit override is configured.
 *
 * Privacy rules ENFORCED here:
 *   - `address_full` (with house numbers) is NEVER serialized
 *   - `client_name` (customer/family name) is NEVER serialized
 *   - `latitude`/`longitude` are NEVER serialized
 *
 * Forward compatibility: pre-migration-047 snaps have null naming fields.
 * Old fields (`title`, `description`, `location`, `media`) are preserved
 * unchanged so legacy webhook subscribers continue to work.
 */
export function serializeJobSnapPublic(snap: JobSnapWithRelations) {
  const supabase = createAdminClient();

  // Resolve primary extension (first image) for the canonical filename.
  const sortedMedia = (snap.media || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const primaryExt = inferExtension(sortedMedia[0]?.file_name || null);

  const media = sortedMedia.map((m, index) => {
    const { data } = supabase.storage.from('job-snap-media').getPublicUrl(m.storage_path);
    const ext = inferExtension(m.file_name) || primaryExt || 'jpg';
    const suggestedFilename = snap.image_filename_base
      ? `${snap.image_filename_base}-${index + 1}.${ext}`
      : null;
    return {
      url: data.publicUrl,
      // Suggested storage key for customer-side mirroring. Customer handlers
      // upload to their own bucket using this key for SEO-safe filenames.
      filename: suggestedFilename,
      alt: m.alt_text || snap.alt_text_default || snap.title || snap.ai_generated_title || 'Job photo',
      width: m.width,
      height: m.height,
      role: m.role,
    };
  });

  const titleFinal = snap.title || snap.ai_generated_title || null;
  const descriptionFinal = snap.description || snap.ai_generated_description || null;

  // Primary image filename for top-level convenience (the customer's mirror
  // typically renames the featured image when uploading).
  const primaryImageFilename =
    snap.image_filename_base && primaryExt
      ? `${snap.image_filename_base}-1.${primaryExt}`
      : null;

  return {
    // ── Identity ─────────────────────────────────────────────────────────
    id: snap.id,
    short_id: snap.short_id,

    // ── Generated SEO fields (GL360 = source of truth) ───────────────────
    // Customer integrations should use these directly without recomputing.
    slug: snap.slug,
    url_path: snap.url_path,
    meta_title: snap.meta_title,
    h1: snap.h1,
    meta_description: snap.meta_description,
    alt_text: snap.alt_text_default,
    image_filename: primaryImageFilename,
    public_location_label: snap.public_location_label,

    // ── Structured fields (for overrides + future indexing) ──────────────
    title: titleFinal,
    description: descriptionFinal,
    service_type: snap.service_type,
    brand: snap.brand,
    primary_problem: snap.primary_problem,
    equipment_type: snap.equipment_type,
    // NOTE: client_name is internal-only and intentionally absent here.

    location: {
      address: snap.address_public, // never address_full
      city: snap.city,
      state: snap.state,
      state_abbr: snap.state_abbr,
      zip: snap.zip,
      neighborhood: snap.neighborhood,
      street_name_public: snap.street_name_public,
    },

    // ── Media ────────────────────────────────────────────────────────────
    media,

    // ── Timestamps ───────────────────────────────────────────────────────
    published_at: snap.deployed_at || snap.updated_at,
    created_at: snap.created_at,
  };
}

export type PublicJobSnap = ReturnType<typeof serializeJobSnapPublic>;

function inferExtension(fileName: string | null): string | null {
  if (!fileName) return null;
  const match = fileName.match(/\.([a-zA-Z0-9]{1,5})$/);
  return match ? match[1].toLowerCase() : null;
}
