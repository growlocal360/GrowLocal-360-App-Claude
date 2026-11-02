import type { SupabaseClient } from '@supabase/supabase-js';
import { GBPClient } from '@/lib/google/gbp-client';
import { getStoredGoogleToken } from '@/lib/google/stored-token';
import { createAnthropicClient, buildContentDirectives, withRetry } from '@/lib/content/generators';
import { resolvePublicOrigin } from '@/lib/sites/public-origin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';
import type { AutomationMode, PendingAction, SiteSettings } from '@/types/database';

/**
 * Weekly Google Business Profile posts and the photo drip.
 *
 * A post is drafted from the site's own material, rotating through sources so
 * the profile doesn't read like a broken record:
 *   service   - one service page, what the job involves and when to call
 *   work      - a recent Job Snap with its photo
 *   review    - a 5-star review, quoted, with thanks
 *   tip       - a seasonal, trade-specific tip for the area
 * The photo drip uploads one published Job Snap photo to the profile's gallery
 * every few days. Both go through pending_actions: approve mode waits for a
 * human, autopilot publishes.
 */

export type PostSource = 'service' | 'work' | 'review' | 'tip';
const ROTATION: PostSource[] = ['service', 'work', 'review', 'tip'];
/** GBP rejects summaries over 1500 characters. */
export const GBP_SUMMARY_MAX = 1500;

export interface GbpPostSettings {
  enabled: boolean;
  cadenceDays: number;
  photoDrip: boolean;
  photoEveryDays: number;
}

