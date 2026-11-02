import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { publishReviewReply } from '@/lib/automation/review-replies';
import { sendReviewRequest } from '@/lib/automation/review-requests';
import { publishGbpPost, publishPhotoUpload } from '@/lib/automation/gbp-posts';
import type { PendingAction } from '@/types/database';

/**
 * POST /api/sites/[siteId]/automation/queue/[actionId]
 * Body: { decision: 'approve' | 'reject', reply?: string }
 * Approve publishes immediately (with the edited reply when given).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string; actionId: string }> }) {
  const { siteId, actionId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { decision?: string; reply?: string; sms?: string; summary?: string; caption?: string };
  if (body.decision !== 'approve' && body.decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: action } = await admin.from('pending_actions').select('*').eq('id', actionId).eq('site_id', siteId).single();
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  if (action.status !== 'pending' && action.status !== 'failed') {
    return NextResponse.json({ error: `Action is already ${action.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const decidedBy = access.caller?.user_id ?? null;

  if (body.decision === 'reject') {
    await admin
      .from('pending_actions')
      .update({ status: 'rejected', decided_at: now, decided_by: decidedBy, updated_at: now })
      .eq('id', actionId);
    if (action.action_type === 'review_request') {
      await admin.from('review_requests').update({ status: 'skipped', error: 'dismissed', updated_at: now }).eq('pending_action_id', actionId);
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  if (action.action_type === 'review_request') {
    const sent = await sendReviewRequest(admin, action as PendingAction, {
      smsOverride: typeof body.sms === 'string' && body.sms.trim() ? body.sms : undefined,
      decidedBy,
    });
    if (!sent.ok) return NextResponse.json({ error: sent.error, status: 'failed' }, { status: 502 });
    return NextResponse.json({ ok: true, status: 'published', channels: sent.channels });
  }

  if (action.action_type === 'gbp_post') {
    const pub = await publishGbpPost(admin, action as PendingAction, {
      summaryOverride: typeof body.summary === 'string' && body.summary.trim() ? body.summary : undefined,
      decidedBy,
    });
    if (!pub.ok) return NextResponse.json({ error: pub.error, status: 'failed' }, { status: 502 });
    return NextResponse.json({ ok: true, status: 'published' });
  }

  if (action.action_type === 'photo_upload') {
    const pub = await publishPhotoUpload(admin, action as PendingAction, {
      captionOverride: typeof body.caption === 'string' ? body.caption : undefined,
      decidedBy,
    });
    if (!pub.ok) return NextResponse.json({ error: pub.error, status: 'failed' }, { status: 502 });
    return NextResponse.json({ ok: true, status: 'published', uploaded: pub.uploaded, failed: pub.failed });
  }

  if (action.action_type !== 'review_reply') {
    return NextResponse.json({ error: `Publishing ${action.action_type} is not supported yet` }, { status: 400 });
  }

  const result = await publishReviewReply(admin, action as PendingAction, {
    replyOverride: typeof body.reply === 'string' && body.reply.trim() ? body.reply : undefined,
    decidedBy,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, status: 'failed' }, { status: 502 });
  return NextResponse.json({ ok: true, status: 'published' });
}
