import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import { inngest } from '@/lib/inngest/client';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Return the value only if it's a real site_categories id for this site; else null. */
async function validateSiteCategoryId(
  adminSupabase: ReturnType<typeof createAdminClient>,
  siteId: string,
  value: unknown
): Promise<string | null> {
  if (!value || typeof value !== 'string') return null;
  const { data } = await adminSupabase
    .from('site_categories')
    .select('id')
    .eq('site_id', siteId)
    .eq('id', value)
    .maybeSingle();
  return data ? value : null;
}

// GET - Fetch brands for a site
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
  const [{ data: brands }, { data: categories }] = await Promise.all([
    adminSupabase.from('site_brands').select('*').eq('site_id', siteId).order('sort_order'),
    adminSupabase
      .from('site_categories')
      .select('id, is_primary, gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false }),
  ]);

  // Flatten categories to { id, name, isPrimary } for the niche dropdown.
  const cats = (categories || []).map((c) => {
    const gbp = Array.isArray(c.gbp_category) ? c.gbp_category[0] : c.gbp_category;
    return { id: c.id, name: gbp?.display_name || 'Category', isPrimary: c.is_primary };
  });

  return NextResponse.json({ brands: brands || [], categories: cats });
}

// POST - Add a brand
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
  const { name, slug, siteCategoryId, hasDetailPage } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const brandCategoryId = await validateSiteCategoryId(adminSupabase, siteId, siteCategoryId);

  // Get max sort_order
  const { data: lastBrand } = await adminSupabase
    .from('site_brands')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastBrand?.sort_order ?? -1) + 1;

  const { data: newBrand, error: insertError } = await adminSupabase
    .from('site_brands')
    .insert({
      site_id: siteId,
      name: name.trim(),
      slug: slug || slugify(name),
      sort_order: nextSortOrder,
      is_active: true,
      has_detail_page: hasDetailPage === true,
      site_category_id: brandCategoryId,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to add brand:', insertError);
    return NextResponse.json(
      { error: 'Failed to add brand' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true, brand: newBrand });
}

// PATCH - Update a brand (name, is_active)
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
  const { id, name, isActive, siteCategoryId, hasDetailPage } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const update: Record<string, unknown> = {};
  if (name !== undefined) {
    update.name = name.trim();
    update.slug = slugify(name);
  }
  if (isActive !== undefined) {
    update.is_active = isActive;
  }
  if (hasDetailPage !== undefined) {
    update.has_detail_page = hasDetailPage === true;
  }
  // Niche override. null/'' explicitly clears it back to "Both" (all niches).
  if (siteCategoryId !== undefined) {
    update.site_category_id = await validateSiteCategoryId(adminSupabase, siteId, siteCategoryId);
  }

  const { error: updateError } = await adminSupabase
    .from('site_brands')
    .update(update)
    .eq('id', id)
    .eq('site_id', siteId);

  if (updateError) {
    console.error('Failed to update brand:', updateError);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }

  // Opting a brand INTO a detail page: build its content now if it has none,
  // so the new page never goes live blank (same as adding a neighborhood).
  if (hasDetailPage === true) {
    const { data: row } = await adminSupabase.from('site_brands').select('h1').eq('id', id).single();
    if (!row?.h1) {
      const { data: { session } } = await supabase.auth.getSession();
      await inngest.send({
        name: 'site/content.generate',
        data: { siteId, googleAccessToken: session?.provider_token || null, scope: { type: 'brands', brandIds: [id] } },
      });
    }
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}

// DELETE - Remove a brand
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
  const brandId = searchParams.get('id');

  if (!brandId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { error: deleteError } = await adminSupabase
    .from('site_brands')
    .delete()
    .eq('id', brandId)
    .eq('site_id', siteId);

  if (deleteError) {
    console.error('Failed to delete brand:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete brand' },
      { status: 500 }
    );
  }

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}
