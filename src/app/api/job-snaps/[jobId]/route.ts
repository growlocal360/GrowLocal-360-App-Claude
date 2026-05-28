import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitJobSnapEvent } from '@/lib/webhooks/emit';
import { computeJobSnapNaming } from '@/lib/job-snaps/naming';
import { getIndustryArchetype } from '@/lib/job-snaps/industry-config';

// ─── Shared helpers ────────────────────────────────────────────────────────

function buildAttachmentRows(
  jobSnapId: string,
  siteId: string,
  attachments: PatchBody['attachments']
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

async function loadAuthorizedSnap(jobId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401 };

  const adminClient = createAdminClient();

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id);
  const userOrgIds = (profiles || []).map((p: { organization_id: string }) => p.organization_id);

  const { data: snap, error: snapError } = await adminClient
    .from('job_snaps')
    .select('*')
    .eq('id', jobId)
    .single();

  if (snapError || !snap) return { error: 'Job snap not found' as const, status: 404 };

  const { data: site } = await adminClient
    .from('sites')
    .select('slug, organization_id')
    .eq('id', snap.site_id)
    .single();

  if (!site || !userOrgIds.includes(site.organization_id)) {
    return { error: 'Forbidden' as const, status: 403 };
  }

  return { adminClient, snap, site };
}

// ─── PATCH ────────────────────────────────────────────────────────────────
// Edit handler. Recomputes the canonical SEO naming on every save.
//
// Modes (controlled by body.regenerate_seo_fields):
//   - false (default): partial recompute — re-derive meta_title/h1/alt_text/
//     meta_description/public_location_label. Permalink fields (slug, url_path,
//     image_filename_base, short_id) are preserved so existing /work/<slug>
//     URLs and image storage paths stay stable.
//   - true: full recompute — slug + image_filename_base also regenerate.
//     Used by the "Regenerate SEO Fields" advanced action in the editor.
//
// GL360-generated SEO fields are the source of truth across every output
// channel. Downstream consumers should not duplicate this logic.

