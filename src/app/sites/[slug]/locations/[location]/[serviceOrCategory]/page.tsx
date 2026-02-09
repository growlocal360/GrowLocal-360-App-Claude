import { notFound } from 'next/navigation';
import { createStaticClient } from '@/lib/supabase/static';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import { CategoryPage } from '@/components/templates/local-service-pro/category-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory } from '@/types/database';

interface MultiLocationServiceOrCategoryPageProps {
  params: Promise<{ slug: string; location: string; serviceOrCategory: string }>;
}

async function getMultiLocationServiceData(
  siteSlug: string,
  locationSlug: string,
  serviceSlug: string
) {
  const supabase = createStaticClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Get specific location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', locationSlug)
    .single();

  if (!location) return null;

  // Fetch the specific service
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', serviceSlug)
    .eq('is_active', true)
    .single();

  if (!service) return null;

  // Fetch the category for this service
  const { data: category } = await supabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('id', service.site_category_id)
    .single();

  if (!category) return null;

  // Fetch all services for this site (same category)
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

async function getMultiLocationCategoryData(
  siteSlug: string,
  locationSlug: string,
  categorySlug: string
) {
  const supabase = createStaticClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Get specific location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', locationSlug)
    .single();

  if (!location) return null;

  // Fetch all categories for this site
  const { data: allCategories } = await supabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', site.id)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  // Find the specific category by slug
  const category = (allCategories || []).find(
    (c: SiteCategory & { gbp_category: GBPCategory }) =>
      c.gbp_category.name === categorySlug ||
      c.gbp_category.display_name.toLowerCase().replace(/\s+/g, '-') === categorySlug
  );

  if (!category) return null;

  // Fetch services for this category
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('site_category_id', category.id)
    .eq('is_active', true)
    .order('sort_order');

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    category: category as SiteCategory & { gbp_category: GBPCategory },
    services: (services || []) as Service[],
    allCategories: (allCategories || []) as (SiteCategory & { gbp_category: GBPCategory })[],
  };
}

export async function generateMetadata({ params }: MultiLocationServiceOrCategoryPageProps) {
  const { slug, location, serviceOrCategory } = await params;

  // Try as service first
  const serviceData = await getMultiLocationServiceData(slug, location, serviceOrCategory);
  if (serviceData) {
    const { service, location: loc, site } = serviceData;
    return {
      title: service.meta_title || `${service.name} in ${loc.city}, ${loc.state} | ${site.name}`,
      description: service.meta_description || service.description ||
        `Professional ${service.name.toLowerCase()} services in ${loc.city}. Contact ${site.name} for fast, reliable service.`,
    };
  }

  // Try as category
  const categoryData = await getMultiLocationCategoryData(slug, location, serviceOrCategory);
  if (categoryData) {
    const { category, location: loc, site } = categoryData;
    const categoryName = category.gbp_category.display_name;
    return {
      title: `${categoryName} in ${loc.city}, ${loc.state} | ${site.name}`,
      description: `Professional ${categoryName.toLowerCase()} services in ${loc.city}. ${site.name} provides expert service with upfront pricing.`,
    };
  }

  return { title: 'Page Not Found' };
}

export default async function MultiLocationServiceOrCategoryPage({ params }: MultiLocationServiceOrCategoryPageProps) {
  const { slug, location, serviceOrCategory } = await params;

  // Try as service first (primary category services)
  const serviceData = await getMultiLocationServiceData(slug, location, serviceOrCategory);
  if (serviceData) {
    const isPrimaryCategory = serviceData.category.is_primary;
    const [googleReviews, { categories }] = await Promise.all([
      getGoogleReviewsForSite(serviceData.site.id),
      getCategoriesWithServices(serviceData.site.id),
    ]);

    const navCategories: NavCategory[] = categories.map(c => ({
      name: c.gbp_category.display_name,
      slug: c.gbp_category.name,
      isPrimary: c.is_primary,
    }));

    return (
      <ServicePage
        data={serviceData}
        siteSlug={slug}
        isPrimaryCategory={isPrimaryCategory}
        googleReviews={googleReviews}
        categories={navCategories}
      />
    );
  }

  // Try as category (secondary categories)
  const categoryData = await getMultiLocationCategoryData(slug, location, serviceOrCategory);
  if (categoryData) {
    const googleReviews = await getGoogleReviewsForSite(categoryData.site.id);

    return (
      <CategoryPage
        data={categoryData}
        siteSlug={slug}
        googleReviews={googleReviews}
      />
    );
  }

  notFound();
}
