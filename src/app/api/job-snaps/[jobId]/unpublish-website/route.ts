import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';

/**
 * POST /api/job-snaps/[jobId]/unpublish-website
 *
 * Removes a job snap from the public website by setting the linked
 * work_item to 'draft'. Updates the job snap status and clears
 * is_published_to_website.
 *
 * Returns: { success: true }
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
      .select('id, site_id, work_item_id, status')
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

    if (!snap.work_item_id) {
      return NextResponse.json(
        { error: 'This job snap has not been published to the website' },
        { status: 422 }
      );
    }

    // ── Set work_item to draft ─────────────────────────────────────────────────
    const { data: workItem } = await adminClient
      .from('work_items')
      .select('slug')
      .eq('id', snap.work_item_id)
      .single();

    const { error: workItemError } = await adminClient
      .from('work_items')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', snap.work_item_id);

    if (workItemError) throw workItemError;

    // ── Update job_snap ───────────────────────────────────────────────────────
    const { error: snapUpdateError } = await adminClient
      .from('job_snaps')
      .update({
        is_published_to_website: false,
        status: 'approved',
      })
      .eq('id', jobId);

    if (snapUpdateError) throw snapUpdateError;

    // ── Revalidate public work pages ──────────────────────────────────────────
    const base = `/sites/${site.slug}`;
    revalidatePath(`${base}/work`, 'page');
    if (workItem?.slug) {
      revalidatePath(`${base}/work/${workItem.slug}`, 'page');
    }
    revalidatePath(base, 'page');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unpublish from website failed:', error);
    return NextResponse.json(
      { error: 'Failed to unpublish. Please try again.' },
      { status: 500 }
    );
  }
}
