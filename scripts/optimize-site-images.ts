/**
 * One-time backfill: push every image a site serves through the image
 * pipeline (src/lib/images/optimize.ts) — resized for its slot, WebP, EXIF
 * stripped, named from what it is — and repoint every reference at the new
 * file. Sites built before the pipeline existed were serving raw uploads
 * (1.8 MB iPhone originals) and raw 1.5 MB PNGs from image generation.
 *
 * Originals are left in storage (old URLs keep working; nothing is deleted).
 *
 * Covers: uploaded site assets (logos, person photos, page + service hero
 * images), generated page/service images, and profile avatars. Favicons are
 * left alone (browsers want PNG/ICO there). Job Snap photos are not touched —
 * they are resized in the browser and carry a geotag on purpose.
 *
 * Usage:
 *   npx tsx scripts/optimize-site-images.ts                 # dry run: what would change
 *   npx tsx scripts/optimize-site-images.ts --apply         # write
 *   npx tsx scripts/optimize-site-images.ts --site <id>     # one site only
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { optimizeImage, imageSlug, type ImagePreset } from '../src/lib/images/optimize';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const siteArg = process.argv.indexOf('--site');
const onlySite = siteArg > -1 ? process.argv[siteArg + 1] : null;
const sb = createClient(url, key);
const BUCKET = 'site-assets';

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const stats = { files: 0, bytesIn: 0, bytesOut: 0, failed: 0 };

async function download(path: string): Promise<Buffer | null> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Optimize one stored file into `${toStem}.${ext}` (ext decided by the
 * pipeline: webp, or the original format when that is already the better
 * file). Returns the new path + size + content type, or null on failure.
 */
async function reencode(fromPath: string, toStem: string, preset: ImagePreset, contentType?: string) {
  const input = await download(fromPath);
  if (!input) { console.log(`    ! could not download ${fromPath}`); stats.failed++; return null; }
  const out = await optimizeImage(input, { preset, contentType });
  const toPath = `${toStem}.${out.ext}`;
  stats.files++; stats.bytesIn += out.bytesIn; stats.bytesOut += out.bytesOut;
  const same = toPath === fromPath && out.bytesOut === out.bytesIn;
  console.log(`    ${fromPath}\n      → ${toPath}  ${kb(out.bytesIn)} → ${kb(out.bytesOut)}${same ? '  (unchanged)' : ''}`);
  const result = { path: toPath, size: out.bytesOut, width: out.width, height: out.height, contentType: out.contentType };
  if (!apply || same) return result;
  const { error } = await sb.storage.from(BUCKET).upload(toPath, out.buffer, { contentType: out.contentType, upsert: true });
  if (error) { console.log(`    ! upload failed: ${error.message}`); stats.failed++; return null; }
  // The original is left in place so every old URL keeps working and the
  // run can be reverted by pointing references back.
  return result;
}

interface SiteRow { id: string; name: string; settings: Record<string, unknown> | null }
interface AssetRow { id: string; asset_type: string; storage_path: string; public_path: string; content_type: string; file_size: number }
interface GeneratedImage { url: string; storage_path: string; width: number; height: number; [k: string]: unknown }

async function siteContext(site: SiteRow) {
  const s = (site.settings || {}) as { primary_market_city?: string; primary_market_state?: string };
  const [{ data: loc }, { data: cats }] = await Promise.all([
    sb.from('locations').select('city, state').eq('site_id', site.id).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
    sb.from('site_categories').select('is_primary, gbp_category:gbp_categories(display_name)').eq('site_id', site.id).order('is_primary', { ascending: false }),
  ]);
  const primary = (cats || [])[0] as { gbp_category?: { display_name?: string } | { display_name?: string }[] } | undefined;
  const gc = Array.isArray(primary?.gbp_category) ? primary?.gbp_category[0] : primary?.gbp_category;
  return { trade: gc?.display_name || null, city: s.primary_market_city || loc?.city || null, state: s.primary_market_state || loc?.state || null };
}

