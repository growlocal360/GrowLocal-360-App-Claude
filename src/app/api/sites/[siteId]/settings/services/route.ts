import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET - Fetch services grouped by category
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

  const [{ data: services }, { data: categories }] = await Promise.all([
    adminSupabase
      .from('services')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order'),
    adminSupabase
      .from('site_categories')
      .select(`
        *,
        gbp_category:gbp_categories(*)
      `)
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false })
      .order('sort_order'),
  ]);

  return NextResponse.json({
    services: services || [],
    categories: categories || [],
  });
}

// POST - Add a new service
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
  const { name, slug, description, siteCategoryId } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!siteCategoryId || typeof siteCategoryId !== 'string') {
    return NextResponse.json({ error: 'siteCategoryId is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Get max sort_order for this site
  const { data: lastService } = await adminSupabase
    .from('services')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastService?.sort_order ?? -1) + 1;

  const { data: newService, error: insertError } = await adminSupabase
    .from('services')
    .insert({
      site_id: siteId,
      site_category_id: siteCategoryId,
      name: name.trim(),
      slug: slug || slugify(name),
      description: description || null,
      sort_order: nextSortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to add service:', insertError);
    return NextResponse.json(
      { error: 'Failed to add service' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, service: newService });
}

// PATCH - Update a service
export async function PATCH(
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
  const { id, name, description, isActive, sortOrder } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updateData.name = name;
  if (name !== undefined) updateData.slug = slugify(name);
  if (description !== undefined) updateData.description = description;
  if (isActive !== undefined) updateData.is_active = isActive;
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('services')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId);

  if (updateError) {
    console.error('Failed to update service:', updateError);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// DELETE - Remove a service
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
  const serviceId = searchParams.get('id');

  if (!serviceId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { error: deleteError } = await adminSupabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('site_id', siteId);

  if (deleteError) {
    console.error('Failed to delete service:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
