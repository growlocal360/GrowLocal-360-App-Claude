import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import {
  loadBusinessContext,
  generateSingleServiceContent,
} from '@/lib/content/generators';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  // Auth check
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

  // Parse body
  const body = await request.json();
  const { serviceId } = body;

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load service
  const { data: service } = await admin
    .from('services')
    .select('id, name, description, slug, site_category_id')
    .eq('id', serviceId)
    .eq('site_id', siteId)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  // Load category name for this service
  let categoryName = 'Professional Services';
  let isPrimary = true;
  let categorySlug = '';
  if (service.site_category_id) {
    const { data: cat } = await admin
      .from('site_categories')
      .select('is_primary, gbp_category:gbp_categories(display_name)')
      .eq('id', service.site_category_id)
      .single();

    if (cat) {
      const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
      categoryName = gbp?.display_name || categoryName;
      isPrimary = cat.is_primary;
      categorySlug = normalizeCategorySlug(categoryName);
    }
  }

  try {
    // Load business context and generate content
    const ctx = await loadBusinessContext(siteId);
    const content = await generateSingleServiceContent(
      ctx,
      { name: service.name, description: service.description || '' },
      categoryName
    );

    // Save to DB
    await admin
      .from('services')
      .update({
        meta_title: content.meta_title,
        meta_description: content.meta_description,
        h1: content.h1,
        body_copy: content.body_copy,
        intro_copy: content.intro_copy || null,
        problems: content.problems || null,
        detailed_sections: content.detailed_sections || null,
        faqs: content.faqs,
      })
      .eq('id', serviceId);

    // Targeted revalidation
    const base = `/sites/${ctx.siteSlug}`;
    if (isPrimary) {
      revalidatePath(`${base}/${service.slug}`, 'page');
    } else {
      revalidatePath(`${base}/${categorySlug}/${service.slug}`, 'page');
    }
    // Also revalidate services listing page
    revalidatePath(`${base}/services`, 'page');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate service content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
