import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { matchReviewsToService, matchReviewsToCategory } from '@/lib/sites/match-reviews';
import { getCategoriesWithServices, getAllNestedServiceParams, getCategoryBySlugSingleLocation } from '@/lib/sites/get-services';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { matchCategorySlug, resolveCityLoose } from '@/lib/routing/resolve-segment';
import { isPlannedCityPath } from '@/lib/sites/site-plan-store';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getTemplate } from '@/lib/templates/registry';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory } from '@/types/database';
import {
  toPublicSite, toPublicLocation, toPublicServiceDetail, toPublicServiceListing,
  toPublicCategory, toPublicReview, toPublicAreaListing, toPublicNeighborhoodListing,
  toPublicPageContent, toPublicWorkItem,
} from '@/lib/sites/public-render-model';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';

export const revalidate = 60;

interface NestedServicePageProps {
  params: Promise<{ slug: string; serviceOrCategory: string; service: string }>;
}

export async function generateStaticParams() {
  const params = await getAllNestedServiceParams();
  return params.map(({ siteSlug, serviceOrCategory, service }) => ({
    slug: siteSlug,
    serviceOrCategory,
    service,
  }));
}

async function getNestedServiceData(
  siteSlug: string,
  categorySlug: string,
  serviceSlug: string
) {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Get primary location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_primary', true)
    .single();

  if (!location) return null;

  // Find the category by slug
  const { data: allCategories } = await supabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', site.id);

  const category = (allCategories || []).find(
    (c: SiteCategory & { gbp_category: GBPCategory }) =>
      c.gbp_category.name === categorySlug ||
      normalizeCategorySlug(c.gbp_category.display_name) === categorySlug
  );

  if (!category) return null;

  // Primary category services live at /{serviceSlug}, not /{categorySlug}/{serviceSlug}
  if (category.is_primary) return null;

  // Fetch the specific service
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('site_category_id', category.id)
    .eq('slug', serviceSlug)
    .eq('is_active', true)
    .single();

  if (!service) return null;

  // Fetch all services for this category
  const { data: allServices } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('site_category_id', category.id)
    .eq('is_active', true)
    .order('sort_order');

  const siblingServices = (allServices || []).filter(
    (s: Service) => s.id !== service.id
  );

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    service: service as Service,
    category: category as SiteCategory & { gbp_category: GBPCategory },
    allServices: (allServices || []) as Service[],
    siblingServices: siblingServices as Service[],
  };
}

export async function generateMetadata({ params }: NestedServicePageProps) {
  const { slug, serviceOrCategory, service } = await params;

  const data = await getNestedServiceData(slug, serviceOrCategory, service);
  if (!data) {
    // v5 category × city combo (Pattern 1 / city-hub service)
    const v5 = await v5TwoSegmentMetadata(slug, serviceOrCategory, service);
    return v5 ?? { title: 'Page Not Found' };
  }

  const { service: svc, location, site } = data;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/${serviceOrCategory}/${service}`;

  return {
    title: svc.meta_title || `${svc.name} in ${location.city}, ${location.state} | ${site.name}`,
    description: svc.meta_description || svc.description ||
      `Professional ${svc.name.toLowerCase()} services in ${location.city}. Contact ${site.name} for fast, reliable service.`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function NestedServicePage({ params }: NestedServicePageProps) {
  const { slug, serviceOrCategory, service } = await params;

  const data = await getNestedServiceData(slug, serviceOrCategory, service);
  if (!data) {
    // v5: try the new two-segment patterns before 404ing.
    //   Pattern 1  → /{service}/{city}/   (seg1=service, seg2=city)
    //   City hub   → /{city}/{service}/   (seg1=city,    seg2=service)
    const v5 = await renderV5TwoSegment(slug, serviceOrCategory, service);
    if (v5) return v5;
    notFound();
  }

  const admin = createAdminClient();
  const [allReviews, { categories }, { data: serviceAreas }, workItems, { data: schedulingConfig }, hasBrands] = await Promise.all([
    getAllGoogleReviewsForSite(data.site.id),
    getCategoriesWithServices(data.site.id),
    admin.from('service_areas').select('*').eq('site_id', data.site.id).order('sort_order'),
    getPublishedWorkItems(data.site.id, {
      serviceId: data.service.id,
      attachmentTarget: { type: 'service', id: data.service.id },
      limit: 6,
    }),
    admin
      .from('scheduling_configs')
      .select('is_active, cta_style')
      .eq('site_id', data.site.id)
      .single(),
    siteHasActiveBrands(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  // Smart match: show reviews mentioning this service, fall back to all
  const publicReviews = allReviews.map(toPublicReview);
  const matched = matchReviewsToService(publicReviews, data.service.name);
  const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

  const TemplateComp = getTemplate(data.site.template_id).Service;
  return (
    <TemplateComp
      data={{
        site: toPublicSite(data.site, { hasBrands }),
        location: toPublicLocation(data.location),
        service: toPublicServiceDetail(data.service),
        category: toPublicCategory(data.category),
        siblingServices: data.siblingServices.map(toPublicServiceListing),
      }}
      siteSlug={slug}
      isPrimaryCategory={false}
      googleReviews={displayReviews}
      categories={navCategories}
      serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
      recentWorkItems={workItems.map(toPublicWorkItem)}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}

/**
 * Metadata for the v5 category × city combos. Resolves the same way as
 * renderV5TwoSegment and gates on the Site Plan, so unplanned combos return null
 * (→ "Page Not Found", matching the 404 the page itself returns).
 */
async function v5TwoSegmentMetadata(slug: string, seg1: string, seg2: string) {
  const base = await getSiteBySlug(slug);
  if (!base) return null;
  const siteId = base.site.id;

  let categorySlug: string | null = null;
  let cityResolved: { name: string; state: string | null } | null = null;
  if (await matchCategorySlug(siteId, seg1)) {
    categorySlug = seg1;
    cityResolved = await resolveCityLoose(siteId, seg2);
  } else if (await matchCategorySlug(siteId, seg2)) {
    categorySlug = seg2;
    cityResolved = await resolveCityLoose(siteId, seg1);
  }
  if (!categorySlug || !cityResolved) return null;
  if (!(await isPlannedCityPath(siteId, `/${seg1}/${seg2}/`))) return null;

  const categoryData = await getCategoryBySlugSingleLocation(slug, categorySlug);
  if (!categoryData) return null;

  const categoryName = categoryData.category.gbp_category.display_name;
  const { site } = categoryData;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const cityLabel = cityResolved.state ? `${cityResolved.name}, ${cityResolved.state}` : cityResolved.name;

  return {
    title: `${categoryName} in ${cityLabel} | ${site.name}`,
    description: `Professional ${categoryName.toLowerCase()} in ${cityResolved.name}. Contact ${site.name} for fast, reliable service.`,
    alternates: { canonical: `https://${domain}/${seg1}/${seg2}` },
  };
}

