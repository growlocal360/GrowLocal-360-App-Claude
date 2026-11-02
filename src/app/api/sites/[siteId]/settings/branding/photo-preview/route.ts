import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { loadBrandContext, loadLogoPng, placeholderPhoto, renderBrandedPhoto, type BrandedPhotoSettings } from '@/lib/automation/branded-photo';

/**
 * GET /api/sites/[siteId]/settings/branding/photo-preview?logo=1&title=1&city=1&phone=0&style=bar
 * Live preview of the branded-photo look using the site's newest published
 * Job Snap photo (or a neutral placeholder). Options come from the query so
 * the page can preview before saving.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const q = req.nextUrl.searchParams;
  const flag = (k: string, d: boolean) => (q.has(k) ? q.get(k) === '1' : d);
  const settings: BrandedPhotoSettings = {
    enabled: true,
    showLogo: flag('logo', true),
    showTitle: flag('title', true),
    showCity: flag('city', true),
    showPhone: flag('phone', false),
    style: q.get('style') === 'badge' ? 'badge' : 'bar',
  };

  const admin = createAdminClient();
  const ctx = await loadBrandContext(admin, siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const logoPng = settings.showLogo ? (ctx.logoPng ?? (await loadLogoPng(admin, siteId, ctx.logoKey))) : null;

  const { data: media } = await admin
    .from('job_snap_media')
    .select('storage_path, role, snap:job_snaps!inner(site_id, title, ai_generated_title, city, is_published_to_website)')
    .eq('snap.site_id', siteId)
    .eq('snap.is_published_to_website', true)
    .neq('role', 'before')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let photo: Buffer;
  let title = 'Dryer vent cleaning and belt replacement';
  let city: string | null = ctx.city;
  if (media) {
    const snap = media.snap as unknown as { title: string | null; ai_generated_title: string | null; city: string | null };
    const { data: file } = await admin.storage.from('job-snap-media').download(media.storage_path);
    photo = file ? Buffer.from(await file.arrayBuffer()) : await placeholderPhoto();
    title = snap.title || snap.ai_generated_title || title;
    city = snap.city || city;
  } else {
    photo = await placeholderPhoto();
  }

  const out = await renderBrandedPhoto(photo, {
    businessName: ctx.site.name,
    title,
    city,
    phone: ctx.phone,
    brandColor: ctx.brandColor,
    logoPng,
    settings,
  });
  return new NextResponse(new Uint8Array(out), { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
}
