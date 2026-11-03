import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/integrations/crypto';
import { resolvePublicOrigin } from '@/lib/sites/public-origin';
import { toGbpPostSummary } from '@/lib/job-snaps/transforms';
import { ensureBrandedPhoto, loadBrandContext } from '@/lib/automation/branded-photo';
import type { GbpPostContext } from '@/lib/automation/gbp-types';
import { publishToPage, publishToInstagram, isMetaAuthError, META_RECONNECT_MESSAGE } from './meta';
import { ensureInstagramPhoto } from './image';
import type { SocialPlatform, SocialPostContext, SocialConnectionView, SocialSettings } from './types';
import type { JobSnapWithRelations, PendingAction, SiteSettings } from '@/types/database';

/**
 * Social fan-out. Two triggers, one queue:
 *   - a Job Snap published to the website  -> one social_post per connected channel
 *   - a Google Business Profile post sent  -> same post to the connected channels
 * Approve mode parks them in pending_actions; autopilot publishes right away.
 * Instagram needs a photo, so text-only Google posts skip it.
 */

export const SOCIAL_MAX_IMAGES = 4;

export function socialSettings(settings: SiteSettings | null | undefined): SocialSettings {
  const raw = ((settings as { automation?: { social?: Record<string, unknown> } } | null)?.automation?.social) || {};
  return { snaps: raw.snaps !== false, gbpPosts: raw.gbp_posts !== false };
}

