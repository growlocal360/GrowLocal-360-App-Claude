import { createStaticClient } from '@/lib/supabase/static';
import type {
  SiteWithRelations,
  Location,
  Service,
  ServiceAreaDB,
  SiteCategory,
  GBPCategory,
} from '@/types/database';

export interface ServiceAreaPageData {
  site: SiteWithRelations;
  location: Location;
  serviceArea: ServiceAreaDB;
  allServiceAreas: ServiceAreaDB[];
  services: Service[];
  categories: (SiteCategory & { gbp_category: GBPCategory })[];
}

// Get a specific service area by slug
export async function getServiceAreaBySlug(
  siteSlug: string,
  areaSlug: string
): Promise<ServiceAreaPageData | null> {
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

  // Fetch the specific service area
  const { data: serviceArea } = await supabase
    .from('service_areas')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', areaSlug)
    .single();

  if (!serviceArea) return null;

  // Fetch all service areas for this site (for internal linking)
  const { data: allServiceAreas } = await supabase
    .from('service_areas')
    .select('*')
    .eq('site_id', site.id)
    .order('sort_order');

  // Fetch all services for this site
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch all categories with GBP data
  const { data: categories } = await supabase
    .from('site_categories')
    .select(`
      *,
      gbp_category:gbp_categories(*)
    `)
    .eq('site_id', site.id)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    serviceArea: serviceArea as ServiceAreaDB,
    allServiceAreas: (allServiceAreas || []) as ServiceAreaDB[],
    services: (services || []) as Service[],
    categories: (categories || []) as (SiteCategory & { gbp_category: GBPCategory })[],
  };
}

// Get all service area slugs for static generation
export async function getAllServiceAreaSlugs(): Promise<{
  siteSlug: string;
  areaSlug: string;
}[]> {
  const supabase = createStaticClient();

  // Fetch all active sites
  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug')
    .eq('is_active', true);

  if (!sites) return [];

  const slugs: { siteSlug: string; areaSlug: string }[] = [];

  for (const site of sites) {
    // Get service areas for this site
    const { data: serviceAreas } = await supabase
      .from('service_areas')
      .select('slug')
      .eq('site_id', site.id);

    if (!serviceAreas) continue;

    for (const area of serviceAreas) {
      slugs.push({
        siteSlug: site.slug,
        areaSlug: area.slug,
      });
    }
  }

  return slugs;
}
