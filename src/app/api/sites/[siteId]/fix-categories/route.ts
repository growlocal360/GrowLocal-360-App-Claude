import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
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

  // Verify ownership
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const hasAccess = site.organization?.profiles?.some(
    (p: { user_id: string }) => p.user_id === user.id
  );

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get site_categories with GBP category data (including service_types)
  const { data: siteCategories } = await admin
    .from('site_categories')
    .select('id, is_primary, gbp_category:gbp_categories(gcid, display_name, service_types)')
    .eq('site_id', siteId);

  if (!siteCategories || siteCategories.length === 0) {
    return NextResponse.json({ error: 'No categories found for site' }, { status: 400 });
  }

  // Get orphaned services (null site_category_id)
  const { data: orphanedServices } = await admin
    .from('services')
    .select('id, name, slug')
    .eq('site_id', siteId)
    .is('site_category_id', null);

  if (!orphanedServices || orphanedServices.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No orphaned services found — all services already have categories',
      fixed: 0,
    });
  }

  // Build matching data from categories
  const categoryMatchers = siteCategories.map((sc) => {
    const gbp = Array.isArray(sc.gbp_category) ? sc.gbp_category[0] : sc.gbp_category;
    const displayName = gbp?.display_name || '';
    const serviceTypes: string[] = (gbp?.service_types || []) as string[];

    // Normalize service_types for matching
    const normalizedServiceTypes = serviceTypes.map((st: string) => st.toLowerCase().trim());

    // Extract keywords from category display_name for fallback matching
    const categoryKeywords = displayName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !['and', 'the', 'for', 'service', 'repair'].includes(w));

    return {
      siteCategoryId: sc.id,
      displayName,
      normalizedServiceTypes,
      categoryKeywords,
      isPrimary: sc.is_primary,
    };
  });

  const results: { serviceId: string; serviceName: string; matchedCategory: string; method: string }[] = [];
  const unmatched: { serviceId: string; serviceName: string }[] = [];

  for (const service of orphanedServices) {
    const serviceLower = service.name.toLowerCase();
    let matched = false;

    // Method 1: Exact match against service_types array
    for (const cat of categoryMatchers) {
      if (cat.normalizedServiceTypes.some((st: string) => st === serviceLower)) {
        await admin.from('services').update({ site_category_id: cat.siteCategoryId }).eq('id', service.id);
        results.push({ serviceId: service.id, serviceName: service.name, matchedCategory: cat.displayName, method: 'exact_service_type' });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Method 2: Fuzzy match — service name contains a service_type or vice versa
    for (const cat of categoryMatchers) {
      const fuzzyMatch = cat.normalizedServiceTypes.some(
        (st: string) => serviceLower.includes(st) || st.includes(serviceLower)
      );
      if (fuzzyMatch) {
        await admin.from('services').update({ site_category_id: cat.siteCategoryId }).eq('id', service.id);
        results.push({ serviceId: service.id, serviceName: service.name, matchedCategory: cat.displayName, method: 'fuzzy_service_type' });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Method 3: Keyword overlap — service name words overlap with category keywords
    const serviceWords = serviceLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter((w: string) => w.length > 2 && !['and', 'the', 'for', 'service', 'repair', 'professional'].includes(w));

    let bestMatch: typeof categoryMatchers[0] | null = null;
    let bestScore = 0;

    for (const cat of categoryMatchers) {
      const overlap = serviceWords.filter((w: string) => cat.categoryKeywords.includes(w)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestMatch = cat;
      }
    }

    if (bestMatch && bestScore > 0) {
      await admin.from('services').update({ site_category_id: bestMatch.siteCategoryId }).eq('id', service.id);
      results.push({ serviceId: service.id, serviceName: service.name, matchedCategory: bestMatch.displayName, method: 'keyword_overlap' });
      matched = true;
    }

    // Method 4: If only one category, assign all to it
    if (!matched && categoryMatchers.length === 1) {
      const cat = categoryMatchers[0];
      await admin.from('services').update({ site_category_id: cat.siteCategoryId }).eq('id', service.id);
      results.push({ serviceId: service.id, serviceName: service.name, matchedCategory: cat.displayName, method: 'single_category' });
      matched = true;
    }

    // Method 5: Assign to primary category as last resort
    if (!matched) {
      const primaryCat = categoryMatchers.find((c) => c.isPrimary);
      if (primaryCat) {
        await admin.from('services').update({ site_category_id: primaryCat.siteCategoryId }).eq('id', service.id);
        results.push({ serviceId: service.id, serviceName: service.name, matchedCategory: primaryCat.displayName, method: 'primary_fallback' });
      } else {
        unmatched.push({ serviceId: service.id, serviceName: service.name });
      }
    }
  }

  // If site is stuck in 'building' status, reset to 'active'
  if (site.status === 'building') {
    await admin
      .from('sites')
      .update({
        status: 'active',
        build_progress: null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);
  }

  return NextResponse.json({
    success: true,
    fixed: results.length,
    unmatched: unmatched.length,
    statusReset: site.status === 'building',
    results,
    unmatched_services: unmatched,
  });
}
