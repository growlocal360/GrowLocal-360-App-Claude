import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET - Fetch service areas
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

  const adminSupabase = createAdminClient();
  const [{ data: serviceAreas }, { data: locations }] = await Promise.all([
    adminSupabase
      .from('service_areas')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order'),
    adminSupabase
      .from('locations')
      .select('id, city, state, latitude, longitude')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false }),
  ]);

  return NextResponse.json({
    serviceAreas: serviceAreas || [],
    locations: locations || [],
  });
}

// POST - Add a service area
export async function POST(
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
  const { name, state, slug, placeId, latitude, longitude } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Get max sort_order
  const { data: lastArea } = await adminSupabase
    .from('service_areas')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastArea?.sort_order ?? -1) + 1;

  const { data: newArea, error: insertError } = await adminSupabase
    .from('service_areas')
    .insert({
      site_id: siteId,
      name: name.trim(),
      slug: slug || slugify(name),
      state: state || null,
      place_id: placeId || null,
      latitude: latitude || null,
      longitude: longitude || null,
      is_custom: true,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to add service area:', insertError);
    return NextResponse.json(
      { error: 'Failed to add service area' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true, serviceArea: newArea });
}

// DELETE - Remove a service area
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get('id');

  if (!areaId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { error: deleteError } = await adminSupabase
    .from('service_areas')
    .delete()
    .eq('id', areaId)
    .eq('site_id', siteId);

  if (deleteError) {
    console.error('Failed to delete service area:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete service area' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}
