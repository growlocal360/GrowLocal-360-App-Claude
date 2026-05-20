import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

/**
 * DELETE /api/sites/[siteId]
 *
 * Hard delete a site and ALL of its content. This is irreversible.
 *
 * Cascade behavior:
 *   - FK constraints on every site-scoped table use ON DELETE CASCADE, so
 *     deleting the sites row automatically removes services, service_areas,
 *     neighborhoods, site_pages, site_categories, site_brands, locations,
 *     leads, appointments, scheduling_configs, google_reviews, work_items,
 *     job_snaps, job_snap_media, api_keys, webhook_endpoints,
 *     integration_credentials, social_connections, profile_site_assignments,
 *     build_logs, gsc_queries, assets, and everything else linked by site_id.
 *   - subscriptions.site_id is ON DELETE SET NULL (intentional — billing
 *     history is preserved for audit even after the site is gone).
 *   - Supabase Storage objects are NOT linked by FK, so we enumerate +
 *     remove files in the three buckets that store site-owned content:
 *     site-logos, site-assets, job-snap-media.
 *
 * Authorization:
 *   - Only the account owner can hard-delete a site (mirrors archive).
 *
 * Confirmation:
 *   - Request body MUST include { confirmation_name } that matches the
 *     site's current `name` exactly. Frontend enforces type-to-confirm;
 *     this check is the server-side safety net.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const caller = access.caller!;

  if (caller.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the account owner can hard-delete a site' },
      { status: 403 }
    );
  }

  // ── Parse + validate confirmation ────────────────────────────────────
  let body: { confirmation_name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const confirmationName = (body.confirmation_name || '').trim();
  if (!confirmationName) {
    return NextResponse.json(
      { error: 'confirmation_name is required to hard-delete a site' },
      { status: 400 }
    );
  }

  // ── Load site (need name + slug for confirmation match + logging) ────
  const admin = createAdminClient();
  const { data: site, error: siteError } = await admin
    .from('sites')
    .select('id, name, slug')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.name !== confirmationName) {
    return NextResponse.json(
      {
        error: `Confirmation name doesn't match. Expected "${site.name}", got "${confirmationName}".`,
      },
      { status: 400 }
    );
  }

  // ── Storage cleanup ───────────────────────────────────────────────────
  // Recursively enumerate every object in site-owned buckets and remove.
  // Errors here are logged but don't block the DB delete — orphaned bytes
  // are easier to clean later than a half-deleted site.
  const buckets = ['site-logos', 'site-assets', 'job-snap-media'];
  for (const bucket of buckets) {
    try {
      await deleteAllFilesUnderPrefix(admin, bucket, siteId);
    } catch (err) {
      console.error(`[hard-delete] storage cleanup failed for bucket=${bucket}, siteId=${siteId}:`, err);
      // Continue — DB delete is the priority.
    }
  }

  // ── DB delete (cascade does the rest) ────────────────────────────────
  const { error: deleteError } = await admin
    .from('sites')
    .delete()
    .eq('id', siteId);

  if (deleteError) {
    console.error('[hard-delete] sites delete failed:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete site. Some related records may have been preserved.' },
      { status: 500 }
    );
  }

  console.log(
    `[hard-delete] site=${site.slug} id=${siteId} hard-deleted by user=${caller.user_id}`
  );

  return NextResponse.json({
    success: true,
    deleted: { id: siteId, name: site.name, slug: site.slug },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Recursively list and remove every file under a given prefix in a Supabase
 * Storage bucket. Supabase's `list()` returns one folder level at a time,
 * so we walk the tree, gather leaf file paths, and batch-remove.
 */
async function deleteAllFilesUnderPrefix(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string
): Promise<void> {
  const { data: items, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) {
    // 'Not found' is fine — site never had any files in this bucket.
    if (error.message?.toLowerCase().includes('not found')) return;
    throw error;
  }
  if (!items || items.length === 0) return;

  const filePaths: string[] = [];
  for (const item of items) {
    const childPath = prefix ? `${prefix}/${item.name}` : item.name;
    // Supabase list() returns folder entries with `id === null`.
    if (item.id === null) {
      await deleteAllFilesUnderPrefix(admin, bucket, childPath);
    } else {
      filePaths.push(childPath);
    }
  }

  if (filePaths.length > 0) {
    const { error: removeError } = await admin.storage.from(bucket).remove(filePaths);
    if (removeError) throw removeError;
  }
}