/**
 * v5 two-segment resolution for the GBP-category × city combos:
 *   Pattern 1   → "/{category}/{city}/"  (seg1=category, seg2=city)
 *   City hub    → "/{city}/{category}/"  (seg1=city,     seg2=category)
 *
 * NOTE: "service" in the v5 URL rules means a GBP CATEGORY (appliance-repair,
 * refrigerator-repair), NOT an individual service row. So these resolve a
 * category + a city and render the Category template localized to that city.
 * Returns null if it isn't either pattern. Individual category/service-row nested
 * pages are handled earlier by getNestedServiceData().
 */
async function renderV5TwoSegment(slug: string, seg1: string, seg2: string) {
  const base = await getSiteBySlug(slug);
  if (!base) return null;
  const siteId = base.site.id;

  // Decide which segment is the GBP category and which is the city.
  // Prefer category-first (Pattern 1) when seg1 is a known category slug.
  let categorySlug: string | null = null;
  let cityResolved: { name: string; state: string | null } | null = null;
  if (await matchCategorySlug(siteId, seg1)) {
    categorySlug = seg1;
    cityResolved = await resolveCityLoose(siteId, seg2);
  } else if (await matchCategorySlug(siteId, seg2)) {
    categorySlug = seg2;
    cityResolved = await resolveCityLoose(siteId, seg1);
  }
  if (!categorySlug || !cityResolved) return null;

  // v5 gate: only render this category/city combo if the Site Plan says it
  // exists. Keeps proximity-covered cities and non-top services from rendering
  // thin pages. (Pre-v5 sites have no plan → isPlannedCityPath is permissive.)
  if (!(await isPlannedCityPath(siteId, `/${seg1}/${seg2}/`))) {
    return null;
  }

  const categoryData = await getCategoryBySlugSingleLocation(slug, categorySlug);
  if (!categoryData) return null;

  const admin = createAdminClient();
  const categoryServiceIds = categoryData.services.map((s) => s.id);
  const [allReviews, { data: serviceAreas }, { data: neighborhoods }, { data: schedulingConfig }, hasBrands, ...workItemResults] = await Promise.all([
    getAllGoogleReviewsForSite(siteId),
    admin.from('service_areas').select('*').eq('site_id', siteId).order('sort_order'),
    admin.from('neighborhoods').select('*').eq('site_id', siteId).eq('is_active', true).order('sort_order'),
    admin.from('scheduling_configs').select('is_active, cta_style').eq('site_id', siteId).single(),
    siteHasActiveBrands(siteId),
    ...categoryServiceIds.map((sid) => getPublishedWorkItems(siteId, { serviceId: sid, limit: 6 })),
  ]);

  const seenIds = new Set<string>();
  const categoryWorkItems = workItemResults.flat().filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  }).slice(0, 6);

  const categoryName = categoryData.category.gbp_category.display_name;
  const serviceNames = categoryData.services.map((s) => s.name);
  const publicReviews = allReviews.map(toPublicReview);
  const matched = matchReviewsToCategory(publicReviews, `${categoryName} ${cityResolved.name}`, serviceNames);
  const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

  // City context: override the location's city so the page reads as
  // "{category} in {city}" rather than the base location.
  const cityLocation = {
    ...toPublicLocation(categoryData.location),
    city: cityResolved.name,
    state: cityResolved.state || categoryData.location.state,
  };

  const CatComp = getTemplate(base.site.template_id).Category;
  return (
    <CatComp
      data={{
        site: toPublicSite(base.site, { hasBrands }),
        location: cityLocation,
        category: toPublicCategory(categoryData.category),
        services: categoryData.services.map(toPublicServiceListing),
        allCategories: categoryData.allCategories.map(toPublicCategory),
        pageContent: categoryData.pageContent ? toPublicPageContent(categoryData.pageContent) : null,
      }}
      siteSlug={slug}
      googleReviews={displayReviews}
      serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
      neighborhoods={(neighborhoods || []).map(toPublicNeighborhoodListing)}
      recentWorkItems={categoryWorkItems.map(toPublicWorkItem)}
      formCategories={categoryData.allCategories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