export function gbpPostSettings(settings: SiteSettings | null | undefined): GbpPostSettings {
  const raw = ((settings as { automation?: { gbp_posts?: Record<string, unknown> } } | null)?.automation?.gbp_posts) || {};
  const num = (v: unknown, d: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  return {
    enabled: raw.enabled !== false,
    cadenceDays: num(raw.cadence_days, 7, 1, 30),
    photoDrip: raw.photo_drip !== false,
    photoEveryDays: num(raw.photo_every_days, 3, 1, 30),
  };
}

/** Next source in rotation that is actually available, skipping what was used most recently. */
export function pickSource(available: PostSource[], recent: PostSource[]): PostSource | null {
  if (available.length === 0) return null;
  const last = recent[0];
  const start = last ? (ROTATION.indexOf(last) + 1) % ROTATION.length : 0;
  for (let i = 0; i < ROTATION.length; i++) {
    const candidate = ROTATION[(start + i) % ROTATION.length];
    if (available.includes(candidate)) return candidate;
  }
  return available[0];
}

/** Keep a summary inside Google's limit without cutting mid-sentence when avoidable. */
export function trimSummary(text: string): string {
  const cleaned = text.replace(/\s*—\s*/g, '. ').replace(/[ \t]+\n/g, '\n').trim();
  if (cleaned.length <= GBP_SUMMARY_MAX) return cleaned;
  const cut = cleaned.slice(0, GBP_SUMMARY_MAX);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return (lastStop > GBP_SUMMARY_MAX * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim();
}

export function seasonFor(date = new Date()): string {
  const m = date.getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

export function isDue(lastAt: string | null | undefined, everyDays: number, now = new Date()): boolean {
  if (!lastAt) return true;
  const t = new Date(lastAt).getTime();
  if (Number.isNaN(t)) return true;
  // A few hours of slack so a daily cron doesn't drift the cadence by a day each cycle.
  return now.getTime() - t >= everyDays * 86400000 - 6 * 3600000;
}

// ── Material ────────────────────────────────────────────────────────────────

interface SiteRow {
  id: string;
  name: string;
  slug: string;
  settings: SiteSettings | null;
  automation_mode: AutomationMode;
  custom_domain: string | null;
  custom_domain_verified: boolean | null;
}
interface LocationRow { id: string; city: string; state: string; gbp_account_id: string | null; gbp_location_id: string | null }

export interface GbpPostContext {
  source: PostSource;
  source_id: string | null;
  source_label: string;
  cta_url: string;
  media_url: string | null;
}

interface Material {
  service: { id: string; name: string; slug: string; intro: string; url: string } | null;
  work: { id: string; title: string; description: string; url: string; imageUrl: string | null } | null;
  review: { id: string; author: string; comment: string; url: string } | null;
  tip: { url: string };
}

async function gatherMaterial(supabase: SupabaseClient, site: SiteRow, location: LocationRow, origin: string, recentIds: Set<string>): Promise<Material> {
  const [{ data: services }, { data: cats }, { data: work }, { data: reviews }, { data: pushedSnaps }, { data: usedPosts }] = await Promise.all([
    supabase.from('services').select('id, name, slug, intro_copy, description, site_category_id').eq('site_id', site.id).eq('is_active', true).order('sort_order').limit(30),
    supabase.from('site_categories').select('id, is_primary, gbp_category:gbp_categories(display_name)').eq('site_id', site.id),
    supabase.from('work_items').select('id, slug, title, description, images').eq('site_id', site.id).eq('status', 'published').order('created_at', { ascending: false }).limit(20),
    supabase.from('google_reviews').select('google_review_id, author_name, comment').eq('site_id', site.id).eq('is_visible', true).eq('rating', 5).not('comment', 'is', null).order('review_date', { ascending: false }).limit(15),
    // Jobs the owner already pushed to GBP from Job Snaps: never feature them again as a post.
    supabase.from('job_snaps').select('work_item_id').eq('site_id', site.id).eq('is_published_to_gbp', true).not('work_item_id', 'is', null),
    // Jobs already used by a published weekly post, ever.
    supabase.from('pending_actions').select('context').eq('site_id', site.id).eq('action_type', 'gbp_post').eq('status', 'published'),
  ]);
  const workUsed = new Set<string>([
    ...(pushedSnaps || []).map((r) => r.work_item_id as string),
    ...(usedPosts || []).map((a) => (a.context as unknown as GbpPostContext)).filter((c) => c.source === 'work' && c.source_id).map((c) => c.source_id as string),
  ]);

  const catById = new Map<string, { slug: string; isPrimary: boolean }>();
  for (const c of cats || []) {
    const name = (c.gbp_category as unknown as { display_name?: string } | null)?.display_name || '';
    catById.set(c.id as string, { slug: normalizeCategorySlug(name), isPrimary: !!c.is_primary });
  }

  const svcPool = (services || []).filter((s) => (s.intro_copy || s.description)) as { id: string; name: string; slug: string; intro_copy: string | null; description: string | null; site_category_id: string | null }[];
  const svc = svcPool.find((s) => !recentIds.has(s.id)) || svcPool[0] || null;
  const service = svc
    ? (() => {
        const cat = svc.site_category_id ? catById.get(svc.site_category_id) : undefined;
        return { id: svc.id, name: svc.name, slug: svc.slug, intro: (svc.intro_copy || svc.description || '').slice(0, 1200), url: origin + paths.servicePage(svc.slug, cat?.slug, cat?.isPrimary) };
      })()
    : null;

  const workPool = ((work || []) as { id: string; slug: string; title: string; description: string | null; images: { url: string; role?: string }[] | null }[])
    .filter((x) => !workUsed.has(x.id) && !recentIds.has(x.id));
  // No fallback here: a job already on the profile is never posted twice.
  const w = workPool[0] || null;
  const workItem = w
    ? (() => {
        const imgs = w.images || [];
        const best = imgs.find((i) => i.role === 'after') || imgs.find((i) => i.role === 'primary') || imgs[0];
        return { id: w.id, title: w.title, description: (w.description || '').slice(0, 800), url: origin + paths.workDetail(w.slug), imageUrl: best?.url || null };
      })()
    : null;

  const revPool = ((reviews || []) as { google_review_id: string; author_name: string | null; comment: string | null }[]).filter((r) => (r.comment || '').trim().length >= 40);
  const r = revPool.find((x) => !recentIds.has(x.google_review_id)) || revPool[0] || null;
  const review = r ? { id: r.google_review_id, author: r.author_name || 'a customer', comment: (r.comment || '').trim().slice(0, 500), url: origin + paths.reviewsIndex() } : null;

  return { service, work: workItem, review, tip: { url: origin + paths.bookPage() } };
}

// ── Drafting ────────────────────────────────────────────────────────────────

export function buildGbpPostPrompt(input: {
  businessName: string; city: string; state: string; categoryName: string; directives: string;
  source: PostSource; material: Material; season: string;
}): string {
  const { source, material } = input;
  const brief =
    source === 'service' && material.service
      ? `Topic: the "${material.service.name}" service. Draw only from this page copy:\n"""${material.service.intro}"""\nAngle: what the problem looks like to the customer, what the work involves, when to call.`
      : source === 'work' && material.work
        ? `Topic: a job we just finished, titled "${material.work.title}". Details:\n"""${material.work.description || '(no description, photo only)'}"""\nAngle: what was wrong, what was done. Write as the business, in past tense. Do not name the customer or their street.`
        : source === 'review' && material.review
          ? `Topic: a 5-star review from ${material.review.author}:\n"""${material.review.comment}"""\nAngle: quote one short line from it (under 20 words, in quotation marks, attributed to a first name only), thank them, and say one concrete thing about that kind of job. Do not add claims the review does not make.`
          : `Topic: a practical ${input.season} tip for homeowners in ${input.city}, ${input.state} related to ${input.categoryName}. Angle: one specific thing to check or do this season, why it matters, what happens if it is skipped. Trade knowledge only; no claims about this business's process, pricing or availability.`;

  return `You are writing a Google Business Profile post for ${input.businessName}, a ${input.categoryName} business in ${input.city}, ${input.state}. Readers see it on the Google listing while deciding whether to call.
${input.directives}

${brief}

## Post rules
- 60 to 120 words. Two or three short paragraphs. Plain text only: no markdown, no hashtags, no emojis, no bullet characters, no em dashes.
- Lead with the specific, not the business name. Do not open with "At ${input.businessName}" or "We are proud".
- End with a short, natural invitation to book or call (one sentence). Do not include a URL or phone number; the post has a button for that.
- Never invent facts about the business: no years in business, guarantees, pricing, response times, certifications, or team size unless they appear above.

Return only the post text.`;
}

async function draftPost(prompt: string): Promise<string> {
  const anthropic = createAnthropicClient();
  const text = await withRetry(async (signal) => {
    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }, { signal });
    const block = res.content.find((c) => c.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }, 1, 60_000);
  const summary = trimSummary(text.replace(/^["“]+|["”]+$/g, ''));
  if (!summary) throw new Error('Model returned an empty post');
  return summary;
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function loadSite(supabase: SupabaseClient, siteId: string) {
  const [{ data: site }, { data: location }, { data: primaryCat }] = await Promise.all([
    supabase.from('sites').select('id, name, slug, settings, automation_mode, custom_domain, custom_domain_verified').eq('id', siteId).single(),
    supabase.from('locations').select('id, city, state, gbp_account_id, gbp_location_id').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('site_categories').select('gbp_category:gbp_categories(display_name)').eq('site_id', siteId).eq('is_primary', true).limit(1).maybeSingle(),
  ]);
  const categoryName = ((primaryCat?.gbp_category as unknown as { display_name?: string } | null)?.display_name) || 'local service';
  return { site: site as SiteRow | null, location: location as LocationRow | null, categoryName };
}

function withPrefix(value: string, prefix: string): string {
  return value.startsWith(`${prefix}/`) ? value : `${prefix}/${value}`;
}

export type DraftResult =
  | { ok: true; status: 'queued' | 'published'; actionId: string; source: PostSource }
  | { ok: false; error: string };

/** Draft one post for a site and queue it (or publish on autopilot). */
export async function createGbpPostDraft(supabase: SupabaseClient, siteId: string, opts: { sendNow?: boolean; decidedBy?: string | null } = {}): Promise<DraftResult> {
  const { site, location, categoryName } = await loadSite(supabase, siteId);
  if (!site) return { ok: false, error: 'Site not found' };
  if (!location?.gbp_account_id || !location.gbp_location_id) return { ok: false, error: 'No Google Business Profile location linked' };

  const { data: recentActions } = await supabase
    .from('pending_actions')
    .select('context')
    .eq('site_id', siteId)
    .eq('action_type', 'gbp_post')
    .order('created_at', { ascending: false })
    .limit(8);
  const recent = (recentActions || []).map((a) => (a.context as unknown as GbpPostContext));
  const recentSources = recent.map((c) => c.source).filter(Boolean);
  const recentIds = new Set(recent.map((c) => c.source_id).filter((x): x is string => !!x));

  const origin = await resolvePublicOrigin(supabase, site);
  const material = await gatherMaterial(supabase, site, location, origin, recentIds);
  const available: PostSource[] = [
    ...(material.service ? (['service'] as PostSource[]) : []),
    ...(material.work ? (['work'] as PostSource[]) : []),
    ...(material.review ? (['review'] as PostSource[]) : []),
    'tip',
  ];
  const source = pickSource(available, recentSources)!;

  let summary: string;
  try {
    summary = await draftPost(buildGbpPostPrompt({
      businessName: site.name, city: location.city, state: location.state, categoryName,
      directives: buildContentDirectives(site.settings || undefined), source, material, season: seasonFor(),
    }));
  } catch (e) {
    return { ok: false, error: `draft: ${e instanceof Error ? e.message : String(e)}` };
  }

  const context: GbpPostContext =
    source === 'service' && material.service
      ? { source, source_id: material.service.id, source_label: material.service.name, cta_url: material.service.url, media_url: null }
      : source === 'work' && material.work
        ? { source, source_id: material.work.id, source_label: material.work.title, cta_url: material.work.url, media_url: material.work.imageUrl }
        : source === 'review' && material.review
          ? { source, source_id: material.review.id, source_label: `Review from ${material.review.author}`, cta_url: material.review.url, media_url: null }
          : { source: 'tip', source_id: null, source_label: `${seasonFor()} tip`, cta_url: material.tip.url, media_url: null };

  const { data: action, error } = await supabase
    .from('pending_actions')
    .insert({ site_id: siteId, action_type: 'gbp_post', status: 'pending', payload: { summary, cta_type: 'LEARN_MORE' }, context })
    .select('*')
    .single();
  if (error || !action) return { ok: false, error: error?.message || 'Could not queue the post' };

  if (opts.sendNow || site.automation_mode === 'autopilot') {
    const pub = await publishGbpPost(supabase, action as PendingAction, { decidedBy: opts.decidedBy ?? null, autoPublished: !opts.sendNow });
    if (!pub.ok) return { ok: false, error: pub.error };
    return { ok: true, status: 'published', actionId: action.id, source };
  }
  return { ok: true, status: 'queued', actionId: action.id, source };
}

export async function publishGbpPost(
  supabase: SupabaseClient,
  action: PendingAction,
  opts: { summaryOverride?: string; decidedBy?: string | null; autoPublished?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = action.context as unknown as GbpPostContext;
  const summary = trimSummary(opts.summaryOverride?.trim() || String((action.payload as { summary?: string }).summary || ''));
  if (!summary) return fail(supabase, action.id, 'Empty post');

  const { data: location } = await supabase.from('locations').select('gbp_account_id, gbp_location_id').eq('site_id', action.site_id).order('is_primary', { ascending: false }).limit(1).maybeSingle();
  if (!location?.gbp_account_id || !location.gbp_location_id) return fail(supabase, action.id, 'No Google Business Profile location linked');
  const token = await getStoredGoogleToken(supabase, action.site_id);
  if (!token) return fail(supabase, action.id, 'No Google token. Reconnect the Business Profile.');

  try {
    const client = new GBPClient(token);
    const res = await client.createLocalPost(withPrefix(location.gbp_account_id, 'accounts'), withPrefix(location.gbp_location_id, 'locations'), {
      topicType: 'STANDARD',
      languageCode: 'en-US',
      summary,
      callToAction: { actionType: 'LEARN_MORE', url: ctx.cta_url },
      ...(ctx.media_url ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: ctx.media_url }] } : {}),
    });
    const now = new Date().toISOString();
    await supabase
      .from('pending_actions')
      .update({ status: 'published', payload: { ...action.payload, summary, gbp_post_name: res.name }, published_at: now, decided_at: now, decided_by: opts.decidedBy ?? null, auto_published: !!opts.autoPublished, error: null, updated_at: now })
      .eq('id', action.id);
    return { ok: true };
  } catch (e) {
    return fail(supabase, action.id, e instanceof Error ? e.message : String(e));
  }
}

// ── Photo drip ──────────────────────────────────────────────────────────────

export interface PhotoUploadItem { media_id: string; url: string; role: string | null }
export interface PhotoUploadContext {
  job_snap_id: string;
  snap_title: string;
  /** All of this job's photos going to the gallery together (max PHOTOS_PER_JOB). */
  photos: PhotoUploadItem[];
  /** @deprecated single-photo shape from the first release; kept so old queue rows still render/publish */
  media_id?: string;
  url?: string;
}
export const PHOTOS_PER_JOB = 4;

/** Photos of a queued action, tolerant of the older one-photo shape. */
export function photosOf(ctx: PhotoUploadContext): PhotoUploadItem[] {
  if (Array.isArray(ctx.photos) && ctx.photos.length) return ctx.photos;
  return ctx.media_id && ctx.url ? [{ media_id: ctx.media_id, url: ctx.url, role: null }] : [];
}

/**
 * Pick the next published Job Snap whose photos are not yet in the profile
 * gallery and queue the whole job as one action, so the gallery reads like a
 * job log (one job every few days) instead of the same job trickling out.
 */
export async function queueNextPhoto(supabase: SupabaseClient, siteId: string, opts: { sendNow?: boolean; decidedBy?: string | null } = {}): Promise<
  { ok: true; status: 'queued' | 'published' | 'nothing'; actionId?: string } | { ok: false; error: string }
> {
  const { data: site } = await supabase.from('sites').select('automation_mode').eq('id', siteId).single();
  if (!site) return { ok: false, error: 'Site not found' };

  const { data: rows } = await supabase
    .from('job_snap_media')
    .select('id, storage_path, role, sort_order, created_at, snap:job_snaps!inner(id, site_id, title, ai_generated_title, is_published_to_website, created_at)')
    .eq('snap.site_id', siteId)
    .eq('snap.is_published_to_website', true)
    .is('gbp_media_name', null)
    .order('created_at', { ascending: false })
    .limit(120);

  type Row = { id: string; storage_path: string; role: string | null; sort_order: number; snap: { id: string; title: string | null; ai_generated_title: string | null; created_at: string } };
  const pool = ((rows || []) as unknown as Row[]).filter((m) => m.role !== 'before');
  if (pool.length === 0) return { ok: true, status: 'nothing' };

  // Jobs already waiting in the queue are skipped.
  const { data: queued } = await supabase.from('pending_actions').select('context').eq('site_id', siteId).eq('action_type', 'photo_upload').in('status', ['pending', 'approved']);
  const queuedSnaps = new Set((queued || []).map((q) => (q.context as unknown as PhotoUploadContext).job_snap_id));

  // Group by job, newest job first.
  const bySnap = new Map<string, Row[]>();
  for (const m of pool) {
    if (queuedSnaps.has(m.snap.id)) continue;
    const list = bySnap.get(m.snap.id) || [];
    list.push(m);
    bySnap.set(m.snap.id, list);
  }
  const nextSnap = [...bySnap.values()].sort((a, b) => b[0].snap.created_at.localeCompare(a[0].snap.created_at))[0];
  if (!nextSnap) return { ok: true, status: 'nothing' };

  const roleRank = (r: string | null) => (r === 'after' ? 0 : r === 'primary' ? 1 : r === 'detail' ? 2 : r === 'process' ? 3 : 4);
  const chosen = nextSnap.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.sort_order - b.sort_order).slice(0, PHOTOS_PER_JOB);
  const photos: PhotoUploadItem[] = chosen.map((m) => ({
    media_id: m.id,
    url: supabase.storage.from('job-snap-media').getPublicUrl(m.storage_path).data.publicUrl,
    role: m.role,
  }));
  const snap = chosen[0].snap;
  const context: PhotoUploadContext = { job_snap_id: snap.id, snap_title: snap.title || snap.ai_generated_title || 'Recent work', photos };
  const caption = (snap.title || snap.ai_generated_title || '').slice(0, 200);

  const { data: action, error } = await supabase
    .from('pending_actions')
    .insert({ site_id: siteId, action_type: 'photo_upload', status: 'pending', payload: { caption }, context, source_key: `photo_upload:snap:${snap.id}` })
    .select('*')
    .single();
  if (error || !action) return { ok: false, error: error?.message || 'Could not queue the photos' };

  if (opts.sendNow || site.automation_mode === 'autopilot') {
    const pub = await publishPhotoUpload(supabase, action as PendingAction, { decidedBy: opts.decidedBy ?? null, autoPublished: !opts.sendNow });
    if (!pub.ok) return { ok: false, error: pub.error };
    return { ok: true, status: 'published', actionId: action.id };
  }
  return { ok: true, status: 'queued', actionId: action.id };
}

