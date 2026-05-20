import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPublicAddress } from '@/lib/job-snaps/address';
import { computeJobSnapNaming } from '@/lib/job-snaps/naming';

// Allow large bodies for base64-encoded images (up to 4 × 20MB)
export const maxDuration = 60;

interface SaveImageInput {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml';
  fileName: string;
  role?: 'primary' | 'before' | 'after' | 'process' | 'detail';
  sortOrder: number;
}

interface SaveLocationInput {
  addressFull: string;
  addressPublic?: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  source: 'exif' | 'device' | 'manual';
}

interface SaveRequest {
  siteId: string;
  title?: string;
  description?: string;
  aiGeneratedTitle?: string;
  aiGeneratedDescription?: string;
  serviceType?: string | null;
  serviceId?: string | null;
  brand?: string | null;
  /** Structured fields feeding the SEO naming engine. */
  primaryProblem?: string | null;
  equipmentType?: string | null;
  neighborhood?: string | null;
  clientName?: string | null;
  /** Technician credited for the work (defaults to uploader's profile when unset). */
  technicianId?: string | null;
  /**
   * Multi-attachment targets. The snap will appear on the public page for
   * every selected service, category, brand, and area. service_id remains
   * the "primary" service for legacy compatibility (defaults to the first
   * selected service when present).
   */
  attachments?: {
    service_ids?: string[];
    category_ids?: string[];
    brand_ids?: string[];
    area_ids?: string[];
  } | null;
  location?: SaveLocationInput | null;
  images: SaveImageInput[];
}

/**
 * Build job_snap_attachments insert rows from a SaveRequest.attachments
 * object. Each target_type → target_id pair becomes one row. De-duplicates
 * across types via a Set keyed by `${type}:${id}`.
 */
function buildAttachmentRows(
  jobSnapId: string,
  siteId: string,
  attachments: SaveRequest['attachments']
): Array<{ job_snap_id: string; site_id: string; target_type: string; target_id: string }> {
  if (!attachments) return [];
  const seen = new Set<string>();
  const rows: Array<{ job_snap_id: string; site_id: string; target_type: string; target_id: string }> = [];

  const push = (type: 'service' | 'category' | 'brand' | 'service_area', id: string) => {
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ job_snap_id: jobSnapId, site_id: siteId, target_type: type, target_id: id });
  };

  (attachments.service_ids || []).forEach((id) => push('service', id));
  (attachments.category_ids || []).forEach((id) => push('category', id));
  (attachments.brand_ids || []).forEach((id) => push('brand', id));
  (attachments.area_ids || []).forEach((id) => push('service_area', id));
  return rows;
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mimeType] ?? 'jpg';
}

/**
 * POST /api/job-snaps/save
 *
 * Uploads images to Supabase storage, inserts a job_snaps record and
 * associated job_snap_media rows. Returns the new jobSnapId for redirect.
 */