async function processSite(site: SiteRow) {
  console.log(`\n# ${site.name} (${site.id})`);
  const ctx = await siteContext(site);
  const settings = (site.settings || {}) as Record<string, unknown>;
  const settingsJson = JSON.stringify(settings);
  const person = settings.about_featured_person as { name?: string; photo_url?: string } | undefined;
  const faviconPath = typeof settings.favicon_url === 'string' ? settings.favicon_url.replace(/^\/public\//, '') : null;

  const [{ data: assets }, { data: pages }, { data: services }] = await Promise.all([
    sb.from('assets').select('id, asset_type, storage_path, public_path, content_type, file_size').eq('site_id', site.id),
    sb.from('site_pages').select('id, slug, hero_image_url, generated_images').eq('site_id', site.id),
    sb.from('services').select('id, name, hero_image_url, generated_images').eq('site_id', site.id),
  ]);

  // ---- uploaded assets -------------------------------------------------
  const renames = new Map<string, string>(); // old /public/... → new /public/...
  for (const a of (assets || []) as AssetRow[]) {
    if (a.content_type === 'image/svg+xml' || a.storage_path.endsWith('.svg')) continue;
    if (a.asset_type === 'job_snap_asset') continue;
    if (faviconPath && a.public_path === faviconPath) continue;
    if (a.content_type === 'image/webp' && a.file_size < 300 * 1024) continue; // already through the pipeline

    const ref = `/public/${a.public_path}`;
    let preset: ImagePreset = 'content';
    let name: Array<string | null | undefined>;
    const page = (pages || []).find((p) => p.hero_image_url === ref);
    const service = (services || []).find((s) => s.hero_image_url === ref);
    if (settings.logo_url === ref) { preset = 'logo'; name = [site.name, 'logo']; }
    else if (person?.photo_url === ref) { preset = 'person'; name = [person?.name || 'team', ctx.trade, site.name]; }
    else if (page) { preset = 'hero'; name = [ctx.trade, ctx.city, ctx.state, page.slug, 'hero']; }
    else if (service) { preset = 'hero'; name = [service.name, ctx.city, ctx.state, 'hero']; }
    else { name = [a.public_path.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '')]; }

    const subfolder = a.asset_type === 'brand_asset' ? 'brand' : 'site';
    const prefix = a.asset_type === 'brand_asset' ? 'assets/brand' : 'assets/site';
    let stem = imageSlug(name);
    // another asset already owns that name → keep both distinct
    if ((assets || []).some((o) => o.id !== a.id && o.public_path.replace(/\.[a-z0-9]+$/i, '') === `${prefix}/${stem}`)) stem = `${stem}-${a.id.slice(0, 6)}`;

    const done = await reencode(a.storage_path, `${site.id}/${subfolder}/${stem}`, preset, a.content_type);
    if (!done || !apply || done.path === a.storage_path) continue;
    const newPublic = `${prefix}/${done.path.split('/').pop()}`;
    await sb.from('assets').update({ storage_path: done.path, public_path: newPublic, content_type: done.contentType, file_size: done.size }).eq('id', a.id);
    renames.set(ref, `/public/${newPublic}`);
  }

  if (apply && renames.size > 0) {
    let json = settingsJson;
    for (const [from, to] of renames) json = json.split(from).join(to);
    if (json !== settingsJson) await sb.from('sites').update({ settings: JSON.parse(json) }).eq('id', site.id);
    for (const p of pages || []) {
      if (p.hero_image_url && renames.has(p.hero_image_url)) await sb.from('site_pages').update({ hero_image_url: renames.get(p.hero_image_url) }).eq('id', p.id);
    }
    for (const s of services || []) {
      if (s.hero_image_url && renames.has(s.hero_image_url)) await sb.from('services').update({ hero_image_url: renames.get(s.hero_image_url) }).eq('id', s.id);
    }
  }

  // ---- generated images (services reuse their category's files) --------
  const converted = new Map<string, GeneratedImage>(); // old storage_path → new entry
  const convertList = async (images: GeneratedImage[] | null): Promise<GeneratedImage[] | null> => {
    if (!images?.length) return images;
    let changed = false;
    const out: GeneratedImage[] = [];
    for (const img of images) {
      if (!img.storage_path || img.storage_path.endsWith('.webp')) { out.push(img); continue; }
      let next = converted.get(img.storage_path);
      if (!next) {
        const stem = img.storage_path.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');
        const done = await reencode(img.storage_path, `${site.id}/generated/${stem}`, 'content');
        if (!done || done.path === img.storage_path) { out.push(img); continue; }
        next = { ...img, url: `/public/images/${done.path.split('/').pop()}`, storage_path: done.path, width: done.width ?? img.width, height: done.height ?? img.height };
        converted.set(img.storage_path, next);
      }
      out.push(next); changed = true;
    }
    return changed ? out : images;
  };
  for (const p of pages || []) {
    const next = await convertList(p.generated_images as GeneratedImage[] | null);
    if (apply && next !== p.generated_images) await sb.from('site_pages').update({ generated_images: next }).eq('id', p.id);
  }
  for (const s of services || []) {
    const next = await convertList(s.generated_images as GeneratedImage[] | null);
    if (apply && next !== s.generated_images) await sb.from('services').update({ generated_images: next }).eq('id', s.id);
  }

  if (apply) await sb.from('sites').update({ updated_at: new Date().toISOString() }).eq('id', site.id);
}

async function processAvatars() {
  console.log('\n# Profile avatars');
  const { data: profiles } = await sb.from('profiles').select('id, full_name, title, avatar_url, organization:organizations(name), assignments:profile_site_assignments(site:sites(name))').not('avatar_url', 'is', null);
  for (const p of profiles || []) {
    const m = (p.avatar_url as string).match(/\/storage\/v1\/object\/public\/site-assets\/(avatars\/[^?]+)$/);
    if (!m || m[1].endsWith('.webp') || m[1].endsWith('.svg')) continue;
    // Company = the site the person works on, else the org (see avatarCompanyName).
    const org = Array.isArray(p.organization) ? p.organization[0] : p.organization;
    const first = (p.assignments as { site: { name?: string } | { name?: string }[] | null }[] | null)?.[0]?.site;
    const siteName = Array.isArray(first) ? first[0]?.name : first?.name;
    const company = siteName || (org as { name?: string } | null)?.name;
    const stem = p.full_name ? imageSlug([p.full_name, p.title, company]) : `avatar-${p.id.slice(0, 8)}`;
    const done = await reencode(m[1], `avatars/${p.id}/${stem}`, 'avatar');
    if (!done || !apply || done.path === m[1]) continue;
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(done.path);
    await sb.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', p.id);
  }
}

async function main() {
  console.log(apply ? 'APPLY mode — writing changes' : 'DRY RUN — nothing is written (add --apply)');
  let q = sb.from('sites').select('id, name, settings');
  if (onlySite) q = q.eq('id', onlySite);
  const { data: sites, error } = await q.order('created_at');
  if (error) throw error;
  for (const site of (sites || []) as SiteRow[]) await processSite(site);
  if (!onlySite) await processAvatars();
  console.log(`\nDone. ${stats.files} files, ${kb(stats.bytesIn)} → ${kb(stats.bytesOut)}, ${stats.failed} failed.${apply ? '' : ' (dry run)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
