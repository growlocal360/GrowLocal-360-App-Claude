import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { getStoredGoogleToken } from '@/lib/google/stored-token';
import { GBPClient } from '@/lib/google/gbp-client';
import { loadStoredImage } from '@/lib/sites/site-icon';
import { BRANDED_BUCKET } from '@/lib/automation/branded-photo';

/**
 * Google Business Profile logo and cover photo.
 *   GET  -> readiness + recent published Job Snap photos to choose a cover from
 *   POST { kind: 'logo' }                  -> site logo, squared on white, set as the GBP logo
 *   POST { kind: 'cover', sourceUrl }      -> chosen photo cropped 16:9, set as the GBP cover
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const [{ data: site }, { data: location }, { data: media }] = await Promise.all([
    admin.from('sites').select('settings').eq('id', siteId).single(),
    admin.from('locations').select('gbp_location_id').eq('site_id', siteId).not('gbp_location_id', 'is', null).limit(1).maybeSingle(),
    admin
      .from('job_snap_media')
      .select('id, storage_path, role, snap:job_snaps!inner(site_id, title, ai_generated_title, is_published_to_website)')
      .eq('snap.site_id', siteId)
      .eq('snap.is_published_to_website', true)
      .neq('role', 'before')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);
  const settings = (site?.settings || {}) as { logo_url?: string; gbp_logo_set_at?: string; gbp_cover_set_at?: string };
  const photos = ((media || []) as unknown as { id: string; storage_path: string; snap: { title: string | null; ai_generated_title: string | null } }[]).map((m) => ({
    id: m.id,
    url: admin.storage.from('job-snap-media').getPublicUrl(m.storage_path).data.publicUrl,
    title: m.snap.title || m.snap.ai_generated_title || '',
  }));
  return NextResponse.json({
    gbpLinked: !!location?.gbp_location_id,
    hasLogo: !!settings.logo_url,
    logoSetAt: settings.gbp_logo_set_at || null,
    coverSetAt: settings.gbp_cover_set_at || null,
    photos,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { kind?: 'logo' | 'cover'; sourceUrl?: string };
  if (body.kind !== 'logo' && body.kind !== 'cover') return NextResponse.json({ error: 'kind must be logo or cover' }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: site }, { data: location }] = await Promise.all([
    admin.from('sites').select('settings').eq('id', siteId).single(),
    admin.from('locations').select('gbp_account_id, gbp_location_id').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (!location?.gbp_account_id || !location.gbp_location_id) return NextResponse.json({ error: 'No Google Business Profile location linked' }, { status: 400 });
  const token = await getStoredGoogleToken(admin, siteId);
  if (!token) return NextResponse.json({ error: 'Google connection expired. Reconnect the Business Profile.' }, { status: 400 });

  const settings = (site.settings || {}) as Record<string, unknown> & { logo_url?: string };
  let bytes: Buffer;
  let storagePath: string;
  let contentType: string;
  const stamp = Date.now();

  try {
    if (body.kind === 'logo') {
      if (!settings.logo_url) return NextResponse.json({ error: 'Upload a logo in Branding first' }, { status: 400 });
      const stored = await loadStoredImage(admin, siteId, settings.logo_url);
      if (!stored) return NextResponse.json({ error: 'Could not read the logo file' }, { status: 400 });
      // Google wants a square logo, at least 250px. Fit on white with breathing room.
      bytes = await sharp(Buffer.from(stored.body), { density: 300 })
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: false })
        .extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#ffffff' })
        .flatten({ background: '#ffffff' })
        .resize(720, 720, { fit: 'contain', background: '#ffffff' })
        .png()
        .toBuffer();
      storagePath = `gbp/${siteId}/logo-${stamp}.png`;
      contentType = 'image/png';
    } else {
      const url = body.sourceUrl || '';
      if (!/\/storage\/v1\/object\/public\/job-snap-media\//.test(url)) return NextResponse.json({ error: 'Pick one of the listed photos' }, { status: 400 });
      const res = await fetch(url);
      if (!res.ok) return NextResponse.json({ error: 'Could not read that photo' }, { status: 400 });
      // Cover is 16:9, at least 1024x576. Center-crop at 1920x1080.
      bytes = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(1920, 1080, { fit: 'cover', position: 'attention' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      storagePath = `gbp/${siteId}/cover-${stamp}.jpg`;
      contentType = 'image/jpeg';
    }

    const { error: upErr } = await admin.storage.from(BRANDED_BUCKET).upload(storagePath, bytes, { contentType, upsert: true, cacheControl: '31536000' });
    if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 });
    const publicUrl = admin.storage.from(BRANDED_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    const client = new GBPClient(token);
    const account = location.gbp_account_id.startsWith('accounts/') ? location.gbp_account_id : `accounts/${location.gbp_account_id}`;
    const loc = location.gbp_location_id.startsWith('locations/') ? location.gbp_location_id : `locations/${location.gbp_location_id}`;
    const created = await client.createMedia(account, loc, {
      mediaFormat: 'PHOTO',
      sourceUrl: publicUrl,
      locationAssociation: { category: body.kind === 'logo' ? 'LOGO' : 'COVER' },
    });

    const key = body.kind === 'logo' ? 'gbp_logo_set_at' : 'gbp_cover_set_at';
    await admin.from('sites').update({ settings: { ...settings, [key]: new Date().toISOString() } }).eq('id', siteId);
    return NextResponse.json({ ok: true, name: created.name, url: publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 502 });
  }
}
