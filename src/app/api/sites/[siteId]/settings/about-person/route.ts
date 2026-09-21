import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import type { SiteSettings } from '@/types/database';

// Resolve a stored /public/assets/... path to a dashboard-accessible proxy path.
function toDashboardUrl(siteId: string, storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  if (storedUrl.startsWith('/public/assets/')) {
    return `/api/sites/${siteId}/${storedUrl.replace('/public/', '')}`;
  }
  return storedUrl;
}

// Normalize a dashboard proxy path back to the clean /public/ form for storage.
function normalizePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^\/api\/sites\/[^/]+\/(.+)$/);
  return m ? `/public/${m[1]}` : url;
}

// GET - current featured person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: site, error } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const fp = (site.settings as SiteSettings | null)?.about_featured_person;
  return NextResponse.json({
    name: fp?.name || '',
    title: fp?.title || '',
    photoUrl: toDashboardUrl(siteId, fp?.photo_url),
  });
}

// PATCH - update featured person (name/title/photoUrl). Send name:'' to clear.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, title, photoUrl } = body as { name?: string; title?: string; photoUrl?: string | null };

  const current = (site.settings || {}) as SiteSettings;
  const featured = {
    name: (name ?? current.about_featured_person?.name ?? '').trim(),
    title: (title ?? current.about_featured_person?.title ?? '').trim(),
    photo_url:
      photoUrl !== undefined ? normalizePath(photoUrl) : (current.about_featured_person?.photo_url ?? null),
  };

  const updatedSettings = { ...current, about_featured_person: featured };

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('sites')
    .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update featured person:', updateError);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  // Busts the About page cache so the new person appears immediately.
  await revalidateSite(siteId);

  return NextResponse.json({
    success: true,
    name: featured.name,
    title: featured.title,
    photoUrl: toDashboardUrl(siteId, featured.photo_url),
  });
}
