import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobSnapToWorkItemPayload, slugifyTitle } from '@/lib/job-snaps/transforms';
import { emitJobSnapEvent } from '@/lib/webhooks/emit';
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

    // ── Load technician profile (if attributed) ──────────────────────────────
    // Loaded separately because job_snaps has two FKs to profiles
    // (created_by + technician_id); the named relation isn't unique.
    let technician = null;
    if (snap.technician_id) {
      const { data: tech } = await adminClient
        .from('profiles')
        .select('id, full_name, title, avatar_url')
        .eq('id', snap.technician_id)
        .single();
      technician = tech || null;
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

    const typedSnap = {
      ...(snap as unknown as JobSnapWithRelations),
      technician,
    } as JobSnapWithRelations;

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
    // Use snap.alt_text_default (naming engine) when no per-image alt is set.
    const mediaImages: WorkItemImage[] = media.map((m, i) => {
      const { data: urlData } = adminClient.storage
        .from('job-snap-media')
        .getPublicUrl(m.storage_path);
      return {
        url: urlData.publicUrl,
        alt: m.alt_text || typedSnap.alt_text_default || `${title} — photo ${i + 1}`,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
        role: m.role ?? undefined,
        pairGroup: m.pair_group ?? undefined,
      };
    });

    // ── Resolve the work_item slug ────────────────────────────────────────────
    // Prefer the naming engine's pre-computed snap.slug. Legacy snaps with null
    // slug fall back to slugifyTitle. Collisions get the snap's short_id suffix.
    let workItemId: string | null = typedSnap.work_item_id || null;
    let workSlug: string;

    if (workItemId) {
      // Already published — reuse existing work_item slug for URL stability.
      const { data: existing } = await adminClient
        .from('work_items')
        .select('slug')
        .eq('id', workItemId)
        .single();
      workSlug = existing?.slug || typedSnap.slug || slugifyTitle(title);
    } else {
      const baseSlug = typedSnap.slug || slugifyTitle(title);
      workSlug = baseSlug;
      const { data: conflict } = await adminClient
        .from('work_items')
        .select('id')
        .eq('site_id', snap.site_id)
        .eq('slug', workSlug)
        .limit(1);
      if (conflict?.length) {
        // Collision: append the snap's short_id (stable across re-publishes)
        // rather than rewriting word order.
        const suffix = typedSnap.short_id || Math.random().toString(36).slice(2, 6);
        workSlug = `${baseSlug}-${suffix}`;
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
    revalidatePath(`${base}/work`);
    revalidatePath(`${base}/work/${workSlug}`);
    // Also revalidate home page (Recent Work section)
    revalidatePath(base, 'layout');

    const publicUrl = `https://${site.slug}.goleadflow.com/work/${workSlug}`;

    // Fire webhook to any external sites listening (WP plugin, Next.js, embed, etc.)
    await emitJobSnapEvent(
      workItemId ? 'job_snap.updated' : 'job_snap.published',
      jobId
    );

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
