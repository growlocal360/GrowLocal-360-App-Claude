import { createHash } from 'crypto';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadStoredImage } from '@/lib/sites/site-icon';
import type { SiteSettings } from '@/types/database';

/**
 * Branded photos: a Job Snap photo with the business logo, the job title and
 * the city (phone optional) composited on before it goes to the Google
 * Business Profile gallery or a post. The website keeps the original.
 *
 * Rendering: the photo is resized with sharp, the overlay is rendered as a
 * PNG with next/og (so text uses the same font path as the favicon letter
 * mark, which is known to work in production), then composited with sharp
 * and exported as JPEG. Results are cached in storage keyed by source URL +
 * a signature of everything that affects the look.
 */

export const BRANDED_BUCKET = 'job-snap-media';

export interface BrandedPhotoSettings {
  enabled: boolean;
  showLogo: boolean;
  showTitle: boolean;
  showCity: boolean;
  showPhone: boolean;
  style: 'bar' | 'badge';
}

export function brandedPhotoSettings(settings: SiteSettings | null | undefined): BrandedPhotoSettings {
  const raw = ((settings as { branded_photos?: Record<string, unknown> } | null)?.branded_photos) || {};
  return {
    enabled: raw.enabled === true,
    showLogo: raw.show_logo !== false,
    showTitle: raw.show_title !== false,
    showCity: raw.show_city !== false,
    showPhone: raw.show_phone === true,
    style: raw.style === 'badge' ? 'badge' : 'bar',
  };
}

export interface BrandInput {
  businessName: string;
  title: string | null;
  city: string | null;
  phone: string | null;
  brandColor: string;
  logoPng: Buffer | null;
  settings: BrandedPhotoSettings;
}

