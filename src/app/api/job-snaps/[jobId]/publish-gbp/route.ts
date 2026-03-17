import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { toGbpPostPayload } from '@/lib/job-snaps/transforms';
import type { JobSnapWithRelations } from '@/types/database';

/**
 * POST /api/job-snaps/[jobId]/publish-gbp
 *
 * Scaffolded GBP publishing endpoint. Builds and returns the GBP Local Post
 * payload that WOULD be sent, but returns 501 because the GBP client does not
 * yet support posting (read-only).
 *
 * Returns: { error: 'GBP posting not yet implemented', payload: GbpPostPayload }
 *   with status 501.
 *
 * When the GBP client supports posting:
 *  1. Remove the 501 early-return
 *  2. Call gbpClient.createLocalPost(locationId, payload)
 *  3. Update job_snap: is_published_to_gbp = true
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

    const activeOrgId = getActiveOrgId();
    if (!activeOrgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    const adminClient = createAdminClient();

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

    if (!site || site.organization_id !== activeOrgId) {
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

    // ── Build GBP payload (for preview / future use) ───────────────────────────
    const { data: workItem } = await adminClient
      .from('work_items')
      .select('slug')
      .eq('id', typedSnap.work_item_id)
      .single();

    const publicUrl = workItem?.slug
      ? `https://${site.slug}.goleadflow.com/work/${workItem.slug}`
      : `https://${site.slug}.goleadflow.com/work`;

    // Get primary image URL for GBP post
    const sortedMedia = (typedSnap.media || []).sort((a, b) => a.sort_order - b.sort_order);
    let primaryImageUrl: string | undefined;
    if (sortedMedia.length > 0) {
      const { data: urlData } = adminClient.storage
        .from('job-snap-media')
        .getPublicUrl(sortedMedia[0].storage_path);
      primaryImageUrl = urlData.publicUrl;
    }

    const payload = toGbpPostPayload(typedSnap, publicUrl, primaryImageUrl);

    // ── 501: GBP client does not support posting yet ───────────────────────────
    return NextResponse.json(
      {
        error: 'GBP posting is not yet implemented. The GBP client is read-only.',
        payload,
      },
      { status: 501 }
    );

    // ── When GBP posting is implemented, do this instead: ─────────────────────
    // const gbpPost = await gbpClient.createLocalPost(locationId, payload);
    // await adminClient
    //   .from('job_snaps')
    //   .update({ is_published_to_gbp: true })
    //   .eq('id', jobId);
    // return NextResponse.json({ success: true, gbpPostName: gbpPost.name });
  } catch (error) {
    console.error('Publish to GBP failed:', error);
    return NextResponse.json(
      { error: 'Failed to push to GBP. Please try again.' },
      { status: 500 }
    );
  }
}
