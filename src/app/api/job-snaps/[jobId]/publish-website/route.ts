import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { jobSnapToWorkItemPayload, slugifyTitle } from '@/lib/job-snaps/transforms';
import type { JobSnapWithRelations, WorkItemImage } from '@/types/database';

/**
 * POST /api/job-snaps/[jobId]/publish-website
 *
 * Publishes a job snap to the public website by creating (or updating) a
 * work_item record. Updates the job snap status to 'deployed' and sets
 * is_published_to_website = true.
 *
 * Returns: { success: true, workItemId, workSlug, publicUrl }
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

    // ── Validate publishability ────────────────────────────────────────────────
    const title = typedSnap.title || typedSnap.ai_generated_title;
    if (!title) {
      return NextResponse.json(
        { error: 'Job snap must have a title before publishing' },
        { status: 422 }
      );
    }

    const media = (typedSnap.media || []).sort((a, b) => a.sort_order - b.sort_order);
    if (media.length === 0) {
      return NextResponse.json(
        { error: 'Job snap must have at least one photo before publishing' },
        { status: 422 }
      );
    }

    // ── Build public storage URLs for media ───────────────────────────────────
    const mediaImages: WorkItemImage[] = media.map((m, i) => {
      const { data: urlData } = adminClient.storage
        .from('job-snap-media')
        .getPublicUrl(m.storage_path);
      return {
        url: urlData.publicUrl,
        alt: m.alt_text || `${title} — photo ${i + 1}`,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
      };
    });

    // ── Generate a unique slug ─────────────────────────────────────────────────
    let workItemId: string | null = typedSnap.work_item_id || null;
    let workSlug: string;

    if (workItemId) {
      // Already published — fetch existing slug to reuse it
      const { data: existing } = await adminClient
        .from('work_items')
        .select('slug')
        .eq('id', workItemId)
        .single();
      workSlug = existing?.slug || slugifyTitle(title);
    } else {
      // New publish — generate unique slug
      const base = slugifyTitle(title);
      workSlug = base;
      let attempt = 1;
      while (true) {
        const { data: conflict } = await adminClient
          .from('work_items')
          .select('id')
          .eq('site_id', snap.site_id)
          .eq('slug', workSlug)
          .limit(1);
        if (!conflict?.length) break;
        attempt++;
        workSlug = `${base}-${attempt}`;
      }
    }

    // ── Build work_item payload ───────────────────────────────────────────────
    const payload = jobSnapToWorkItemPayload(typedSnap, workSlug, mediaImages);

    // ── Upsert work_item ──────────────────────────────────────────────────────
    let upsertedId: string;

    if (workItemId) {
      // Update existing work_item (re-publish / refresh content)
      const { error: updateError } = await adminClient
        .from('work_items')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workItemId);

      if (updateError) throw updateError;
      upsertedId = workItemId;
    } else {
      // Insert new work_item
      const { data: inserted, error: insertError } = await adminClient
        .from('work_items')
        .insert(payload)
        .select('id')
        .single();

      if (insertError || !inserted) throw insertError ?? new Error('Insert returned no data');
      upsertedId = inserted.id;
    }

    // ── Update job_snap ───────────────────────────────────────────────────────
    const { error: snapUpdateError } = await adminClient
      .from('job_snaps')
      .update({
        is_published_to_website: true,
        status: 'deployed',
        deployed_at: new Date().toISOString(),
        work_item_id: upsertedId,
      })
      .eq('id', jobId);

    if (snapUpdateError) throw snapUpdateError;

    // ── Revalidate public work pages ──────────────────────────────────────────
    const base = `/sites/${site.slug}`;
    revalidatePath(`${base}/work`, 'page');
    revalidatePath(`${base}/work/${workSlug}`, 'page');
    // Also revalidate home page (Recent Work section)
    revalidatePath(base, 'page');

    const publicUrl = `https://${site.slug}.goleadflow.com/work/${workSlug}`;

    return NextResponse.json({
      success: true,
      workItemId: upsertedId,
      workSlug,
      publicUrl,
    });
  } catch (error) {
    console.error('Publish to website failed:', error);
    return NextResponse.json(
      { error: 'Failed to publish. Please try again.' },
      { status: 500 }
    );
  }
}
