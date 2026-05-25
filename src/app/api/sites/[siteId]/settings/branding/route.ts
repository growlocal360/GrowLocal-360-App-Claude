import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';

// GET - Fetch current branding settings
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

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;

  // Helper: resolve a stored logo URL to a dashboard-accessible path
  const toDashboardUrl = (storedUrl: string | null | undefined): string | null => {
    if (!storedUrl) return null;
    if (storedUrl.startsWith('/public/assets/')) {
      return `/api/sites/${siteId}/${storedUrl.replace('/public/', '')}`;
    }
    return storedUrl;
  };

  return NextResponse.json({
    brandColor: settings.brand_color || null,
    secondaryColor: settings.secondary_color || null,
    ctaColor: settings.cta_color || null,
    logoUrl: toDashboardUrl(settings.logo_url),
    logoDarkUrl: toDashboardUrl(settings.logo_dark_url),
    siteName: site.name,
  });
}

// PATCH - Update branding settings
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

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Parse request body
  const body = await request.json();
  const { brandColor, secondaryColor, ctaColor, logoUrl, logoDarkUrl } = body;

  // Validate brand color format
  if (brandColor !== undefined && brandColor !== null) {
    if (typeof brandColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { error: 'Invalid brand color format. Use hex format like #10b981' },
        { status: 400 }
      );
    }
  }

  // Normalize a logo URL: convert admin proxy paths back to clean /public/ format
  const normalizeLogoPath = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const adminPathMatch = url.match(/^\/api\/sites\/[^/]+\/(.+)$/);
    return adminPathMatch ? `/public/${adminPathMatch[1]}` : url;
  };

  const cleanLogoUrl = logoUrl !== undefined ? normalizeLogoPath(logoUrl) : undefined;
  const cleanLogoDarkUrl = logoDarkUrl !== undefined ? normalizeLogoPath(logoDarkUrl) : undefined;

  // Merge with existing settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    brand_color: brandColor !== undefined ? brandColor : currentSettings.brand_color,
    secondary_color: secondaryColor !== undefined ? secondaryColor : currentSettings.secondary_color,
    cta_color: ctaColor !== undefined ? ctaColor : currentSettings.cta_color,
    logo_url: cleanLogoUrl !== undefined ? cleanLogoUrl : currentSettings.logo_url,
    logo_dark_url: cleanLogoDarkUrl !== undefined ? cleanLogoDarkUrl : currentSettings.logo_dark_url,
  };

  // Update site settings (use admin client to bypass RLS)
  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('sites')
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update branding settings:', updateError);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }

  // Revalidate public site pages so branding changes appear immediately
  await revalidateSite(siteId);

  // Resolve logo URLs back to dashboard-accessible paths for client preview
  const toDashboardUrl = (storedUrl: string | null | undefined): string | null => {
    if (!storedUrl) return null;
    if (storedUrl.startsWith('/public/assets/')) {
      return `/api/sites/${siteId}/${storedUrl.replace('/public/', '')}`;
    }
    return storedUrl;
  };

  return NextResponse.json({
    success: true,
    brandColor: updatedSettings.brand_color,
    secondaryColor: updatedSettings.secondary_color,
    ctaColor: updatedSettings.cta_color,
    logoUrl: toDashboardUrl(updatedSettings.logo_url),
    logoDarkUrl: toDashboardUrl(updatedSettings.logo_dark_url),
  });
}
