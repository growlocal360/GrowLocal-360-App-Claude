import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { BRANDED_BUCKET } from '@/lib/automation/branded-photo';

/**
 * Instagram only accepts JPEG between 4:5 (portrait) and 1.91:1 (landscape),
 * at most 1440px wide. Phone photos are often 3:4 or 9:16, which Instagram
 * rejects, so each image is re-encoded and centre-cropped to the nearest
 * allowed ratio. Results are cached in storage (same table as branded photos,
 * keyed by the source URL) so repeated posts don't re-render.
 */

const MIN_RATIO = 0.8; // 4:5
const MAX_RATIO = 1.91;
const SIGNATURE = 'instagram-v1';

export async function fitForInstagram(photo: Buffer): Promise<Buffer> {
  const img = sharp(photo).rotate();
  const meta = await img.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) throw new Error('Could not read image size');
  const ratio = w / h;
  let cropW = w;
  let cropH = h;
  if (ratio < MIN_RATIO) cropH = Math.round(w / MIN_RATIO);
  else if (ratio > MAX_RATIO) cropW = Math.round(h * MAX_RATIO);
  const pipeline = img.extract({ left: Math.floor((w - cropW) / 2), top: Math.floor((h - cropH) / 2), width: cropW, height: cropH });
  return pipeline.resize({ width: 1440, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

/** Public JPEG URL that Instagram will accept for `sourceUrl`; falls back to the source on any failure. */
export async function ensureInstagramPhoto(supabase: SupabaseClient, siteId: string, sourceUrl: string): Promise<string> {
  try {
    const { data: cached } = await supabase.from('branded_photos').select('storage_path, signature').eq('site_id', siteId).eq('source_url', `ig:${sourceUrl}`).maybeSingle();
    if (cached?.signature === SIGNATURE) {
      return supabase.storage.from(BRANDED_BUCKET).getPublicUrl(cached.storage_path).data.publicUrl;
    }
    const res = await fetch(sourceUrl);
    if (!res.ok) return sourceUrl;
    const out = await fitForInstagram(Buffer.from(await res.arrayBuffer()));
    const key = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
    const storagePath = `social/${siteId}/${key}-ig.jpg`;
    const { error: upErr } = await supabase.storage.from(BRANDED_BUCKET).upload(storagePath, out, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
    if (upErr) return sourceUrl;
    await supabase.from('branded_photos').upsert(
      { site_id: siteId, source_url: `ig:${sourceUrl}`, signature: SIGNATURE, storage_path: storagePath, updated_at: new Date().toISOString() },
      { onConflict: 'site_id,source_url' }
    );
    return supabase.storage.from(BRANDED_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  } catch {
    return sourceUrl;
  }
}
