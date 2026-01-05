import { createStaticClient } from '@/lib/supabase/static';
import type {
  SiteWithRelations,
  Location,
  Service,
  SiteCategory,
  GBPCategory,
  SitePage
} from '@/types/database';

export interface ServicePageData {
  site: SiteWithRelations;
  location: Location;
  service: Service;
  category: SiteCategory & { gbp_category: GBPCategory };
  allServices: Service[];
  siblingServices: Service[]; // Other services in same category
}

export interface CategoryPageData {
  site: SiteWithRelations;
  location: Location;
  category: SiteCategory & { gbp_category: GBPCategory };
  services: Service[];
  allCategories: (SiteCategory & { gbp_category: GBPCategory })[];
  pageContent?: SitePage | null; // Generated SEO content for category page
}

// Get all services for a site
export async function getServicesForSite(siteId: string): Promise<Service[]> {
  const supabase = createStaticClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('sort_order');

  return (services || []) as Service[];
}

// Get all categories with their services for a site
export async function getCategoriesWithServices(siteId: string): Promise<{
  categories: (SiteCategory & { gbp_category: GBPCategory })[];
  services: Service[];
}> {
  const supabase = createStaticClient();

  // Fetch site categories with GBP category data
  const { data: categories } = await supabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  // Fetch all services
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('sort_order');

  return {
    categories: (categories || []) as (SiteCategory & { gbp_category: GBPCategory })[],
    services: (services || []) as Service[],
  };
}

// Get a specific service by slug for single-location sites
export async function getServiceBySlugSingleLocation(
  siteSlug: string,
  serviceSlug: string
): Promise<ServicePageData | null> {
  const supabase = createStaticClient();

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

  // Fetch all services for this site
  const { data: allServices } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch sibling services (same category)
  const siblingServices = (allServices || []).filter(
    (s: Service) => s.site_category_id === service.site_category_id && s.id !== service.id
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

// Get a specific category page for single-location sites
export async function getCategoryBySlugSingleLocation(
  siteSlug: string,
  categorySlug: string
): Promise<CategoryPageData | null> {
  const supabase = createStaticClient();

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

  // Find the specific category by slug (from gbp_category name)
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

  // Fetch site_page content for this category
  const categoryPageSlug = category.gbp_category.display_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: pageContent } = await supabase
    .from('site_pages')
    .select('*')
    .eq('site_id', site.id)
    .eq('page_type', 'category')
    .eq('slug', categoryPageSlug)
    .single();

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    category: category as SiteCategory & { gbp_category: GBPCategory },
    services: (services || []) as Service[],
    allCategories: (allCategories || []) as (SiteCategory & { gbp_category: GBPCategory })[],
    pageContent: pageContent as SitePage | null,
  };
}

// Get a specific service by slug for multi-location sites
export async function getServiceBySlugMultiLocation(
  siteSlug: string,
  locationSlug: string,
  serviceSlug: string
): Promise<ServicePageData | null> {
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

  // Fetch all services for this site
  const { data: allServices } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch sibling services (same category)
  const siblingServices = (allServices || []).filter(
    (s: Service) => s.site_category_id === service.site_category_id && s.id !== service.id
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

// Get all service slugs for static generation
// Note: This is a simplified version - full implementation would need proper typing
export async function getAllServiceSlugs(): Promise<{
  siteSlug: string;
  serviceSlug: string;
  websiteType: string;
  locationSlug?: string;
}[]> {
  const supabase = createStaticClient();

  // Fetch all active sites
  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug, website_type')
    .eq('is_active', true);

  if (!sites) return [];

  const slugs: {
    siteSlug: string;
    serviceSlug: string;
    websiteType: string;
    locationSlug?: string;
  }[] = [];

  for (const site of sites) {
    // Get services
    const { data: services } = await supabase
      .from('services')
      .select('slug')
      .eq('site_id', site.id)
      .eq('is_active', true);

    if (!services) continue;

    // Get locations for multi-location sites
    if (site.website_type === 'multi_location') {
      const { data: locations } = await supabase
        .from('locations')
        .select('slug')
        .eq('site_id', site.id);

      for (const location of locations || []) {
        for (const service of services) {
          slugs.push({
            siteSlug: site.slug,
            serviceSlug: service.slug,
            websiteType: site.website_type,
            locationSlug: location.slug,
          });
        }
      }
    } else {
      // Single location or microsite
      for (const service of services) {
        slugs.push({
          siteSlug: site.slug,
          serviceSlug: service.slug,
          websiteType: site.website_type,
        });
      }
    }
  }

  return slugs;
}
