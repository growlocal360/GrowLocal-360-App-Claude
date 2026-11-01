import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSMS, normalizePhone } from '@/lib/sms/twilio';
import { sendReviewRequestEmail } from '@/lib/email/resend';
import type {
  AutomationMode,
  PendingAction,
  ReviewRequestContext,
  ReviewRequestSource,
  SiteSettings,
} from '@/types/database';

/**
 * Review requests: ask a customer for a Google review by text and/or email.
 *
 * Flow: createReviewRequest() stores a review_requests row and a
 * pending_actions row of type 'review_request'. In approve mode (or when the
 * caller says so) it waits in the queue; on autopilot or an explicit
 * "send now" it goes straight to sendReviewRequest(). A follow-up goes out a
 * few days later unless a new review has shown up in the meantime.
 */

export interface ReviewRequestSettings {
  enabled: boolean;
  /** Hours to wait after an appointment is marked completed. */
  delayHours: number;
  followUp: boolean;
  followUpDays: number;
}

export function reviewRequestSettings(settings: SiteSettings | null | undefined): ReviewRequestSettings {
  const raw = ((settings as { automation?: { review_requests?: Record<string, unknown> } } | null)?.automation?.review_requests) || {};
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    enabled: raw.enabled !== false,
    delayHours: num(raw.delay_hours, 2),
    followUp: raw.follow_up !== false,
    followUpDays: Math.max(1, num(raw.follow_up_days, 3)),
  };
}

/** Google's "write a review" deep link for a Place ID. */
export function reviewLinkFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] || '';
  return first.length > 1 ? first : name.trim();
}

/** Messages are plain, short, and name the business first so the text is never anonymous. */
export function buildReviewRequestMessages(input: { businessName: string; customerName: string; reviewUrl: string; followUp?: boolean }) {
  const first = firstNameOf(input.customerName);
  const greet = first ? `Hi ${first}, ` : 'Hi, ';
  const sms = input.followUp
    ? `${greet}${input.businessName} here. A quick nudge in case it slipped your mind: a short Google review would mean a lot to us. ${input.reviewUrl}`
    : `${greet}thanks for choosing ${input.businessName}. If we did right by you, would you leave us a quick Google review? It takes about a minute: ${input.reviewUrl}`;
  const emailSubject = input.followUp
    ? `Quick favor from ${input.businessName}`
    : `How did we do? ${input.businessName}`;
  return { sms, emailSubject };
}

interface CreateInput {
  siteId: string;
  source: ReviewRequestSource;
  customer: { name: string; phone?: string | null; email?: string | null };
  appointmentId?: string | null;
  leadId?: string | null;
  /** Skip the queue regardless of mode (a human clicked "send"). */
  sendNow?: boolean;
  decidedBy?: string | null;
}

export type CreateResult =
  | { ok: true; status: 'queued' | 'sent'; reviewRequestId: string; actionId: string }
  | { ok: false; error: string };