interface PatchBody {
  title?: string | null;
  description?: string | null;
  service_type?: string | null;
  service_id?: string | null;
  brand?: string | null;
  client_name?: string | null;
  primary_problem?: string | null;
  equipment_type?: string | null;
  neighborhood?: string | null;
  street_name_public?: string | null;
  technician_id?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address_full?: string | null;
  address_public?: string | null;
  status?: 'draft' | 'queued' | 'approved' | 'deployed' | 'rejected';
  regenerate_seo_fields?: boolean;
  /**
   * When present, REPLACES the snap's attachment set with the supplied
   * targets. Omit to leave attachments untouched.
   */
  attachments?: {
    service_ids?: string[];
    category_ids?: string[];
    brand_ids?: string[];
    area_ids?: string[];
  } | null;
  /** Optional per-field overrides applied AFTER the naming engine runs. */
  overrides?: {
    slug?: string;
    meta_title?: string;
    h1?: string;
    meta_description?: string;
    alt_text_default?: string;
    image_filename_base?: string;
    public_location_label?: string;
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = (await req.json()) as PatchBody;

    const result = await loadAuthorizedSnap(jobId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { adminClient, snap, site } = result;

    // Merge incoming patch values onto the existing snap row.
    const merged = {
      title: body.title !== undefined ? body.title : snap.title,
      description: body.description !== undefined ? body.description : snap.description,
      service_type: body.service_type !== undefined ? body.service_type : snap.service_type,
      service_id: body.service_id !== undefined ? body.service_id : snap.service_id,
      brand: body.brand !== undefined ? body.brand : snap.brand,
      client_name: body.client_name !== undefined ? body.client_name : snap.client_name,
      primary_problem:
        body.primary_problem !== undefined ? body.primary_problem : snap.primary_problem,
      equipment_type:
        body.equipment_type !== undefined ? body.equipment_type : snap.equipment_type,
      neighborhood: body.neighborhood !== undefined ? body.neighborhood : snap.neighborhood,
      street_name_public:
        body.street_name_public !== undefined ? body.street_name_public : snap.street_name_public,
      technician_id:
        body.technician_id !== undefined ? body.technician_id : snap.technician_id,
      city: body.city !== undefined ? body.city : snap.city,
      state: body.state !== undefined ? body.state : snap.state,
      zip: body.zip !== undefined ? body.zip : snap.zip,
      address_full: body.address_full !== undefined ? body.address_full : snap.address_full,
      address_public:
        body.address_public !== undefined ? body.address_public : snap.address_public,
      status: body.status !== undefined ? body.status : snap.status,
    };

    // Existing slug pool for collision detection on full recompute.
    let siteExistingSlugs = new Set<string>();
    if (body.regenerate_seo_fields) {
      const { data: rows } = await adminClient
        .from('job_snaps')
        .select('slug')
        .eq('site_id', snap.site_id)
        .neq('id', snap.id)
        .not('slug', 'is', null);
      siteExistingSlugs = new Set(
        (rows || []).map((r: { slug: string | null }) => r.slug || '').filter(Boolean)
      );
    }

    // Resolve the site's industry archetype from its primary GBP category
    // (only matters when we're actually recomputing the slug).
    let industryArchetype = undefined;
    if (body.regenerate_seo_fields) {
      const { data: primaryCategory } = await adminClient
        .from('site_categories')
        .select('gbp_category:gbp_categories(display_name)')
        .eq('site_id', snap.site_id)
        .eq('is_primary', true)
        .single();
      type CategoryJoin = { gbp_category: { display_name: string } | { display_name: string }[] | null } | null;
      const gbpCategoryRaw = (primaryCategory as CategoryJoin)?.gbp_category;
      const gbpCategoryName = Array.isArray(gbpCategoryRaw)
        ? gbpCategoryRaw[0]?.display_name ?? null
        : gbpCategoryRaw?.display_name ?? null;
      industryArchetype = getIndustryArchetype(gbpCategoryName);
    }

    const naming = computeJobSnapNaming(
      {
        title: merged.title,
        description: merged.description,
        service_type: merged.service_type,
        brand: merged.brand,
        primary_problem: merged.primary_problem,
        equipment_type: merged.equipment_type,
        city: merged.city,
        state: merged.state,
        zip: merged.zip,
        neighborhood: merged.neighborhood,
        address_public: merged.address_public,
        street_name_public: merged.street_name_public,
      },
      {
        preservePermalinks: !body.regenerate_seo_fields,
        siteExistingSlugs,
        industryArchetype,
        existing: {
          slug: snap.slug,
          url_path: snap.url_path,
          image_filename_base: snap.image_filename_base,
          short_id: snap.short_id,
        },
      }
    );

    // Per-field overrides take precedence over the engine output.
    const overrides = body.overrides || {};

    const update: Record<string, unknown> = {
      ...merged,
      state_abbr: naming.state_abbr,
      street_name_public: naming.street_name_public,
      short_id: naming.short_id,
      slug: overrides.slug ?? naming.slug,
      url_path: naming.url_path,
      meta_title: overrides.meta_title ?? naming.meta_title,
      h1: overrides.h1 ?? naming.h1,
      meta_description: overrides.meta_description ?? naming.meta_description,
      alt_text_default: overrides.alt_text_default ?? naming.alt_text_default,
      image_filename_base: overrides.image_filename_base ?? naming.image_filename_base,
      public_location_label: overrides.public_location_label ?? naming.public_location_label,
    };

    const { error: updateError } = await adminClient
      .from('job_snaps')
      .update(update)
      .eq('id', snap.id);

    if (updateError) {
      console.error('PATCH job_snaps failed:', updateError);
      return NextResponse.json({ error: 'Failed to update job snap' }, { status: 500 });
    }

    // Keep the linked work_item's slug in sync with the snap. Without this,
    // an already-published snap's GBP "Learn more" URL + the external site's
    // /work/{slug} path would silently keep using the OLD slug, leading to
    // 404s after a SEO-slug edit.
    if (snap.work_item_id && typeof update.slug === 'string' && update.slug !== snap.slug) {
      const { error: workItemUpdateError } = await adminClient
        .from('work_items')
        .update({ slug: update.slug })
        .eq('id', snap.work_item_id);
      if (workItemUpdateError) {
        console.warn('PATCH job_snaps: failed to sync work_items.slug', workItemUpdateError);
        // Non-fatal — snap update succeeded; publish-gbp now reads from
        // job_snaps.slug so the GBP link is still correct.
      }
    }

    // ── Replace attachments when the patch body includes them ────────────
    // Omitted = don't touch existing attachments. Present (even if empty)
    // means the user is intentionally setting the new set, so we wipe + insert.
    if (body.attachments !== undefined) {
      await adminClient
        .from('job_snap_attachments')
        .delete()
        .eq('job_snap_id', snap.id);

      const rows = buildAttachmentRows(snap.id, snap.site_id, body.attachments);
      if (rows.length > 0) {
        const { error: insertError } = await adminClient
          .from('job_snap_attachments')
          .insert(rows);
        if (insertError) {
          console.error('PATCH job_snap_attachments insert failed:', insertError);
          // Non-fatal — snap update succeeded, just the relinking failed.
        }
      }
    }

    // Notify subscribers + revalidate public surface if the snap is live.
    if (snap.is_published_to_website) {
      await emitJobSnapEvent('job_snap.updated', snap.id);
      const base = `/sites/${site.slug}`;
      revalidatePath(`${base}/work`);
      if (snap.slug) revalidatePath(`${base}/work/${snap.slug}`);
      if (update.slug !== snap.slug && typeof update.slug === 'string') {
        revalidatePath(`${base}/work/${update.slug}`);
      }
    }

    return NextResponse.json({ success: true, naming: update });
  } catch (error) {
    console.error('PATCH job_snaps threw:', error);
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 });
  }
}

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

    // ── Fire unpublish webhook BEFORE we delete the row ───────────────────────
    // External integrations (HL, Next.js webhook handlers, embed-script
    // caches, etc.) need to know to remove their copy of the snap. Must be
    // emitted before the DB row is gone — emitJobSnapEvent loads the snap
    // to serialize the payload.
    await emitJobSnapEvent('job_snap.unpublished', jobId);

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
