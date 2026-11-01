import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import { reviewRepliesEnabled } from '@/lib/automation/review-replies';
import type { AutomationMode } from '@/types/database';

/**
 * GET   /api/sites/[siteId]/automation  -> mode, feature flags, queue counts, GBP readiness
 * PATCH /api/sites/[siteId]/automation  -> { automationMode?, reviewReplies? }
 * POST  /api/sites/[siteId]/automation  -> run a review sync for this site now
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const [{ data: site }, { data: location }, { data: connection }, { data: counts }] = await Promise.all([
    admin.from('sites').select('automation_mode, settings').eq('id', siteId).single(),
    admin.from('locations').select('gbp_location_id').eq('site_id', siteId).not('gbp_location_id', 'is', null).limit(1).maybeSingle(),
    admin.from('social_connections').select('id').eq('site_id', siteId).eq('platform', 'google_business').eq('is_active', true).limit(1).maybeSingle(),
    admin.from('pending_actions').select('status').eq('site_id', siteId),
  ]);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const byStatus: Record<string, number> = {};
  for (const row of counts || []) byStatus[row.status] = (byStatus[row.status] || 0) + 1;

  return NextResponse.json({
    automationMode: (site.automation_mode || 'approve') as AutomationMode,
    reviewReplies: reviewRepliesEnabled(site.settings),
    gbpLinked: !!location?.gbp_location_id,
    gbpConnected: !!connection,
    counts: byStatus,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { automationMode?: string; reviewReplies?: boolean };
  const admin = createAdminClient();
  const { data: site } = await admin.from('sites').select('settings').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.automationMode !== undefined) {
    if (body.automationMode !== 'approve' && body.automationMode !== 'autopilot') {
      return NextResponse.json({ error: 'automationMode must be approve or autopilot' }, { status: 400 });
    }
    update.automation_mode = body.automationMode;
  }
  if (typeof body.reviewReplies === 'boolean') {
    const settings = (site.settings || {}) as Record<string, unknown>;
    const automation = (settings.automation as Record<string, unknown> | undefined) || {};
    update.settings = { ...settings, automation: { ...automation, review_replies: body.reviewReplies } };
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { error } = await admin.from('sites').update(update).eq('id', siteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  await inngest.send({ name: 'reviews/sync.requested', data: { siteId } });
  return NextResponse.json({ ok: true, message: 'Sync started' });
}