export async function createReviewRequest(supabase: SupabaseClient, input: CreateInput): Promise<CreateResult> {
  const name = input.customer.name?.trim();
  const phone = input.customer.phone?.trim() ? normalizePhone(input.customer.phone.trim()) : null;
  const email = input.customer.email?.trim().toLowerCase() || null;
  if (!name) return { ok: false, error: 'Customer name is required' };
  if (!phone && !email) return { ok: false, error: 'Need a mobile number or an email address' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email address does not look valid' };

  const [{ data: site }, { data: location }] = await Promise.all([
    supabase.from('sites').select('id, name, settings, automation_mode').eq('id', input.siteId).single(),
    supabase.from('locations').select('gbp_place_id').eq('site_id', input.siteId).not('gbp_place_id', 'is', null).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site) return { ok: false, error: 'Site not found' };
  if (!location?.gbp_place_id) return { ok: false, error: 'No Google Place ID on this site. Connect the Business Profile first.' };

  if (input.appointmentId) {
    const { data: dupe } = await supabase.from('review_requests').select('id').eq('site_id', input.siteId).eq('appointment_id', input.appointmentId).maybeSingle();
    if (dupe) return { ok: false, error: 'A review request already exists for this appointment' };
  }

  const reviewUrl = reviewLinkFor(location.gbp_place_id);
  const { sms, emailSubject } = buildReviewRequestMessages({ businessName: site.name, customerName: name, reviewUrl });

  const { data: request, error: reqErr } = await supabase
    .from('review_requests')
    .insert({
      site_id: input.siteId,
      appointment_id: input.appointmentId || null,
      lead_id: input.leadId || null,
      source: input.source,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      review_url: reviewUrl,
      status: 'queued',
    })
    .select('id')
    .single();
  if (reqErr || !request) return { ok: false, error: reqErr?.message || 'Could not save the request' };

  const context: ReviewRequestContext = {
    review_request_id: request.id,
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    source: input.source,
    review_url: reviewUrl,
  };
  const { data: action, error: actErr } = await supabase
    .from('pending_actions')
    .insert({
      site_id: input.siteId,
      action_type: 'review_request',
      status: 'pending',
      payload: { sms, email_subject: emailSubject },
      context,
      source_key: `review_request:${request.id}`,
    })
    .select('*')
    .single();
  if (actErr || !action) return { ok: false, error: actErr?.message || 'Could not queue the request' };
  await supabase.from('review_requests').update({ pending_action_id: action.id }).eq('id', request.id);

  const mode = (site.automation_mode || 'approve') as AutomationMode;
  if (input.sendNow || mode === 'autopilot') {
    const result = await sendReviewRequest(supabase, action as PendingAction, { decidedBy: input.decidedBy ?? null, autoPublished: !input.sendNow });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, status: 'sent', reviewRequestId: request.id, actionId: action.id };
  }
  return { ok: true, status: 'queued', reviewRequestId: request.id, actionId: action.id };
}

/** Which number texts go out from: the site's own Twilio number, else the shared GrowLocal number. */
async function smsFromNumber(supabase: SupabaseClient, siteId: string): Promise<string | null> {
  const { data: config } = await supabase.from('scheduling_configs').select('twilio_phone_number').eq('site_id', siteId).maybeSingle();
  return config?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || null;
}

export async function smsAvailable(supabase: SupabaseClient, siteId: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false;
  return !!(await smsFromNumber(supabase, siteId));
}

/**
 * Deliver a queued review request. Sends by text when there is a number to
 * send from, by email when there is an address; succeeds if either lands.
 */
export async function sendReviewRequest(
  supabase: SupabaseClient,
  action: PendingAction,
  opts: { smsOverride?: string; decidedBy?: string | null; autoPublished?: boolean } = {}
): Promise<{ ok: true; channels: string[] } | { ok: false; error: string }> {
  const ctx = action.context as unknown as ReviewRequestContext;
  const payload = action.payload as { sms?: string; email_subject?: string };
  const now = new Date().toISOString();

  const { data: site } = await supabase.from('sites').select('name, settings').eq('id', action.site_id).single();
  if (!site) return failAction(supabase, action.id, ctx.review_request_id, 'Site not found');
  const settings = reviewRequestSettings(site.settings);
  const brandColor = ((site.settings as { brand_color?: string } | null)?.brand_color) || '#00ef99';

  const channels: string[] = [];
  const problems: string[] = [];
  let smsSid: string | null = null;

  if (ctx.customer_phone) {
    const from = await smsFromNumber(supabase, action.site_id);
    if (!from) problems.push('no texting number configured');
    else {
      const body = (opts.smsOverride?.trim() || payload.sms || buildReviewRequestMessages({ businessName: site.name, customerName: ctx.customer_name, reviewUrl: ctx.review_url }).sms);
      smsSid = await sendSMS({ to: ctx.customer_phone, body, from });
      if (smsSid) channels.push('sms');
      else problems.push('text message failed');
    }
  }

  if (ctx.customer_email) {
    try {
      await sendReviewRequestEmail({
        to: ctx.customer_email,
        businessName: site.name,
        customerName: ctx.customer_name,
        reviewUrl: ctx.review_url,
        brandColor,
        subject: payload.email_subject,
      });
      channels.push('email');
    } catch (e) {
      problems.push(`email failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (channels.length === 0) {
    return failAction(supabase, action.id, ctx.review_request_id, problems.join('; ') || 'Nothing to send');
  }

  const followUpDue = settings.followUp
    ? new Date(Date.now() + settings.followUpDays * 86400000).toISOString()
    : null;

  await Promise.all([
    supabase
      .from('pending_actions')
      .update({
        status: 'published',
        payload: { ...action.payload, sms: opts.smsOverride?.trim() || payload.sms, channels },
        published_at: now,
        decided_at: now,
        decided_by: opts.decidedBy ?? null,
        auto_published: !!opts.autoPublished,
        error: problems.length ? problems.join('; ') : null,
        updated_at: now,
      })
      .eq('id', action.id),
    supabase
      .from('review_requests')
      .update({ status: 'sent', channels, sms_sid: smsSid, sent_at: now, follow_up_due_at: followUpDue, error: problems.length ? problems.join('; ') : null, updated_at: now })
      .eq('id', ctx.review_request_id),
  ]);
  return { ok: true, channels };
}

async function failAction(supabase: SupabaseClient, actionId: string, requestId: string, error: string): Promise<{ ok: false; error: string }> {
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from('pending_actions').update({ status: 'failed', error, updated_at: now }).eq('id', actionId),
    supabase.from('review_requests').update({ status: 'failed', error, updated_at: now }).eq('id', requestId),
  ]);
  return { ok: false, error };
}

/**
 * Daily: one gentle follow-up per sent request, skipped when the business
 * received any new review after the first message went out.
 */
export async function sendDueFollowUps(supabase: SupabaseClient): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  const { data: due } = await supabase
    .from('review_requests')
    .select('*')
    .eq('status', 'sent')
    .is('follow_up_sent_at', null)
    .lte('follow_up_due_at', new Date().toISOString())
    .limit(200);

  for (const req of due || []) {
    const now = new Date().toISOString();
    const { count } = await supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', req.site_id)
      .gt('created_at', req.sent_at);
    if ((count || 0) > 0) {
      await supabase.from('review_requests').update({ follow_up_sent_at: now, follow_up_note: 'skipped: a new review came in', updated_at: now }).eq('id', req.id);
      out.skipped += 1;
      continue;
    }

    const { data: site } = await supabase.from('sites').select('name, settings').eq('id', req.site_id).single();
    if (!site || !reviewRequestSettings(site.settings).followUp) {
      await supabase.from('review_requests').update({ follow_up_sent_at: now, follow_up_note: 'skipped: follow-ups off', updated_at: now }).eq('id', req.id);
      out.skipped += 1;
      continue;
    }

    const { sms, emailSubject } = buildReviewRequestMessages({ businessName: site.name, customerName: req.customer_name, reviewUrl: req.review_url, followUp: true });
    const delivered: string[] = [];
    if (req.customer_phone && req.channels.includes('sms')) {
      const from = await smsFromNumber(supabase, req.site_id);
      if (from && (await sendSMS({ to: req.customer_phone, body: sms, from }))) delivered.push('sms');
    }
    if (req.customer_email && req.channels.includes('email')) {
      try {
        await sendReviewRequestEmail({
          to: req.customer_email,
          businessName: site.name,
          customerName: req.customer_name,
          reviewUrl: req.review_url,
          brandColor: ((site.settings as { brand_color?: string } | null)?.brand_color) || '#00ef99',
          subject: emailSubject,
          followUp: true,
        });
        delivered.push('email');
      } catch {
        /* recorded below */
      }
    }
    await supabase
      .from('review_requests')
      .update({ follow_up_sent_at: now, follow_up_note: delivered.length ? `sent via ${delivered.join(', ')}` : 'failed', updated_at: now })
      .eq('id', req.id);
    if (delivered.length) out.sent += 1; else out.failed += 1;
  }
  return out;
}
