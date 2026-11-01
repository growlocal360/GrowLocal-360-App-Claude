import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import { reviewRepliesEnabled } from '@/lib/automation/review-replies';
import { isRecentEnough } from '@/lib/automation/policy';
import { reviewRequestSettings, smsAvailable } from '@/lib/automation/review-requests';
import { gbpPostSettings } from '@/lib/automation/gbp-posts';
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
  const [{ data: site }, { data: location }, { data: connection }, { data: counts }, { data: unanswered }] = await Promise.all([
    admin.from('sites').select('automation_mode, settings').eq('id', siteId).single(),
    admin.from('locations').select('gbp_location_id').eq('site_id', siteId).not('gbp_location_id', 'is', null).limit(1).maybeSingle(),
    admin.from('social_connections').select('id').eq('site_id', siteId).eq('platform', 'google_business').eq('is_active', true).limit(1).maybeSingle(),
    admin.from('pending_actions').select('status, source_key').eq('site_id', siteId),
    admin.from('google_reviews').select('google_review_id, review_date').eq('site_id', siteId).is('review_reply', null),
  ]);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const byStatus: Record<string, number> = {};
  const queued = new Set<string>();
  for (const row of counts || []) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    if (row.source_key && row.status !== 'rejected' && row.status !== 'failed') queued.add(row.source_key);
  }
  // Unanswered reviews with no draft yet, split by the cron's age window.
  let unansweredRecent = 0;
  let unansweredOlder = 0;
  for (const r of unanswered || []) {
    if (queued.has(`review_reply:${r.google_review_id}`)) continue;
    if (isRecentEnough(r.review_date)) unansweredRecent += 1;
    else unansweredOlder += 1;
  }

  const automation = ((site.settings as { automation?: Record<string, unknown> } | null)?.automation) || {};
  const [{ count: requestsSent }, sms] = await Promise.all([
    admin.from('review_requests').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'sent'),
    smsAvailable(admin, siteId),
  ]);

  const [{ data: lastPost }, { count: photosLeft }] = await Promise.all([
    admin.from('pending_actions').select('created_at, status').eq('site_id', siteId).eq('action_type', 'gbp_post').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('job_snap_media').select('id, snap:job_snaps!inner(site_id, is_published_to_website)', { count: 'exact', head: true }).eq('snap.site_id', siteId).eq('snap.is_published_to_website', true).is('gbp_media_name', null),
  ]);

  return NextResponse.json({
    gbpPosts: gbpPostSettings(site.settings),
    lastGbpPostAt: lastPost?.created_at || null,
    photosLeftToUpload: photosLeft || 0,
    reviewRequests: reviewRequestSettings(site.settings),
    reviewRequestsSent: requestsSent || 0,
    smsReady: sms,
    automationMode: (site.automation_mode || 'approve') as AutomationMode,
    reviewReplies: reviewRepliesEnabled(site.settings),
    gbpLinked: !!location?.gbp_location_id,
    gbpConnected: !!connection,
    counts: byStatus,
    unansweredRecent,
    unansweredOlder,
    lastReviewSync: automation.last_review_sync || null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as {
    automationMode?: string;
    reviewReplies?: boolean;
    reviewRequests?: { enabled?: boolean; followUp?: boolean; delayHours?: number; followUpDays?: number };
    gbpPosts?: { enabled?: boolean; photoDrip?: boolean; cadenceDays?: number; photoEveryDays?: number };
  };
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
  const settings = (site.settings || {}) as Record<string, unknown>;
  const automation = { ...((settings.automation as Record<string, unknown> | undefined) || {}) };
  let settingsTouched = false;
  if (typeof body.reviewReplies === 'boolean') {
    automation.review_replies = body.reviewReplies;
    settingsTouched = true;
  }
  if (body.reviewRequests && typeof body.reviewRequests === 'object') {
    const rr = { ...((automation.review_requests as Record<string, unknown> | undefined) || {}) };
    const inp = body.reviewRequests;
    if (typeof inp.enabled === 'boolean') rr.enabled = inp.enabled;
    if (typeof inp.followUp === 'boolean') rr.follow_up = inp.followUp;
    if (typeof inp.delayHours === 'number' && inp.delayHours >= 0 && inp.delayHours <= 72) rr.delay_hours = inp.delayHours;
    if (typeof inp.followUpDays === 'number' && inp.followUpDays >= 1 && inp.followUpDays <= 14) rr.follow_up_days = inp.followUpDays;
    automation.review_requests = rr;
    settingsTouched = true;
  }
  if (body.gbpPosts && typeof body.gbpPosts === 'object') {
    const gp = { ...((automation.gbp_posts as Record<string, unknown> | undefined) || {}) };
    const inp = body.gbpPosts;
    if (typeof inp.enabled === 'boolean') gp.enabled = inp.enabled;
    if (typeof inp.photoDrip === 'boolean') gp.photo_drip = inp.photoDrip;
    if (typeof inp.cadenceDays === 'number' && inp.cadenceDays >= 1 && inp.cadenceDays <= 30) gp.cadence_days = inp.cadenceDays;
    if (typeof inp.photoEveryDays === 'number' && inp.photoEveryDays >= 1 && inp.photoEveryDays <= 30) gp.photo_every_days = inp.photoEveryDays;
    automation.gbp_posts = gp;
    settingsTouched = true;
  }
  if (settingsTouched) update.settings = { ...settings, automation };
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { error } = await admin.from('sites').update(update).eq('id', siteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Body (optional):
 *   { includeOlder: true }  also drafts replies for unanswered reviews older than the cron's window
 *   { run: 'post' }         draft a GBP post now
 *   { run: 'photo' }        queue the next gallery photo now
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { includeOlder?: boolean; run?: 'post' | 'photo' };
  if (body.run === 'post' || body.run === 'photo') {
    await inngest.send({ name: 'gbp/automation.requested', data: { siteId, kind: body.run } });
    return NextResponse.json({ ok: true, message: body.run === 'post' ? 'Drafting a post' : 'Picking a photo' });
  }
  await inngest.send({ name: 'reviews/sync.requested', data: { siteId, includeOlder: !!body.includeOlder } });
  return NextResponse.json({ ok: true, message: 'Sync started' });
}
