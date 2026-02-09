import { createAdminClient } from '@/lib/supabase/admin';
import type { SiteWithRelations, Location, ServiceAreaDB, Neighborhood, SitePage, GoogleReview } from '@/types/database';

export interface PublicSiteData {
  site: SiteWithRelations;
  locations: Location[];
  serviceAreas: ServiceAreaDB[];
  neighborhoods: Neighborhood[];
  sitePages: SitePage[];
  googleReviews: GoogleReview[];
  primaryLocation: Location | null;
}

export async function getSiteBySlug(slug: string): Promise<PublicSiteData | null> {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (siteError || !site) {
    return null;
  }

  // Fetch locations
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .order('is_primary', { ascending: false })
    .order('name');

  // Fetch service areas
  const { data: serviceAreas } = await supabase
    .from('service_areas')
    .select('*')
    .eq('site_id', site.id)
    .order('sort_order');

  // Fetch neighborhoods
  const { data: neighborhoods } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch site pages (generated content for home, about, contact, category pages)
  const { data: sitePages } = await supabase
    .from('site_pages')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true);

  // Fetch Google Reviews (top-rated, visible only)
  const { data: googleReviews } = await supabase
    .from('google_reviews')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_visible', true)
    .order('rating', { ascending: false })
    .order('review_date', { ascending: false })
    .limit(10);

  const primaryLocation = locations?.find(l => l.is_primary) || locations?.[0] || null;

  return {
    site: site as SiteWithRelations,
    locations: locations || [],
    serviceAreas: serviceAreas || [],
    neighborhoods: neighborhoods || [],
    sitePages: (sitePages || []) as SitePage[],
    googleReviews: (googleReviews || []) as GoogleReview[],
    primaryLocation,
  };
}

// Get neighborhood by slug for a specific location
export async function getNeighborhoodBySlug(
  siteSlug: string,
  locationSlug: string,
  neighborhoodSlug: string
): Promise<{
  site: SiteWithRelations;
  location: Location;
  neighborhood: Neighborhood;
  allNeighborhoods: Neighborhood[];
} | null> {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Fetch location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', locationSlug)
    .single();

  if (!location) return null;

  // Fetch the specific neighborhood
  const { data: neighborhood } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('location_id', location.id)
    .eq('slug', neighborhoodSlug)
    .eq('is_active', true)
    .single();

  if (!neighborhood) return null;

  // Fetch all neighborhoods for this location (for internal linking)
  const { data: allNeighborhoods } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('location_id', location.id)
    .eq('is_active', true)
    .order('sort_order');

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    neighborhood: neighborhood as Neighborhood,
    allNeighborhoods: (allNeighborhoods || []) as Neighborhood[],
  };
}

export async function getAllSiteSlugs(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: sites } = await supabase
    .from('sites')
    .select('slug')
    .eq('is_active', true);

  return sites?.map(s => s.slug) || [];
}

// Get neighborhood by slug for single-location sites (no location in URL)
export async function getNeighborhoodBySlugSingleLocation(
  siteSlug: string,
  neighborhoodSlug: string
): Promise<{
  site: SiteWithRelations;
  location: Location;
  neighborhood: Neighborhood;
  allNeighborhoods: Neighborhood[];
} | null> {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // For single-location sites, get the primary location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_primary', true)
    .single();

  if (!location) return null;

  // Fetch the specific neighborhood
  const { data: neighborhood } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', neighborhoodSlug)
    .eq('is_active', true)
    .single();

  if (!neighborhood) return null;

  // Fetch all neighborhoods for this site (for internal linking)
  const { data: allNeighborhoods } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('sort_order');

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    neighborhood: neighborhood as Neighborhood,
    allNeighborhoods: (allNeighborhoods || []) as Neighborhood[],
  };
}

// Get location by slug for a specific site
export async function getLocationBySlug(
  siteSlug: string,
  locationSlug: string
): Promise<{
  site: SiteWithRelations;
  location: Location;
  allLocations: Location[];
  neighborhoods: Neighborhood[];
  serviceAreas: ServiceAreaDB[];
} | null> {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Fetch the specific location
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', locationSlug)
    .single();

  if (!location) return null;

  // Fetch all locations for this site (for internal linking)
  const { data: allLocations } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .order('is_primary', { ascending: false })
    .order('name');

  // Fetch neighborhoods for this location
  const { data: neighborhoods } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('site_id', site.id)
    .eq('location_id', location.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch service areas for this site
  const { data: serviceAreas } = await supabase
    .from('service_areas')
    .select('*')
    .eq('site_id', site.id)
    .order('sort_order');

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    allLocations: (allLocations || []) as Location[],
    neighborhoods: (neighborhoods || []) as Neighborhood[],
    serviceAreas: (serviceAreas || []) as ServiceAreaDB[],
  };
}
