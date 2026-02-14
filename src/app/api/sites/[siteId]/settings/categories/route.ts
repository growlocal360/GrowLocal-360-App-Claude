import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Fetch current categories
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
  const { data: categories } = await adminSupabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  return NextResponse.json({ categories: categories || [] });
}

// PUT - Replace all categories
export async function PUT(
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
  const { primaryGcid, secondaryGcids } = body as {
    primaryGcid: string;
    secondaryGcids: string[];
  };

  if (!primaryGcid || typeof primaryGcid !== 'string') {
    return NextResponse.json(
      { error: 'primaryGcid is required' },
      { status: 400 }
    );
  }

  const allGcids = [primaryGcid, ...(secondaryGcids || [])];
  const adminSupabase = createAdminClient();

  // Upsert GBP categories into gbp_categories table
  for (const gcid of allGcids) {
    const { data: existing } = await adminSupabase
      .from('gbp_categories')
      .select('id')
      .eq('gcid', gcid)
      .single();

    if (!existing) {
      // Extract display name from gcid (e.g., "gcid:hvac_contractor" → "HVAC Contractor")
      const rawName = gcid.replace('gcid:', '');
      const displayName = rawName
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      await adminSupabase.from('gbp_categories').insert({
        gcid,
        name: rawName,
        display_name: displayName,
        service_types: [],
      });
    }
  }

  // Get the gbp_category IDs for all gcids
  const { data: gbpCategories } = await adminSupabase
    .from('gbp_categories')
    .select('id, gcid')
    .in('gcid', allGcids);

  if (!gbpCategories || gbpCategories.length === 0) {
    return NextResponse.json(
      { error: 'Failed to resolve categories' },
      { status: 500 }
    );
  }

  const gcidToId = new Map(gbpCategories.map((c) => [c.gcid, c.id]));

  // Delete existing site_categories for this site
  await adminSupabase
    .from('site_categories')
    .delete()
    .eq('site_id', siteId);

  // Insert new categories
  const newCategories = allGcids
    .filter((gcid) => gcidToId.has(gcid))
    .map((gcid, index) => ({
      site_id: siteId,
      gbp_category_id: gcidToId.get(gcid)!,
      is_primary: gcid === primaryGcid,
      sort_order: index,
    }));

  const { error: insertError } = await adminSupabase
    .from('site_categories')
    .insert(newCategories);

  if (insertError) {
    console.error('Failed to insert categories:', insertError);
    return NextResponse.json(
      { error: 'Failed to update categories' },
      { status: 500 }
    );
  }

  // Fetch updated categories to return
  const { data: updated } = await adminSupabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  return NextResponse.json({ success: true, categories: updated || [] });
}
