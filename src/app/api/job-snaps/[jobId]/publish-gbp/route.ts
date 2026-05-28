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
      .select('slug, organization_id, settings')
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

    // ── Resolve GBP target — fallback chain ──────────────────────────────────
    // 1) Full GL360 sites: gbp_account_id/gbp_location_id on the primary location.
    // 2) Job Snaps workspace sites: gbp_location_resource on sites.settings,
    //    stashed by the Stripe webhook from the org connection captured at signup.
    // 3) Last resort: org_google_connections.default_location_resource.
    let gbpAccountResource: string | null = null;     // "accounts/{id}"
    let gbpLocationResource: string | null = null;    // "locations/{id}"

    const { data: location } = await adminClient
      .from('locations')
      .select('gbp_account_id, gbp_location_id')
      .eq('site_id', snap.site_id)
      .eq('is_primary', true)
      .maybeSingle();

    if (location?.gbp_account_id && location?.gbp_location_id) {
      gbpAccountResource = location.gbp_account_id.startsWith('accounts/')
        ? location.gbp_account_id
        : `accounts/${location.gbp_account_id}`;
      gbpLocationResource = location.gbp_location_id.startsWith('locations/')
        ? location.gbp_location_id
        : `locations/${location.gbp_location_id}`;
    } else {
      // Try sites.settings.gbp_location_resource ("accounts/X/locations/Y")
      const settings = (site.settings || {}) as { gbp_location_resource?: string | null };
      let resourcePath = settings.gbp_location_resource || null;

      if (!resourcePath) {
        // Fall back to the org-level connection's default location
        const { data: orgConn } = await adminClient
          .from('org_google_connections')
          .select('default_location_resource')
          .eq('organization_id', site.organization_id)
          .eq('is_active', true)
          .maybeSingle();
        resourcePath = orgConn?.default_location_resource || null;
      }

      if (resourcePath) {
        // Format: "accounts/{accountId}/locations/{locationId}"
        const parts = resourcePath.split('/');
        const accIdx = parts.indexOf('accounts');
        const locIdx = parts.indexOf('locations');
        if (accIdx >= 0 && parts[accIdx + 1] && locIdx >= 0 && parts[locIdx + 1]) {
          gbpAccountResource = `accounts/${parts[accIdx + 1]}`;
          gbpLocationResource = `locations/${parts[locIdx + 1]}`;
        }
      }
    }

    if (!gbpAccountResource || !gbpLocationResource) {
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

    const gbpPost = await gbpClient.createLocalPost(
      gbpAccountResource,
      gbpLocationResource,
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
