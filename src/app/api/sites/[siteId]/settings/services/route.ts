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

// GET - Fetch services grouped by category
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

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
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

  await revalidateSite(siteId);

  return NextResponse.json({ success: true, service: newService });
}

// PATCH - Update a service
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
  const { id, name, description, isActive, sortOrder, siteCategoryId, heroImageUrl, h1, metaTitle, metaDescription, introCopy, bodyCopy, problems, detailedSections, faqs } = body;

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
  if (siteCategoryId !== undefined) updateData.site_category_id = siteCategoryId;
  if (heroImageUrl !== undefined) {
    // Accept the dashboard proxy path or a clean /public/ path; store the clean one. null clears.
    const m = typeof heroImageUrl === 'string' ? heroImageUrl.match(/^\/api\/sites\/[^/]+\/(.+)$/) : null;
    updateData.hero_image_url = heroImageUrl ? (m ? `/public/${m[1]}` : heroImageUrl) : null;
  }

  // Page content edited in Settings → Services → Edit. Strings are trimmed;
  // empty becomes null; JSON lists are rebuilt from plain strings only.
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);
  if (h1 !== undefined) updateData.h1 = str(h1, 120);
  if (metaTitle !== undefined) updateData.meta_title = str(metaTitle, 70);
  if (metaDescription !== undefined) updateData.meta_description = str(metaDescription, 200);
  if (introCopy !== undefined) updateData.intro_copy = str(introCopy, 600);
  if (bodyCopy !== undefined) updateData.body_copy = str(bodyCopy, 6000);
  if (problems !== undefined) {
    const list = Array.isArray(problems)
      ? problems
          .map((p) => ({ heading: str(p?.heading, 120) || '', description: str(p?.description, 600) || '' }))
          .filter((p) => p.heading)
      : [];
    updateData.problems = list.length ? list.slice(0, 8) : null;
  }
  if (detailedSections !== undefined) {
    const list = Array.isArray(detailedSections)
      ? detailedSections
          .map((s) => ({
            h2: str(s?.h2, 120) || '',
            body: str(s?.body, 2000) || '',
            bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: unknown) => str(b, 200)).filter((b: string | null): b is string => !!b).slice(0, 8) : [],
          }))
          .filter((s) => s.h2)
      : [];
    updateData.detailed_sections = list.length ? list.slice(0, 8) : null;
  }
  if (faqs !== undefined) {
    const list = Array.isArray(faqs)
      ? faqs.map((f) => ({ question: str(f?.question, 200) || '', answer: str(f?.answer, 1200) || '' })).filter((f) => f.question && f.answer)
      : [];
    updateData.faqs = list.length ? list.slice(0, 12) : null;
  }

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

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}

// DELETE - Remove a service
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

  await revalidateSite(siteId);

  return NextResponse.json({ success: true });
}
