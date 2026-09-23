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
    darkColor: settings.dark_color || null,
    tagline: settings.tagline || '',
    bgScheme: settings.bg_scheme || 'warm',
    bgColor: settings.bg_color || null,
    bgAltColor: settings.bg_alt_color || null,
    heroOverlay: settings.hero_overlay || 'dark',
    heroOverlayColor: settings.hero_overlay_color || null,
    heroOverlayStrength: typeof settings.hero_overlay_strength === 'number' ? settings.hero_overlay_strength : 100,
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
  const { brandColor, secondaryColor, ctaColor, darkColor, tagline, bgScheme, bgColor, bgAltColor, heroOverlay, heroOverlayColor, heroOverlayStrength, logoUrl, logoDarkUrl } = body;

  // Validate brand color format
  if (brandColor !== undefined && brandColor !== null) {
    if (typeof brandColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { error: 'Invalid brand color format. Use hex format like #10b981' },
        { status: 400 }
      );
    }
  }

  if (darkColor !== undefined && darkColor !== null && darkColor !== '') {
    if (typeof darkColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(darkColor)) {
      return NextResponse.json(
        { error: 'Invalid dark background color format. Use hex format like #0a0a0b' },
        { status: 400 }
      );
    }
  }

  const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
  if (bgScheme !== undefined && !['warm', 'light', 'custom'].includes(bgScheme)) {
    return NextResponse.json({ error: 'Invalid background scheme' }, { status: 400 });
  }
  if (heroOverlay !== undefined && !['dark', 'brand', 'dark_color', 'custom'].includes(heroOverlay)) {
    return NextResponse.json({ error: 'Invalid hero overlay option' }, { status: 400 });
  }
  if (heroOverlayStrength !== undefined && (typeof heroOverlayStrength !== 'number' || heroOverlayStrength < 30 || heroOverlayStrength > 100)) {
    return NextResponse.json({ error: 'Hero overlay strength must be between 30 and 100' }, { status: 400 });
  }
  for (const [name, v] of [['bgColor', bgColor], ['bgAltColor', bgAltColor], ['heroOverlayColor', heroOverlayColor]] as const) {
    if (v !== undefined && v !== null && v !== '' && !isHex(v)) {
      return NextResponse.json({ error: `Invalid ${name} format. Use hex format like #ffffff` }, { status: 400 });
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
    dark_color: darkColor !== undefined ? (darkColor || null) : currentSettings.dark_color,
    tagline: typeof tagline === 'string' ? tagline.trim().slice(0, 160) : currentSettings.tagline,
    bg_scheme: bgScheme !== undefined ? bgScheme : currentSettings.bg_scheme,
    bg_color: bgColor !== undefined ? (bgColor || null) : currentSettings.bg_color,
    bg_alt_color: bgAltColor !== undefined ? (bgAltColor || null) : currentSettings.bg_alt_color,
    hero_overlay: heroOverlay !== undefined ? heroOverlay : currentSettings.hero_overlay,
    hero_overlay_color: heroOverlayColor !== undefined ? (heroOverlayColor || null) : currentSettings.hero_overlay_color,
    hero_overlay_strength: heroOverlayStrength !== undefined ? Math.round(heroOverlayStrength) : currentSettings.hero_overlay_strength,
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
    darkColor: updatedSettings.dark_color || null,
    tagline: updatedSettings.tagline || '',
    bgScheme: updatedSettings.bg_scheme || 'warm',
    bgColor: updatedSettings.bg_color || null,
    bgAltColor: updatedSettings.bg_alt_color || null,
    heroOverlay: updatedSettings.hero_overlay || 'dark',
    heroOverlayColor: updatedSettings.hero_overlay_color || null,
    heroOverlayStrength: typeof updatedSettings.hero_overlay_strength === 'number' ? updatedSettings.hero_overlay_strength : 100,
    logoUrl: toDashboardUrl(updatedSettings.logo_url),
    logoDarkUrl: toDashboardUrl(updatedSettings.logo_dark_url),
  });
}
