import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// GET - Fetch current branding settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get site and verify ownership
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, settings, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Verify user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;

  return NextResponse.json({
    brandColor: settings.brand_color || null,
    logoUrl: settings.logo_url || null,
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

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get site and verify ownership
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Verify user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  const body = await request.json();
  const { brandColor, logoUrl } = body;

  // Validate brand color format
  if (brandColor !== undefined && brandColor !== null) {
    if (typeof brandColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { error: 'Invalid brand color format. Use hex format like #10b981' },
        { status: 400 }
      );
    }
  }

  // Merge with existing settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    brand_color: brandColor !== undefined ? brandColor : currentSettings.brand_color,
    logo_url: logoUrl !== undefined ? logoUrl : currentSettings.logo_url,
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
  const { data: siteData } = await adminSupabase
    .from('sites')
    .select('slug')
    .eq('id', siteId)
    .single();

  if (siteData?.slug) {
    revalidatePath(`/sites/${siteData.slug}`, 'layout');
  }

  return NextResponse.json({
    success: true,
    brandColor: updatedSettings.brand_color,
    logoUrl: updatedSettings.logo_url,
  });
}
