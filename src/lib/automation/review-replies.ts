import type { SupabaseClient } from '@supabase/supabase-js';
import { GBPClient, starRatingToNumber, type GBPReview } from '@/lib/google/gbp-client';
import { getStoredGoogleToken } from '@/lib/google/stored-token';
import { createAnthropicClient, buildContentDirectives, withRetry } from '@/lib/content/generators';
import { sendNegativeReviewAlertEmail } from '@/lib/email/resend';
import {
  isRecentEnough,
  shouldAutoPublishReply,
  isNegativeReview,
  sanitizeReply,
  REVIEW_REPLY_MAX_PER_SYNC,
  REVIEW_REPLY_MAX_PER_BACKFILL,
} from './policy';
import type { AutomationMode, PendingAction, ReviewReplyContext, SiteSettings } from '@/types/database';

/**
 * Review automation for one site:
 *   1. import the latest reviews from GBP into google_reviews
 *   2. draft a reply for each recent, unanswered review (once, idempotent)
 *   3. autopilot: publish 4-5 star replies; everything else waits in the queue
 *   4. 1-2 star reviews email the owner right away
 *
 * Shared by the hourly cron, the "Sync now" button and the approve route.
 */

interface SiteRow {
  id: string;
  name: string;
  slug: string;
  settings: SiteSettings | null;
  automation_mode: AutomationMode;
  organization_id: string;
}

interface LocationRow {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
}

export interface SyncSummary {
  siteId: string;
  imported: number;
  drafted: number;
  autoPublished: number;
  alerted: number;
  skipped?: string;
  errors: string[];
}

function withPrefix(value: string, prefix: string): string {
  return value.startsWith(`${prefix}/`) ? value : `${prefix}/${value}`;
}

/** Automation feature flags live in site settings so no migration is needed per flag. */
export function reviewRepliesEnabled(settings: SiteSettings | null | undefined): boolean {
  const auto = (settings as { automation?: { review_replies?: boolean } } | null)?.automation;
  return auto?.review_replies !== false; // default on
}

export interface SyncOptions {
  /**
   * Also draft for unanswered reviews older than REVIEW_REPLY_MAX_AGE_DAYS
   * (the "catch up on my backlog" button). Those drafts always wait for a
   * human, even on autopilot, and the per-run cap is raised.
   */
  includeOlder?: boolean;
}

export async function syncSiteReviews(supabase: SupabaseClient, siteId: string, opts: SyncOptions = {}): Promise<SyncSummary> {
  const summary = await runSync(supabase, siteId, opts);
  await recordLastSync(supabase, siteId, summary);
  return summary;
}

/** Persist the outcome on the site so the dashboard can say what the last check did. */
async function recordLastSync(supabase: SupabaseClient, siteId: string, summary: SyncSummary) {
  const { data: site } = await supabase.from('sites').select('settings').eq('id', siteId).maybeSingle();
  if (!site) return;
  const settings = (site.settings || {}) as Record<string, unknown>;
  const automation = (settings.automation as Record<string, unknown> | undefined) || {};
  await supabase
    .from('sites')
    .update({
      settings: {
        ...settings,
        automation: {
          ...automation,
          last_review_sync: {
            at: new Date().toISOString(),
            imported: summary.imported,
            drafted: summary.drafted,
            auto_published: summary.autoPublished,
            skipped: summary.skipped || null,
            errors: summary.errors.slice(0, 3),
          },
        },
      },
    })
    .eq('id', siteId);
}

