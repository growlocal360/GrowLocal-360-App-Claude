import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/job-snaps/[jobId]
 *
 * Permanently deletes a job snap, its media files, and any associated work_item.
 */
export async function DELETE(
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
      .select('id, site_id, work_item_id, is_published_to_website')
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

    // ── Delete media files from storage ───────────────────────────────────────
    const { data: media } = await adminClient
      .from('job_snap_media')
      .select('id, storage_path')
      .eq('job_snap_id', jobId);

    if (media && media.length > 0) {
      const storagePaths = media.map((m: { storage_path: string }) => m.storage_path);
      await adminClient.storage.from('job-snap-media').remove(storagePaths);
      await adminClient.from('job_snap_media').delete().eq('job_snap_id', jobId);
    }

    // ── Delete associated work_item if published ──────────────────────────────
    const wasPublished = snap.is_published_to_website && snap.work_item_id;
    if (snap.work_item_id) {
      await adminClient.from('work_items').delete().eq('id', snap.work_item_id);
    }

    // ── Delete the job snap ───────────────────────────────────────────────────
    const { error: deleteError } = await adminClient
      .from('job_snaps')
      .delete()
      .eq('id', jobId);

    if (deleteError) throw deleteError;

    // ── Revalidate work pages if it was published ─────────────────────────────
    if (wasPublished) {
      const base = `/sites/${site.slug}`;
      revalidatePath(`${base}/work`);
      revalidatePath(base, 'layout');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job snap failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete job snap. Please try again.' },
      { status: 500 }
    );
  }
}
