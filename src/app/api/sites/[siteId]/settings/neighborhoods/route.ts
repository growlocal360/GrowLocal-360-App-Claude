import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET - Fetch neighborhoods
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminSupabase = createAdminClient();
  const { data: neighborhoods } = await adminSupabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', siteId)
    .order('sort_order');

  return NextResponse.json({ neighborhoods: neighborhoods || [] });
}

// POST - Add a neighborhood
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, locationId, placeId, latitude, longitude } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // If no locationId provided, use the primary location
  let resolvedLocationId = locationId;
  if (!resolvedLocationId) {
    const { data: primaryLocation } = await adminSupabase
      .from('locations')
      .select('id')
      .eq('site_id', siteId)
      .eq('is_primary', true)
      .limit(1)
      .single();

    if (!primaryLocation) {
      return NextResponse.json({ error: 'No primary location found' }, { status: 400 });
    }
    resolvedLocationId = primaryLocation.id;
  }

  // Get max sort_order
  const { data: lastNeighborhood } = await adminSupabase
    .from('neighborhoods')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastNeighborhood?.sort_order ?? -1) + 1;

  const { data: newNeighborhood, error: insertError } = await adminSupabase
    .from('neighborhoods')
    .insert({
      site_id: siteId,
      location_id: resolvedLocationId,
      name: name.trim(),
      slug: slugify(name),
      place_id: placeId || null,
      latitude: latitude || null,
      longitude: longitude || null,
      sort_order: nextSortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to add neighborhood:', insertError);
    return NextResponse.json(
      { error: 'Failed to add neighborhood' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true, neighborhood: newNeighborhood });
}

// DELETE - Remove a neighborhood
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const neighborhoodId = searchParams.get('id');

  if (!neighborhoodId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { error: deleteError } = await adminSupabase
    .from('neighborhoods')
    .delete()
    .eq('id', neighborhoodId)
    .eq('site_id', siteId);

  if (deleteError) {
    console.error('Failed to delete neighborhood:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete neighborhood' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}