interface ConnectionRow {
  id: string; platform: string; account_id: string; account_name: string | null; access_token: string; is_active: boolean;
  metadata: Record<string, unknown> | null; created_at: string;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram'];

export async function listSocialConnections(supabase: SupabaseClient, siteId: string): Promise<SocialConnectionView[]> {
  const { data } = await supabase
    .from('social_connections')
    .select('id, platform, account_id, account_name, is_active, metadata, created_at')
    .eq('site_id', siteId)
    .in('platform', SOCIAL_PLATFORMS)
    .order('platform')
    .order('account_name');
  return ((data || []) as Omit<ConnectionRow, 'access_token'>[]).map((c) => ({
    id: c.id,
    platform: c.platform as SocialPlatform,
    account_id: c.account_id,
    account_name: c.account_name || c.account_id,
    is_active: c.is_active,
    picture: (c.metadata?.picture as string | undefined) || null,
    page_name: (c.metadata?.page_name as string | undefined) || null,
    connected_at: c.created_at,
  }));
}

async function activeConnections(supabase: SupabaseClient, siteId: string): Promise<ConnectionRow[]> {
  const { data } = await supabase
    .from('social_connections')
    .select('id, platform, account_id, account_name, access_token, is_active, metadata, created_at')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .in('platform', SOCIAL_PLATFORMS);
  return (data || []) as ConnectionRow[];
}

/** Caption for channels where links are not clickable (Instagram). */
export function instagramCaption(message: string, link: string): string {
  let host = '';
  try { host = new URL(link).host.replace(/^www\./, ''); } catch { /* no link */ }
  return host ? `${message}\n\nMore at ${host}` : message;
}

interface QueueResult { queued: number; published: number; skipped: string[]; errors: string[] }

async function queueForConnections(
  supabase: SupabaseClient,
  siteId: string,
  mode: 'approve' | 'autopilot',
  conns: ConnectionRow[],
  build: (platform: SocialPlatform) => { ctx: Omit<SocialPostContext, 'platform' | 'connection_id' | 'account_id' | 'account_name'>; message: string; sourceKey: string } | null,
  opts: { sendNow?: boolean; decidedBy?: string | null }
): Promise<QueueResult> {
  const out: QueueResult = { queued: 0, published: 0, skipped: [], errors: [] };
  for (const c of conns) {
    const platform = c.platform as SocialPlatform;
    const built = build(platform);
    if (!built) { out.skipped.push(`${c.account_name || platform}: needs a photo`); continue; }
    const context: SocialPostContext = { platform, connection_id: c.id, account_id: c.account_id, account_name: c.account_name || c.account_id, ...built.ctx };
    const sourceKey = `${built.sourceKey}:${platform}:${c.account_id}`;
    const { data: action, error } = await supabase
      .from('pending_actions')
      .upsert({ site_id: siteId, action_type: 'social_post', status: 'pending', payload: { message: built.message }, context, source_key: sourceKey }, { onConflict: 'site_id,source_key', ignoreDuplicates: true })
      .select('*')
      .maybeSingle();
    if (error) { out.errors.push(error.message); continue; }
    if (!action) { out.skipped.push(`${c.account_name || platform}: already shared`); continue; }
    if (opts.sendNow || mode === 'autopilot') {
      const pub = await publishSocialPost(supabase, action as PendingAction, { decidedBy: opts.decidedBy ?? null, autoPublished: !opts.sendNow });
      if (pub.ok) out.published += 1; else out.errors.push(`${c.account_name || platform}: ${pub.error}`);
    } else {
      out.queued += 1;
    }
  }
  return out;
}

/** Lead image first (after > primary > first), then the rest in order; before-photos stay in so before/after jobs read as a story. */
export function orderSnapImages<T extends { role?: string | null; sort_order?: number }>(media: T[]): T[] {
  const sorted = [...media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const lead = sorted.find((m) => m.role === 'after') || sorted.find((m) => m.role === 'primary') || sorted[0];
  if (!lead) return [];
  return [lead, ...sorted.filter((m) => m !== lead)].slice(0, SOCIAL_MAX_IMAGES);
}

/** Share a Job Snap that was just published to the website. */
export async function queueSnapSocialPosts(supabase: SupabaseClient, snapId: string, opts: { sendNow?: boolean; decidedBy?: string | null } = {}): Promise<QueueResult & { skippedAll?: string }> {
  const { data: snap } = await supabase.from('job_snaps').select('*, media:job_snap_media(*), service:services(*)').eq('id', snapId).single();
  if (!snap) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'snap not found' };
  const typed = snap as unknown as JobSnapWithRelations & { work_item_id: string | null };
  const { data: site } = await supabase.from('sites').select('id, name, slug, settings, automation_mode, custom_domain, custom_domain_verified').eq('id', typed.site_id).single();
  if (!site) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'site not found' };
  if (!socialSettings(site.settings).snaps) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'sharing Job Snaps is off' };
  const conns = await activeConnections(supabase, typed.site_id);
  if (conns.length === 0) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'no social channels connected' };

  const origin = await resolvePublicOrigin(supabase, site);
  let link = `${origin}/work`;
  if (typed.work_item_id) {
    const { data: wi } = await supabase.from('work_items').select('slug').eq('id', typed.work_item_id).maybeSingle();
    if (wi?.slug) link = `${origin}/work/${wi.slug}`;
  }
  const title = typed.title || typed.ai_generated_title || 'Recent work';
  const message = toGbpPostSummary(typed);

  const brand = await loadBrandContext(supabase, typed.site_id);
  const ordered = orderSnapImages((typed.media || []) as { storage_path: string; role?: string | null; sort_order?: number }[]);
  const branded: string[] = [];
  for (const m of ordered) {
    const original = supabase.storage.from('job-snap-media').getPublicUrl(m.storage_path).data.publicUrl;
    branded.push(await ensureBrandedPhoto(supabase, typed.site_id, original, { title, city: typed.city || null }, brand));
  }
  const igImages: string[] = [];
  if (conns.some((c) => c.platform === 'instagram')) {
    for (const u of branded) igImages.push(await ensureInstagramPhoto(supabase, typed.site_id, u));
  }
  const sourceKey = `social_post:work:${typed.work_item_id || typed.id}`;
  return queueForConnections(supabase, typed.site_id, site.automation_mode, conns, (platform) => {
    const images = platform === 'instagram' ? igImages : branded;
    if (platform === 'instagram' && images.length === 0) return null;
    return {
      ctx: { source: 'snap', source_id: typed.work_item_id || typed.id, source_label: title, link, image_urls: images },
      message: platform === 'instagram' ? instagramCaption(message, link) : message,
      sourceKey,
    };
  }, opts);
}

