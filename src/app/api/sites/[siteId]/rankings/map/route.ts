import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';

/**
 * Muted Google Static Map behind a rankings heatmap. Proxied so the server
 * Maps key never reaches the browser. Always square; `size` is the CSS width,
 * served at 2x for sharp text on retina screens.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: 'Maps key not configured' }, { status: 503 });

  const q = req.nextUrl.searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  const zoom = Math.min(18, Math.max(6, Math.round(Number(q.get('zoom')) || 12)));
  const size = Math.min(640, Math.max(200, Math.round(Number(q.get('size')) || 400)));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const styles = [
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:road|element:labels.icon|visibility:off',
    'feature:all|saturation:-55|lightness:18',
    'feature:water|color:0xcfe3ee',
  ];
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('center', `${lat.toFixed(6)},${lng.toFixed(6)}`);
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('size', `${size}x${size}`);
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  for (const s of styles) url.searchParams.append('style', s);
  url.searchParams.set('key', key);

  const upstream = await fetch(url.toString());
  if (!upstream.ok) return NextResponse.json({ error: `Static map ${upstream.status}` }, { status: 502 });
  const png = await upstream.arrayBuffer();
  return new NextResponse(png, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/png',
      // The map under a scan does not change; let the browser keep it for a day.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
