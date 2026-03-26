import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Fetch locations for this site
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

  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, city, state, phone, address_line1, zip_code, is_primary, representative_city, representative_state, latitude, longitude')
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }

  return NextResponse.json(locations || []);
}

// PATCH - Update a location
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

  const body = await request.json();
  const { locationId, city, state, phone, representativeCity, representativeState } = body;

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Verify location belongs to this site
  const { data: location } = await adminSupabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('site_id', siteId)
    .single();

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  // Build update object with only provided fields
  const update: Record<string, unknown> = {};
  if (city !== undefined) update.city = city;
  if (state !== undefined) update.state = state;
  if (phone !== undefined) update.phone = phone;
  if (representativeCity !== undefined) update.representative_city = representativeCity || null;
  if (representativeState !== undefined) update.representative_state = representativeState || null;

  const { error: updateError } = await adminSupabase
    .from('locations')
    .update(update)
    .eq('id', locationId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