/** Share a Google Business Profile post that was just published. */
export async function queueGbpPostSocial(supabase: SupabaseClient, action: PendingAction, summary: string, opts: { decidedBy?: string | null } = {}): Promise<QueueResult & { skippedAll?: string }> {
  const { data: site } = await supabase.from('sites').select('id, settings, automation_mode').eq('id', action.site_id).single();
  if (!site) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'site not found' };
  if (!socialSettings(site.settings).gbpPosts) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'sharing Google posts is off' };
  const conns = await activeConnections(supabase, action.site_id);
  if (conns.length === 0) return { queued: 0, published: 0, skipped: [], errors: [], skippedAll: 'no social channels connected' };
  const ctx = action.context as unknown as GbpPostContext;
  const images = ctx.media_url ? [ctx.media_url] : [];
  const igImages = images.length && conns.some((c) => c.platform === 'instagram') ? [await ensureInstagramPhoto(supabase, action.site_id, images[0])] : [];
  // A 'work' post is about a Job Snap: key it by the work item so the snap's own share and this one never both go out.
  const sourceKey = ctx.source === 'work' && ctx.source_id ? `social_post:work:${ctx.source_id}` : `social_post:gbp:${action.id}`;
  return queueForConnections(supabase, action.site_id, site.automation_mode, conns, (platform) => {
    if (platform === 'instagram' && igImages.length === 0) return null;
    return {
      ctx: { source: 'gbp_post', source_id: action.id, source_label: ctx.source_label, link: ctx.cta_url, image_urls: platform === 'instagram' ? igImages : images },
      message: platform === 'instagram' ? instagramCaption(summary, ctx.cta_url) : summary,
      sourceKey,
    };
  }, { decidedBy: opts.decidedBy });
}

async function fail(supabase: SupabaseClient, actionId: string, error: string): Promise<{ ok: false; error: string }> {
  await supabase.from('pending_actions').update({ status: 'failed', error, updated_at: new Date().toISOString() }).eq('id', actionId);
  return { ok: false, error };
}

export async function publishSocialPost(
  supabase: SupabaseClient,
  action: PendingAction,
  opts: { messageOverride?: string; decidedBy?: string | null; autoPublished?: boolean } = {}
): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const ctx = action.context as unknown as SocialPostContext;
  const message = (opts.messageOverride?.trim() || String((action.payload as { message?: string }).message || '')).trim();
  if (!message && ctx.image_urls.length === 0) return fail(supabase, action.id, 'Empty post');

  const { data: conn } = await supabase.from('social_connections').select('id, platform, account_id, access_token, is_active').eq('id', ctx.connection_id).maybeSingle();
  if (!conn) return fail(supabase, action.id, `${ctx.account_name} is no longer connected`);
  if (!conn.is_active) return fail(supabase, action.id, `Posting to ${ctx.account_name} is turned off`);
  let token: string;
  try { token = decrypt(conn.access_token); } catch { return fail(supabase, action.id, META_RECONNECT_MESSAGE); }

  try {
    const res = ctx.platform === 'instagram'
      ? await publishToInstagram(conn.account_id, token, { message, imageUrls: ctx.image_urls })
      : await publishToPage(conn.account_id, token, { message, link: ctx.link, imageUrls: ctx.image_urls });
    const now = new Date().toISOString();
    await supabase
      .from('pending_actions')
      .update({ status: 'published', payload: { ...action.payload, message, external_post_id: res.id, post_url: res.url }, published_at: now, decided_at: now, decided_by: opts.decidedBy ?? null, auto_published: !!opts.autoPublished, error: null, updated_at: now })
      .eq('id', action.id);
    return { ok: true, url: res.url };
  } catch (e) {
    const msg = isMetaAuthError(e) ? META_RECONNECT_MESSAGE : e instanceof Error ? e.message : String(e);
    return fail(supabase, action.id, msg);
  }
}
