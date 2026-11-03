/**
 * One-time backfill: write GPS + title + business tags into every stored Job
 * Snap JPEG whose job has coordinates. Photos saved before geotagging shipped
 * were re-encoded by the browser and carry no EXIF at all.
 *
 * Lossless: piexif inserts the EXIF segment without re-encoding pixels. Files
 * are overwritten in place at the same storage path, so every existing URL
 * keeps working. Cached branded / Instagram variants are dropped so they are
 * rebuilt (with tags) the next time they are needed.
 *
 * Usage:
 *   npx tsx scripts/backfill-geotags.ts            # dry run: counts only
 *   npx tsx scripts/backfill-geotags.ts --apply    # write
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { geotagJpeg, readGeotag, isJpeg } from '../src/lib/job-snaps/geotag';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const sb = createClient(url, key);

async function main() {
  const { data: snaps, error } = await sb
    .from('job_snaps')
    .select('id, site_id, title, ai_generated_title, city, latitude, longitude, created_at, site:sites(name), media:job_snap_media(id, storage_path, mime_type, exif_data)')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (error) throw error;

  let tagged = 0, skipped = 0, already = 0, failed = 0;
  const touchedSites = new Set<string>();
  for (const snap of snaps || []) {
    const site = snap.site as unknown as { name: string } | null;
    const title = snap.title || snap.ai_generated_title || null;
    for (const m of (snap.media as { id: string; storage_path: string; mime_type: string }[]) || []) {
      if (m.mime_type !== 'image/jpeg') { skipped += 1; continue; }
      const { data: file, error: dlErr } = await sb.storage.from('job-snap-media').download(m.storage_path);
      if (dlErr || !file) { failed += 1; console.warn('download failed', m.storage_path, dlErr?.message); continue; }
      const buf = Buffer.from(await file.arrayBuffer());
      if (!isJpeg(buf)) { skipped += 1; continue; }
      if (await readGeotag(buf)) { already += 1; continue; }
      if (!apply) { tagged += 1; continue; }
      try {
        const out = geotagJpeg(buf, { lat: snap.latitude as number, lng: snap.longitude as number, title, businessName: site?.name || null, city: snap.city, takenAt: new Date(snap.created_at as string) });
        const { error: upErr } = await sb.storage.from('job-snap-media').upload(m.storage_path, out, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
        if (upErr) throw upErr;
        await sb.from('job_snap_media').update({ exif_data: { gps: { lat: snap.latitude, lng: snap.longitude }, geotagged_at: new Date().toISOString(), backfilled: true }, file_size: out.length }).eq('id', m.id);
        touchedSites.add(snap.site_id as string);
        tagged += 1;
      } catch (e) {
        failed += 1;
        console.warn('tag failed', m.storage_path, e instanceof Error ? e.message : e);
      }
    }
  }
  if (apply && touchedSites.size) {
    // Branded / Instagram copies were rendered from untagged originals; rebuild lazily.
    const { error: delErr } = await sb.from('branded_photos').delete().in('site_id', [...touchedSites]);
    if (delErr) console.warn('could not clear branded_photos cache:', delErr.message);
  }
  console.log(`${apply ? 'Tagged' : 'Would tag'} ${tagged} photo(s) across ${snaps?.length || 0} job(s); ${already} already tagged, ${skipped} not JPEG, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