/** Everything that changes the pixels, hashed, so a cached variant can be reused safely. */
export function brandSignature(input: Omit<BrandInput, 'logoPng'> & { logoKey: string | null }): string {
  const s = input.settings;
  return createHash('sha1')
    .update(JSON.stringify(['v1', s.showLogo, s.showTitle, s.showCity, s.showPhone, s.style, input.businessName, input.title, input.city, input.phone, input.brandColor, input.logoKey]))
    .digest('hex')
    .slice(0, 16);
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

/** Render the overlay (bar or badge) as PNG bytes at an exact size with next/og. */
async function renderOverlay(width: number, height: number, input: BrandInput): Promise<Buffer> {
  const s = input.settings;
  const logoUri = s.showLogo && input.logoPng ? `data:image/png;base64,${input.logoPng.toString('base64')}` : null;
  const title = s.showTitle && input.title ? input.title : null;
  const sub = [s.showCity && input.city ? input.city : null, s.showPhone && input.phone ? input.phone : null].filter(Boolean).join('  ·  ');
  const isBar = s.style === 'bar';
  const pad = Math.round(height * (isBar ? 0.18 : 0.16));
  const logoH = Math.round(height * (isBar ? 0.62 : 0.66));
  // Long titles shrink (down to 70%) before they get cut off.
  const baseTitle = height * (isBar ? 0.28 : 0.3);
  const titleLen = (s.showTitle && input.title ? input.title : input.businessName).length;
  const titleSize = Math.round(baseTitle * Math.max(0.7, Math.min(1, (isBar ? 44 : 22) / Math.max(1, titleLen))));
  const subSize = Math.round(height * (isBar ? 0.19 : 0.22));
  const textLine = title || sub || input.businessName;

  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: pad,
          padding: `0 ${pad}px`,
          background: isBar ? 'rgba(10,10,11,0.80)' : 'rgba(10,10,11,0.86)',
          // satori parses border shorthands as strings; never hand it an undefined value
          ...(isBar
            ? { borderTop: `${Math.max(4, Math.round(height * 0.06))}px solid ${input.brandColor}` }
            : { borderLeft: `${Math.max(4, Math.round(height * 0.08))}px solid ${input.brandColor}`, borderRadius: Math.round(height * 0.18) }),
          color: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {logoUri ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: logoH, padding: `0 ${Math.round(logoH * 0.18)}px`, background: '#ffffff', borderRadius: Math.round(logoH * 0.16) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUri} alt="" style={{ height: Math.round(logoH * 0.72), objectFit: 'contain' }} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{textLine}</div>
          {title && sub.length > 0 ? (
            <div style={{ fontSize: subSize, opacity: 0.85, marginTop: Math.round(subSize * 0.3), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          ) : null}
        </div>
      </div>
    ),
    { width, height }
  );
  return Buffer.from(await img.arrayBuffer());
}

/** Compose the final JPEG. Returns the untouched resized photo when nothing is enabled to show. */
export async function renderBrandedPhoto(photo: Buffer, input: BrandInput): Promise<Buffer> {
  const base = sharp(photo).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await base.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const s = input.settings;
  const anything = (s.showLogo && input.logoPng) || (s.showTitle && input.title) || (s.showCity && input.city) || (s.showPhone && input.phone);
  if (!anything) return data;

  if (s.style === 'bar') {
    const barH = clamp(Math.round(h * 0.13), 88, 180);
    const overlay = await renderOverlay(w, barH, input);
    return sharp(data).composite([{ input: overlay, gravity: 'south' }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
  const badgeH = clamp(Math.round(h * 0.1), 64, 120);
  const badgeW = clamp(Math.round(w * 0.6), 320, 900);
  const margin = Math.round(badgeH * 0.35);
  const overlay = await renderOverlay(badgeW, badgeH, input);
  return sharp(data).composite([{ input: overlay, gravity: 'southeast', top: h - badgeH - margin, left: w - badgeW - margin }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

/** Logo as PNG bytes sized for the overlay (SVGs rasterized), or null. */
export async function loadLogoPng(supabase: SupabaseClient, siteId: string, logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  const stored = await loadStoredImage(supabase, siteId, logoUrl);
  if (!stored) return null;
  try {
    return await sharp(Buffer.from(stored.body), { density: 300 }).resize({ height: 240, fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  } catch {
    return null;
  }
}

interface SiteBrandRow {
  id: string;
  name: string;
  settings: SiteSettings | null;
}

/** Resolve the site-level inputs once per site (name, logo, phone, color, settings). */
export async function loadBrandContext(supabase: SupabaseClient, siteId: string): Promise<{ site: SiteBrandRow; settings: BrandedPhotoSettings; logoPng: Buffer | null; logoKey: string | null; phone: string | null; city: string | null; brandColor: string } | null> {
  const [{ data: site }, { data: location }] = await Promise.all([
    supabase.from('sites').select('id, name, settings').eq('id', siteId).single(),
    supabase.from('locations').select('city, phone').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site) return null;
  const settings = brandedPhotoSettings(site.settings);
  const logoKey = (site.settings as SiteSettings | null)?.logo_url || null;
  const logoPng = settings.enabled && settings.showLogo ? await loadLogoPng(supabase, siteId, logoKey) : null;
  return {
    site: site as SiteBrandRow,
    settings,
    logoPng,
    logoKey,
    phone: (site.settings as SiteSettings | null)?.phone || location?.phone || null,
    city: location?.city || null,
    brandColor: (site.settings as SiteSettings | null)?.brand_color || '#00ef99',
  };
}

/**
 * Branded public URL for a photo, or the original URL when branding is off or
 * anything fails. Never throws: an upload should not be blocked by a frame.
 */
export async function ensureBrandedPhoto(
  supabase: SupabaseClient,
  siteId: string,
  sourceUrl: string,
  job: { title: string | null; city?: string | null },
  ctxCache?: Awaited<ReturnType<typeof loadBrandContext>>
): Promise<string> {
  try {
    const ctx = ctxCache ?? (await loadBrandContext(supabase, siteId));
    if (!ctx || !ctx.settings.enabled) return sourceUrl;

    const input: BrandInput = {
      businessName: ctx.site.name,
      title: job.title,
      city: job.city ?? ctx.city,
      phone: ctx.phone,
      brandColor: ctx.brandColor,
      logoPng: ctx.logoPng,
      settings: ctx.settings,
    };
    const signature = brandSignature({ ...input, logoKey: ctx.logoKey });

    const { data: cached } = await supabase.from('branded_photos').select('storage_path, signature').eq('site_id', siteId).eq('source_url', sourceUrl).maybeSingle();
    if (cached?.signature === signature) {
      return supabase.storage.from(BRANDED_BUCKET).getPublicUrl(cached.storage_path).data.publicUrl;
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) return sourceUrl;
    const photo = Buffer.from(await res.arrayBuffer());
    const out = await renderBrandedPhoto(photo, input);

    const key = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 20);
    const storagePath = `branded/${siteId}/${key}-${signature}.jpg`;
    const { error: upErr } = await supabase.storage.from(BRANDED_BUCKET).upload(storagePath, out, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
    if (upErr) return sourceUrl;
    await supabase.from('branded_photos').upsert({ site_id: siteId, source_url: sourceUrl, signature, storage_path: storagePath, updated_at: new Date().toISOString() }, { onConflict: 'site_id,source_url' });
    return supabase.storage.from(BRANDED_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  } catch (e) {
    console.warn('[branded-photo] falling back to original:', e instanceof Error ? e.message : e);
    return sourceUrl;
  }
}

/** A neutral stand-in photo for the settings preview when a site has no Job Snaps yet. */
export async function placeholderPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9aa3ad"/><stop offset="1" stop-color="#4b5563"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}
