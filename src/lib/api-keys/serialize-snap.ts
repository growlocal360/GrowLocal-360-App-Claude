import { createAdminClient } from '@/lib/supabase/admin';
import type { JobSnapWithRelations } from '@/types/database';

/**
 * Convert a job_snap row (with media + service joined) into the public API
 * shape served to external customers via /api/v1/job-snaps.
 *
 * IMPORTANT: address_full is INTERNAL ONLY — never include it. Only
 * address_public, city, state, zip are exposed.
 */
export function serializeJobSnapPublic(snap: JobSnapWithRelations) {
  const supabase = createAdminClient();

  const media = (snap.media || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => {
      const { data } = supabase.storage.from('job-snap-media').getPublicUrl(m.storage_path);
      return {
        url: data.publicUrl,
        alt: m.alt_text || snap.title || snap.ai_generated_title || 'Job photo',
        width: m.width,
        height: m.height,
        role: m.role,
      };
    });

  return {
    id: snap.id,
    title: snap.title || snap.ai_generated_title,
    description: snap.description || snap.ai_generated_description,
    service_type: snap.service_type,
    brand: snap.brand,
    location: {
      address: snap.address_public,
      city: snap.city,
      state: snap.state,
      zip: snap.zip,
    },
    media,
    published_at: snap.deployed_at || snap.updated_at,
    created_at: snap.created_at,
  };
}

export type PublicJobSnap = ReturnType<typeof serializeJobSnapPublic>;
