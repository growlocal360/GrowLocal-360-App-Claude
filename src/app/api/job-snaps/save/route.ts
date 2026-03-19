import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPublicAddress, toStorageFileName } from '@/lib/job-snaps/address';

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
  brand?: string | null;
  location?: SaveLocationInput | null;
  images: SaveImageInput[];
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

    // ── Upload images to storage ────────────────────────────────────────────
    const uploadedPaths: string[] = [];

    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const ext = mimeToExt(img.mimeType);

      const fileName = toStorageFileName({
        serviceType: body.serviceType ?? null,
        address: body.location?.addressFull ?? '',
        city: body.location?.city ?? '',
        state: body.location?.state ?? '',
        zip: body.location?.zip ?? '',
        sequence: i + 1,
        ext,
      });

      // Unique folder per job (use a random UUID prefix to avoid collisions)
      const folderName = crypto.randomUUID();
      const storagePath = `${body.siteId}/${folderName}/${fileName}`;

      const buffer = Buffer.from(img.base64, 'base64');

      const { error: uploadError } = await admin.storage
        .from('job-snap-media')
        .upload(storagePath, buffer, {
          contentType: img.mimeType,
          upsert: false,
        });

      if (uploadError) {
        // Clean up already-uploaded files before failing
        if (uploadedPaths.length > 0) {
          await admin.storage.from('job-snap-media').remove(uploadedPaths);
        }
        console.error('Storage upload failed:', uploadError);
        return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
      }

      uploadedPaths.push(storagePath);
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

    // ── Insert job_snaps record ─────────────────────────────────────────────
    const { data: jobSnap, error: insertError } = await admin
      .from('job_snaps')
      .insert({
        site_id: body.siteId,
        created_by: profile.id,
        title: body.title ?? null,
        description: body.description ?? null,
        ai_generated_title: body.aiGeneratedTitle ?? null,
        ai_generated_description: body.aiGeneratedDescription ?? null,
        service_type: body.serviceType ?? null,
        brand: body.brand ?? null,
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

    return NextResponse.json({ success: true, jobSnapId: jobSnap.id });
  } catch (error) {
    console.error('Job snap save failed:', error);
    return NextResponse.json({ error: 'Save failed. Please try again.' }, { status: 500 });
  }
}