export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SaveRequest;

    // ── Validate ────────────────────────────────────────────────────────────
    if (!body.siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }
    if (!body.images || body.images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }
    if (body.images.length > 4) {
      return NextResponse.json({ error: 'Maximum 4 images allowed' }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── Org access check ────────────────────────────────────────────────────
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    const { data: site } = await admin
      .from('sites')
      .select('id, organization_id')
      .eq('id', body.siteId)
      .single();

    if (!site || site.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 });
    }

    // ── Build address fields ────────────────────────────────────────────────
    const loc = body.location;
    const addressPublic = loc
      ? (loc.addressPublic || toPublicAddress({
          address: loc.addressFull,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
        }))
      : null;

    // ── Pre-load existing slugs for collision detection ─────────────────────
    const { data: existingSlugRows } = await admin
      .from('job_snaps')
      .select('slug')
      .eq('site_id', body.siteId)
      .not('slug', 'is', null);
    const siteExistingSlugs = new Set<string>(
      (existingSlugRows || []).map((r: { slug: string | null }) => r.slug || '').filter(Boolean)
    );

    // ── Compute canonical SEO naming (source of truth across all channels) ──
    // GL360-generated SEO fields are authoritative. Customer integrations
    // consume these fields verbatim unless an explicit override is configured.
    const naming = computeJobSnapNaming(
      {
        title: body.title ?? body.aiGeneratedTitle ?? null,
        description: body.description ?? body.aiGeneratedDescription ?? null,
        service_type: body.serviceType ?? null,
        brand: body.brand ?? null,
        primary_problem: body.primaryProblem ?? null,
        equipment_type: body.equipmentType ?? null,
        city: loc?.city ?? null,
        state: loc?.state ?? null,
        zip: loc?.zip ?? null,
        neighborhood: body.neighborhood ?? null,
        address_public: addressPublic,
      },
      { siteExistingSlugs }
    );

    // ── Pre-generate snap UUID so storage paths can use it ──────────────────
    const snapId = crypto.randomUUID();

    // ── Upload images to storage (SEO-friendly filenames per naming engine) ─
    const uploadedPaths: string[] = [];

    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const ext = mimeToExt(img.mimeType);
      const fileName = `${naming.image_filename_base}-${i + 1}.${ext}`;
      const storagePath = `${body.siteId}/${snapId}/${fileName}`;

      const buffer = Buffer.from(img.base64, 'base64');

      const { error: uploadError } = await admin.storage
        .from('job-snap-media')
        .upload(storagePath, buffer, {
          contentType: img.mimeType,
          upsert: true,
        });

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          await admin.storage.from('job-snap-media').remove(uploadedPaths);
        }
        console.error('Storage upload failed:', uploadError);
        return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
      }

      uploadedPaths.push(storagePath);
    }

    // ── Insert job_snaps record ─────────────────────────────────────────────
    const { data: jobSnap, error: insertError } = await admin
      .from('job_snaps')
      .insert({
        id: snapId,
        site_id: body.siteId,
        created_by: profile.id,
        title: body.title ?? null,
        description: body.description ?? null,
        ai_generated_title: body.aiGeneratedTitle ?? null,
        ai_generated_description: body.aiGeneratedDescription ?? null,
        service_type: body.serviceType ?? null,
        // Primary service for legacy + work_item linking. Defaults to the
        // first selected service when explicit serviceId isn't passed.
        service_id:
          body.serviceId ??
          body.attachments?.service_ids?.[0] ??
          null,
        brand: body.brand ?? null,
        // Structured fields feeding the naming engine
        primary_problem: body.primaryProblem ?? null,
        equipment_type: body.equipmentType ?? null,
        client_name: body.clientName ?? null,
        neighborhood: body.neighborhood ?? null,
        // Technician credited for the work. Default to the uploader when the
        // field is absent from the request; respect an explicit null (the
        // user picked "No specific technician") as a real choice.
        technician_id:
          body.technicianId === undefined ? profile.id : body.technicianId,
        // Generated SEO fields (GL360 = source of truth)
        state_abbr: naming.state_abbr,
        street_name_public: naming.street_name_public,
        short_id: naming.short_id,
        slug: naming.slug,
        url_path: naming.url_path,
        meta_title: naming.meta_title,
        h1: naming.h1,
        meta_description: naming.meta_description,
        alt_text_default: naming.alt_text_default,
        image_filename_base: naming.image_filename_base,
        public_location_label: naming.public_location_label,
        // Status + location
        status: 'draft',
        location_source: loc?.source ?? null,
        address_full: loc?.addressFull ?? null,
        address_public: addressPublic,
        city: loc?.city ?? null,
        state: loc?.state ?? null,
        zip: loc?.zip ?? null,
        latitude: loc?.lat ?? null,
        longitude: loc?.lng ?? null,
        is_published_to_website: false,
        is_published_to_gbp: false,
      })
      .select('id')
      .single();

    if (insertError || !jobSnap) {
      // Clean up uploaded storage objects
      await admin.storage.from('job-snap-media').remove(uploadedPaths);
      console.error('job_snaps insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to save job snap' }, { status: 500 });
    }

    // ── Insert job_snap_media records ───────────────────────────────────────
    const mediaRecords = body.images.map((img, i) => ({
      job_snap_id: jobSnap.id,
      storage_path: uploadedPaths[i],
      file_name: uploadedPaths[i].split('/').pop() ?? img.fileName,
      alt_text: naming.alt_text_default,
      mime_type: img.mimeType,
      file_size: Math.round((img.base64.length * 3) / 4), // approximate from base64 length
      role: img.role ?? null,
      sort_order: img.sortOrder,
    }));

    const { error: mediaError } = await admin
      .from('job_snap_media')
      .insert(mediaRecords);

    if (mediaError) {
      // Job snap saved but media failed — leave the job snap and log the error
      // (recoverable: user can re-upload media later)
      console.error('job_snap_media insert failed:', mediaError);
    }

    // ── Insert attachment rows (multi-page linking) ─────────────────────────
    const attachmentRows = buildAttachmentRows(jobSnap.id, body.siteId, body.attachments);
    if (attachmentRows.length > 0) {
      const { error: attachError } = await admin
        .from('job_snap_attachments')
        .insert(attachmentRows);
      if (attachError) {
        console.error('job_snap_attachments insert failed:', attachError);
        // Non-fatal — snap is saved; user can re-attach via edit later.
      }
    }

    return NextResponse.json({ success: true, jobSnapId: jobSnap.id });
  } catch (error) {
    console.error('Job snap save failed:', error);
    return NextResponse.json({ error: 'Save failed. Please try again.' }, { status: 500 });
  }
}
