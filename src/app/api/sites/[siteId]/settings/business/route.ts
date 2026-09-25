import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';

// GET - Fetch current business info
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
    .select('id, name, website_type, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;

  // For single-location sites, fall back to the location's phone
  // (wizard saves phone to locations table, not settings)
  // For multi-location, only use settings.phone (location phones managed separately)
  // Primary location: phone fallback + the address shown on the site.
  const { data: primaryLocation } = await supabase
    .from('locations')
    .select('phone, address_line1, address_line2, city, state, zip_code')
    .eq('site_id', siteId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  let phone = settings.phone || null;
  if (!phone && site.website_type === 'single_location') {
    phone = primaryLocation?.phone || null;
  }

  return NextResponse.json({
    name: site.name,
    phone,
    email: settings.email || null,
    coreIndustry: settings.core_industry || null,
    businessDescription: settings.business_description || '',
    credentials: settings.credentials || '',
    tagline: settings.tagline || '',
    address: {
      line1: primaryLocation?.address_line1 || '',
      line2: primaryLocation?.address_line2 || '',
      city: primaryLocation?.city || '',
      state: primaryLocation?.state || '',
      zip: primaryLocation?.zip_code || '',
    },
    showAddress: settings.show_address !== false,
  });
}

// PATCH - Update business info
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
    .select('id, name, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, phone, email, coreIndustry, businessDescription, credentials, tagline, address, showAddress } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    phone: phone !== undefined ? phone : currentSettings.phone,
    email: email !== undefined ? email : currentSettings.email,
    core_industry: coreIndustry !== undefined ? coreIndustry : currentSettings.core_industry,
    ...(businessDescription !== undefined && { business_description: businessDescription }),
    ...(credentials !== undefined && { credentials }),
    ...(tagline !== undefined && { tagline }),
    ...(typeof showAddress === 'boolean' && { show_address: showAddress }),
  };

  const updateData: Record<string, unknown> = {
    settings: updatedSettings,
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined && typeof name === 'string' && name.trim()) {
    updateData.name = name.trim();
  }

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('sites')
    .update(updateData)
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update business info:', updateError);
    return NextResponse.json(
      { error: 'Failed to update business info' },
      { status: 500 }
    );
  }

  // Address lives on the primary location row (also feeds schema + maps).
  if (address && typeof address === 'object') {
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
    const locUpdate: Record<string, string> = {};
    const line1 = str(address.line1, 120); if (line1 !== undefined) locUpdate.address_line1 = line1;
    const line2 = str(address.line2, 120); if (line2 !== undefined) locUpdate.address_line2 = line2;
    const city = str(address.city, 80); if (city) locUpdate.city = city;
    const state = str(address.state, 40); if (state) locUpdate.state = state;
    const zip = str(address.zip, 20); if (zip !== undefined) locUpdate.zip_code = zip;
    if (Object.keys(locUpdate).length > 0) {
      const { error: locError } = await adminSupabase
        .from('locations')
        .update(locUpdate)
        .eq('site_id', siteId)
        .eq('is_primary', true);
      if (locError) {
        console.error('Failed to update primary location address:', locError);
        return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
      }
    }
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}