/** Upload every photo of the job; the action succeeds if at least one lands, and reports the rest. */
export async function publishPhotoUpload(
  supabase: SupabaseClient,
  action: PendingAction,
  opts: { captionOverride?: string; decidedBy?: string | null; autoPublished?: boolean } = {}
): Promise<{ ok: true; uploaded: number; failed: number } | { ok: false; error: string }> {
  const ctx = action.context as unknown as PhotoUploadContext;
  const photos = photosOf(ctx);
  if (photos.length === 0) return fail(supabase, action.id, 'No photos on this action');

  const { data: location } = await supabase.from('locations').select('gbp_account_id, gbp_location_id').eq('site_id', action.site_id).order('is_primary', { ascending: false }).limit(1).maybeSingle();
  if (!location?.gbp_account_id || !location.gbp_location_id) return fail(supabase, action.id, 'No Google Business Profile location linked');
  const token = await getStoredGoogleToken(supabase, action.site_id);
  if (!token) return fail(supabase, action.id, 'No Google token. Reconnect the Business Profile.');

  const caption = (opts.captionOverride ?? String((action.payload as { caption?: string }).caption || '')).trim().slice(0, 200);
  const client = new GBPClient(token);
  const account = withPrefix(location.gbp_account_id, 'accounts');
  const loc = withPrefix(location.gbp_location_id, 'locations');
  const now = new Date().toISOString();
  const results: { media_id: string; gbp_media_name?: string; error?: string }[] = [];

  for (const photo of photos) {
    try {
      const res = await client.createMedia(account, loc, {
        mediaFormat: 'PHOTO',
        sourceUrl: photo.url,
        locationAssociation: { category: 'ADDITIONAL' },
        ...(caption ? { description: caption } : {}),
      });
      await supabase.from('job_snap_media').update({ gbp_media_name: res.name, gbp_uploaded_at: now }).eq('id', photo.media_id);
      results.push({ media_id: photo.media_id, gbp_media_name: res.name });
    } catch (e) {
      results.push({ media_id: photo.media_id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const uploaded = results.filter((r) => r.gbp_media_name).length;
  const failures = results.filter((r) => r.error);
  if (uploaded === 0) return fail(supabase, action.id, failures[0]?.error || 'Upload failed');

  await supabase
    .from('pending_actions')
    .update({
      status: 'published',
      payload: { ...action.payload, caption, results },
      published_at: now,
      decided_at: now,
      decided_by: opts.decidedBy ?? null,
      auto_published: !!opts.autoPublished,
      error: failures.length ? `${failures.length} of ${photos.length} failed: ${failures[0].error}` : null,
      updated_at: now,
    })
    .eq('id', action.id);
  return { ok: true, uploaded, failed: failures.length };
}

async function fail(supabase: SupabaseClient, actionId: string, error: string): Promise<{ ok: false; error: string }> {
  await supabase.from('pending_actions').update({ status: 'failed', error, updated_at: new Date().toISOString() }).eq('id', actionId);
  return { ok: false, error };
}

// ── Daily tick ──────────────────────────────────────────────────────────────

export interface GbpTickSummary { siteId: string; post?: string; photo?: string; skipped?: string }

/** What the daily cron does for one site: draft a post and/or queue a photo when due. */
export async function runGbpAutomationForSite(supabase: SupabaseClient, siteId: string): Promise<GbpTickSummary> {
  const out: GbpTickSummary = { siteId };
  const { data: site } = await supabase.from('sites').select('settings, status').eq('id', siteId).single();
  if (!site || site.status !== 'active') return { ...out, skipped: 'inactive' };
  const settings = gbpPostSettings(site.settings);
  if (!settings.enabled && !settings.photoDrip) return { ...out, skipped: 'off' };

  const [{ data: lastPost }, { data: lastPhoto }] = await Promise.all([
    supabase.from('pending_actions').select('created_at').eq('site_id', siteId).eq('action_type', 'gbp_post').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('pending_actions').select('created_at').eq('site_id', siteId).eq('action_type', 'photo_upload').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (settings.enabled && isDue(lastPost?.created_at, settings.cadenceDays)) {
    const r = await createGbpPostDraft(supabase, siteId);
    out.post = r.ok ? `${r.status} (${r.source})` : `error: ${r.error}`;
  } else if (settings.enabled) {
    out.post = 'not due';
  }

  if (settings.photoDrip && isDue(lastPhoto?.created_at, settings.photoEveryDays)) {
    const r = await queueNextPhoto(supabase, siteId);
    out.photo = r.ok ? r.status : `error: ${r.error}`;
  } else if (settings.photoDrip) {
    out.photo = 'not due';
  }
  return out;
}
