import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GBPClient } from '@/lib/google/gbp-client';
import { getGoogleToken } from '@/lib/google/get-google-token';
import { toGbpPostPayload } from '@/lib/job-snaps/transforms';
import type { JobSnapWithRelations } from '@/types/database';

/**
 * POST /api/job-snaps/[jobId]/publish-gbp
 *
 * Creates a Google Business Profile Local Post from a published job snap.
 * Uses persisted Google token from social_connections (with auto-refresh),
 * falling back to session provider_token if available.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // ── Get user's org memberships ────────────────────────────────────────────
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id);
    const userOrgIds = (profiles || []).map((p: { organization_id: string }) => p.organization_id);

    // ── Load job snap ─────────────────────────────────────────────────────────
    const { data: snap, error: snapError } = await adminClient
      .from('job_snaps')
      .select('*, media:job_snap_media(*), service:services(*)')
      .eq('id', jobId)
      .single();

    if (snapError || !snap) {
      return NextResponse.json({ error: 'Job snap not found' }, { status: 404 });
    }

    // ── Org access check ──────────────────────────────────────────────────────
    const { data: site } = await adminClient
      .from('sites')
      .select('slug, organization_id')
      .eq('id', snap.site_id)
      .single();

    if (!site || !userOrgIds.includes(site.organization_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const typedSnap = snap as unknown as JobSnapWithRelations;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!typedSnap.is_published_to_website || !typedSnap.work_item_id) {
      return NextResponse.json(
        { error: 'Job snap must be published to the website before pushing to GBP' },
        { status: 422 }
      );
    }

    // ── Get GBP location IDs from the site's primary location ────────────────
    const { data: location } = await adminClient
      .from('locations')
      .select('gbp_account_id, gbp_location_id')
      .eq('site_id', snap.site_id)
      .eq('is_primary', true)
      .single();

    if (!location?.gbp_account_id || !location?.gbp_location_id) {
      return NextResponse.json(
        { error: 'No Google Business Profile location linked. Connect GBP in site settings.' },
        { status: 422 }
      );
    }

    // ── Build GBP payload ────────────────────────────────────────────────────
    const { data: workItem } = await adminClient
      .from('work_items')
      .select('slug')
      .eq('id', typedSnap.work_item_id)
      .single();

    const publicUrl = workItem?.slug
      ? `https://${site.slug}.goleadflow.com/work/${workItem.slug}`
      : `https://${site.slug}.goleadflow.com/work`;

    // Get primary image URL for GBP post
    // For before/after snaps, prefer the 'after' image (shows the result)
    const sortedMedia = (typedSnap.media || []).sort((a, b) => a.sort_order - b.sort_order);
    const afterImage = sortedMedia.find(m => m.role === 'after');
    const primaryImage = sortedMedia.find(m => m.role === 'primary');
    const bestImage = afterImage || primaryImage || sortedMedia[0];
    let primaryImageUrl: string | undefined;
    if (bestImage) {
      const { data: urlData } = adminClient.storage
        .from('job-snap-media')
        .getPublicUrl(bestImage.storage_path);
      primaryImageUrl = urlData.publicUrl;
    }

    const payload = toGbpPostPayload(typedSnap, publicUrl, primaryImageUrl);

    // ── Get Google token (session → DB → refresh) ─────────────────────────
    const googleToken = await getGoogleToken(snap.site_id);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Google connection expired. Please reconnect Google in site settings.' },
        { status: 400 }
      );
    }

    // ── Post to GBP ─────────────────────────────────────────────────────────
    const gbpClient = new GBPClient(googleToken);
    // Ensure account/location IDs have the correct prefix format
    const accountName = location.gbp_account_id.startsWith('accounts/')
      ? location.gbp_account_id
      : `accounts/${location.gbp_account_id}`;
    const locationName = location.gbp_location_id.startsWith('locations/')
      ? location.gbp_location_id
      : `locations/${location.gbp_location_id}`;

    const gbpPost = await gbpClient.createLocalPost(
      accountName,
      locationName,
      payload
    );

    // ── Update job snap ─────────────────────────────────────────────────────
    await adminClient
      .from('job_snaps')
      .update({ is_published_to_gbp: true })
      .eq('id', jobId);

    return NextResponse.json({
      success: true,
      gbpPostName: gbpPost.name,
    });
  } catch (error) {
    console.error('Publish to GBP failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to push to GBP. Please try again.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