async function runSync(supabase: SupabaseClient, siteId: string, opts: SyncOptions): Promise<SyncSummary> {
  const summary: SyncSummary = { siteId, imported: 0, drafted: 0, autoPublished: 0, alerted: 0, errors: [] };

  const [{ data: site }, { data: location }] = await Promise.all([
    supabase.from('sites').select('id, name, slug, settings, automation_mode, organization_id').eq('id', siteId).single(),
    supabase
      .from('locations')
      .select('id, name, city, state, phone, gbp_account_id, gbp_location_id')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!site) return { ...summary, skipped: 'site not found' };
  if (!location?.gbp_account_id || !location.gbp_location_id) return { ...summary, skipped: 'no GBP location linked' };

  const token = await getStoredGoogleToken(supabase, siteId);
  if (!token) return { ...summary, skipped: 'no Google token' };

  const typedSite = site as SiteRow;
  const typedLocation = location as LocationRow;
  const client = new GBPClient(token);
  const accountName = withPrefix(typedLocation.gbp_account_id!, 'accounts');
  const locationName = withPrefix(typedLocation.gbp_location_id!, 'locations');

  // 1. Import
  let reviews: GBPReview[] = [];
  try {
    const res = await client.getReviews(accountName, locationName);
    reviews = res.reviews || [];
    if (reviews.length) {
      await supabase.from('google_reviews').upsert(
        reviews.map((r) => ({
          site_id: siteId,
          location_id: typedLocation.id,
          google_review_id: r.reviewId,
          author_name: r.reviewer.isAnonymous ? 'Anonymous' : r.reviewer.displayName || 'Customer',
          author_photo_url: r.reviewer.profilePhotoUrl || null,
          rating: starRatingToNumber(r.starRating),
          comment: r.comment || null,
          review_date: r.createTime,
          review_reply: r.reviewReply?.comment || null,
          reply_date: r.reviewReply?.updateTime || null,
        })),
        { onConflict: 'site_id,google_review_id' }
      );
      summary.imported = reviews.length;
    }
    if (res.averageRating || res.totalReviewCount) {
      const settings = (typedSite.settings || {}) as Record<string, unknown>;
      await supabase
        .from('sites')
        .update({
          settings: {
            ...settings,
            google_average_rating: res.averageRating ?? settings.google_average_rating,
            google_total_reviews: res.totalReviewCount ?? settings.google_total_reviews,
          },
        })
        .eq('id', siteId);
    }
  } catch (e) {
    summary.errors.push(`import: ${e instanceof Error ? e.message : String(e)}`);
    return summary;
  }

  if (!reviewRepliesEnabled(typedSite.settings)) return { ...summary, skipped: 'review replies disabled' };

  // 2. Which reviews need a draft: unanswered, recent (unless catching up on the backlog), not already queued
  const candidates = reviews.filter((r) => !r.reviewReply?.comment && (opts.includeOlder || isRecentEnough(r.createTime)));
  if (candidates.length === 0) return summary;

  const { data: existing } = await supabase
    .from('pending_actions')
    .select('source_key')
    .eq('site_id', siteId)
    .eq('action_type', 'review_reply')
    .in('source_key', candidates.map((r) => `review_reply:${r.reviewId}`));
  const already = new Set((existing || []).map((e) => e.source_key));

  const cap = opts.includeOlder ? REVIEW_REPLY_MAX_PER_BACKFILL : REVIEW_REPLY_MAX_PER_SYNC;
  const todo = candidates.filter((r) => !already.has(`review_reply:${r.reviewId}`)).slice(0, cap);
  if (todo.length === 0) return summary;

  const { data: services } = await supabase.from('services').select('name').eq('site_id', siteId).limit(12);
  const serviceNames = (services || []).map((s) => s.name as string);

  // 3. Draft, queue, maybe publish
  for (const review of todo) {
    const rating = starRatingToNumber(review.starRating);
    const context: ReviewReplyContext = {
      google_review_id: review.reviewId,
      google_review_name: review.name,
      rating,
      author_name: review.reviewer.isAnonymous ? 'Anonymous' : review.reviewer.displayName || 'Customer',
      comment: review.comment || null,
      review_date: review.createTime,
    };

    let reply: string;
    try {
      reply = await draftReviewReply({ site: typedSite, location: typedLocation, serviceNames, review: context });
    } catch (e) {
      summary.errors.push(`draft ${review.reviewId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const { data: action, error: insertError } = await supabase
      .from('pending_actions')
      .insert({
        site_id: siteId,
        action_type: 'review_reply',
        status: 'pending',
        payload: { reply },
        context,
        source_key: `review_reply:${review.reviewId}`,
      })
      .select('*')
      .single();
    if (insertError || !action) {
      // Unique violation = another run got here first. Fine.
      continue;
    }
    summary.drafted += 1;
    const recent = isRecentEnough(review.createTime);

    if (recent && isNegativeReview(rating)) {
      try {
        await alertOwner(supabase, typedSite, context, reply);
        summary.alerted += 1;
      } catch (e) {
        summary.errors.push(`alert ${review.reviewId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Backlog drafts are old enough that a surprise auto-reply would look odd; always queue them.
    if (recent && shouldAutoPublishReply(typedSite.automation_mode, rating)) {
      const result = await publishReviewReply(supabase, action as PendingAction, { client, autoPublished: true });
      if (result.ok) summary.autoPublished += 1;
      else summary.errors.push(`publish ${review.reviewId}: ${result.error}`);
    }
  }

  return summary;
}

/**
 * Send a review_reply action to Google and record the outcome on both the
 * action and the cached review. `replyOverride` lets the approve route send
 * an edited version.
 */
export async function publishReviewReply(
  supabase: SupabaseClient,
  action: PendingAction,
  opts: { client?: GBPClient; replyOverride?: string; decidedBy?: string | null; autoPublished?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = action.context as unknown as ReviewReplyContext;
  const reply = sanitizeReply(opts.replyOverride ?? String((action.payload as { reply?: string }).reply || ''));
  if (!reply) return fail(supabase, action.id, 'Empty reply');

  let client = opts.client;
  if (!client) {
    const token = await getStoredGoogleToken(supabase, action.site_id);
    if (!token) return fail(supabase, action.id, 'No Google token. Reconnect the Business Profile.');
    client = new GBPClient(token);
  }

  try {
    const res = await client.replyToReview(context.google_review_name, reply);
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('pending_actions')
        .update({
          status: 'published',
          payload: { ...action.payload, reply },
          published_at: now,
          decided_at: now,
          decided_by: opts.decidedBy ?? null,
          auto_published: !!opts.autoPublished,
          error: null,
          updated_at: now,
        })
        .eq('id', action.id),
      supabase
        .from('google_reviews')
        .update({ review_reply: reply, reply_date: res.updateTime || now, updated_at: now })
        .eq('site_id', action.site_id)
        .eq('google_review_id', context.google_review_id),
    ]);
    return { ok: true };
  } catch (e) {
    return fail(supabase, action.id, e instanceof Error ? e.message : String(e));
  }
}

async function fail(supabase: SupabaseClient, actionId: string, error: string): Promise<{ ok: false; error: string }> {
  await supabase
    .from('pending_actions')
    .update({ status: 'failed', error, updated_at: new Date().toISOString() })
    .eq('id', actionId);
  return { ok: false, error };
}

// ── Drafting ────────────────────────────────────────────────────────────────

export function buildReviewReplyPrompt(input: {
  businessName: string;
  city: string;
  state: string;
  phone: string | null;
  serviceNames: string[];
  directives: string;
  review: ReviewReplyContext;
}): string {
  const { review } = input;
  const firstName = review.author_name.split(' ')[0];
  const negative = isNegativeReview(review.rating);
  const old = !isRecentEnough(review.review_date);
  return `You are the owner of ${input.businessName}, a local service business in ${input.city}, ${input.state}, replying publicly to a Google review.
${input.serviceNames.length ? `Services offered: ${input.serviceNames.join(', ')}` : ''}
${input.directives}

## The review
Rating: ${review.rating} of 5
Reviewer: ${review.author_name}
${review.comment ? `Text: """${review.comment}"""` : 'Text: (no written comment, rating only)'}

## Reply rules
- 2 to 4 sentences. Under 70 words. One short paragraph, no greeting line, no sign-off line.
- Address the reviewer by first name (${firstName === 'Anonymous' || firstName === 'Customer' ? 'they are anonymous: do not use a name' : firstName}).
- Refer to one specific thing from their review when there is text. Never restate the whole review.
- Never offer discounts, refunds, credits or promises. Never mention competitors. Never ask them to change the rating.
- Do not invent facts about the business, the job, the technician or the timeline. Only use what the review says.
- No hashtags, no emojis, no exclamation marks beyond one, no all-caps, no em dashes.
${old ? '- This review was left a while ago and is only being answered now. Do not pretend it is recent and do not dwell on the delay; at most a brief acknowledgment, then the thanks.' : ''}
${negative
  ? `- This is a negative review. Apologize once, plainly, without excuses or arguing. Say you want to make it right and invite them to reach out directly${input.phone ? ` at ${input.phone}` : ''}. Do not dispute their account in public, even if it seems unfair.`
  : `- Thank them, be warm but not gushing, and if natural mention you look forward to helping again.`}

Return only the reply text.`;
}

export async function draftReviewReply(input: {
  site: SiteRow;
  location: LocationRow;
  serviceNames: string[];
  review: ReviewReplyContext;
}): Promise<string> {
  const anthropic = createAnthropicClient();
  const prompt = buildReviewReplyPrompt({
    businessName: input.site.name,
    city: input.location.city,
    state: input.location.state,
    phone: input.site.settings?.phone || input.location.phone || null,
    serviceNames: input.serviceNames,
    directives: buildContentDirectives(input.site.settings || undefined),
    review: input.review,
  });

  const text = await withRetry(async (signal) => {
    const res = await anthropic.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] },
      { signal }
    );
    const block = res.content.find((c) => c.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }, 1, 60_000);

  const reply = sanitizeReply(text);
  if (!reply) throw new Error('Model returned an empty reply');
  return reply;
}

// ── Owner alert for negative reviews ────────────────────────────────────────

async function alertOwner(supabase: SupabaseClient, site: SiteRow, review: ReviewReplyContext, draft: string) {
  const settings = (site.settings || {}) as Record<string, unknown>;
  const { data: config } = await supabase
    .from('scheduling_configs')
    .select('notification_email')
    .eq('site_id', site.id)
    .maybeSingle();

  let ownerEmail: string | null = null;
  if (!settings.lead_notification_email && !config?.notification_email) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('organization_id', site.organization_id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    if (ownerProfile?.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
      ownerEmail = authUser.user?.email || null;
    }
  }

  const to =
    (typeof settings.lead_notification_email === 'string' && settings.lead_notification_email) ||
    config?.notification_email ||
    ownerEmail;
  if (!to) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
  await sendNegativeReviewAlertEmail({
    to,
    businessName: site.name,
    rating: review.rating,
    authorName: review.author_name,
    comment: review.comment,
    draftReply: draft,
    queueUrl: `${appUrl}/dashboard/sites/${site.id}/automation`,
    brandColor: (typeof settings.brand_color === 'string' && settings.brand_color) || '#00ef99',
  });
}
