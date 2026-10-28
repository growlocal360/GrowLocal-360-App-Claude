import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/assets/types';

/**
 * Per-site icon for /favicon.ico and /apple-touch-icon.png on client hosts.
 * Uploaded favicon (settings.favicon_url) when present, else a letter mark in
 * the brand color so no site ever shows the platform's icon.
 */
export async function siteIconResponse(slug: string, size: number): Promise<Response> {
  const supabase = createAdminClient();
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, settings')
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(1);
  const site = sites?.[0];
  if (!site) return new Response('Not found', { status: 404 });

  const settings = (site.settings || {}) as { favicon_url?: string; brand_color?: string };
  const headers = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };

  if (settings.favicon_url) {
    const bytes = await loadStoredImage(supabase, site.id, settings.favicon_url);
    if (bytes) {
      return new Response(bytes.body, { status: 200, headers: { ...headers, 'Content-Type': bytes.contentType } });
    }
  }

  const letter = (site.name || 'G').trim().charAt(0).toUpperCase();
  const bg = settings.brand_color || '#00ef99';
  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          borderRadius: Math.round(size * 0.2),
          color: readableOn(bg),
          fontSize: Math.round(size * 0.62),
          fontWeight: 800,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size }
  );
  const buf = await img.arrayBuffer();
  return new Response(buf, { status: 200, headers: { ...headers, 'Content-Type': 'image/png' } });
}

/** Resolve a stored asset reference (/public/assets/... or absolute URL) to bytes. */
async function loadStoredImage(
  supabase: ReturnType<typeof createAdminClient>,
  siteId: string,
  stored: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    if (/^https?:\/\//i.test(stored)) {
      const res = await fetch(stored, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      return { body: await res.arrayBuffer(), contentType: res.headers.get('content-type') || 'image/png' };
    }
    const publicPath = stored.replace(/^\/public\//, '');
    const { data: asset } = await supabase
      .from('assets')
      .select('storage_path, content_type')
      .eq('site_id', siteId)
      .eq('public_path', publicPath)
      .maybeSingle();
    if (!asset) return null;
    const { data: file, error } = await supabase.storage.from(ASSET_BUCKET).download(asset.storage_path);
    if (error || !file) return null;
    return { body: await file.arrayBuffer(), contentType: asset.content_type || 'image/png' };
  } catch {
    return null;
  }
}

/** Black or white text depending on the background's luminance. */
function readableOn(hex: string): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#000';
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0a0a0b' : '#ffffff';
}
