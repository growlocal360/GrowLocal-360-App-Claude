import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { ServiceAreaPage } from '@/components/templates/local-service-pro/service-area-page';
import type {
  SiteWithRelations,
  Location,
  Service,
  ServiceAreaDB,
  SiteCategory,
  GBPCategory,
} from '@/types/database';
import type { ServiceAreaPageData } from '@/lib/sites/get-service-areas';

interface MultiLocationAreaDetailProps {
  params: Promise<{ slug: string; location: string; areaSlug: string }>;
}

async function getServiceAreaBySlugForLocation(
  siteSlug: string,
  locationSlug: string,
  areaSlug: string
): Promise<ServiceAreaPageData | null> {
  const supabase = createAdminClient();

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

  // Fetch the specific service area
  const { data: serviceArea } = await supabase
    .from('service_areas')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', areaSlug)
    .single();

  if (!serviceArea) return null;

  // Fetch all service areas, services, and categories in parallel
  const [
    { data: allServiceAreas },
    { data: services },
    { data: categories },
  ] = await Promise.all([
    supabase.from('service_areas').select('*').eq('site_id', site.id).order('sort_order'),
    supabase.from('services').select('*').eq('site_id', site.id).eq('is_active', true).order('sort_order'),
    supabase.from('site_categories').select('*, gbp_category:gbp_categories(*)').eq('site_id', site.id).order('is_primary', { ascending: false }).order('sort_order'),
  ]);

  return {
    site: site as SiteWithRelations,
    location: location as Location,
    serviceArea: serviceArea as ServiceAreaDB,
    allServiceAreas: (allServiceAreas || []) as ServiceAreaDB[],
    services: (services || []) as Service[],
    categories: (categories || []) as (SiteCategory & { gbp_category: GBPCategory })[],
  };
}

export async function generateMetadata({ params }: MultiLocationAreaDetailProps): Promise<Metadata> {
  const { slug, location, areaSlug } = await params;
  const data = await getServiceAreaBySlugForLocation(slug, location, areaSlug);

  if (!data) {
    return { title: 'Service Area Not Found' };
  }

  const { site, serviceArea, location: loc } = data;

  const title = serviceArea.meta_title ||
    `${site.name} in ${serviceArea.name}, ${serviceArea.state || loc.state}`;
  const description = serviceArea.meta_description ||
    `${site.name} proudly serves ${serviceArea.name}. Contact us for professional services in your area.`;

  return { title, description };
}

export default async function MultiLocationAreaDetailRoute({ params }: MultiLocationAreaDetailProps) {
  const { slug, location, areaSlug } = await params;
  const data = await getServiceAreaBySlugForLocation(slug, location, areaSlug);

  if (!data) {
    notFound();
  }

  const [googleReviews, { data: neighborhoods }] = await Promise.all([
    getGoogleReviewsForSite(data.site.id),
    createAdminClient().from('neighborhoods').select('*').eq('site_id', data.site.id).eq('is_active', true).order('sort_order'),
  ]);

  return (
    <ServiceAreaPage
      data={data}
      siteSlug={slug}
      googleReviews={googleReviews}
      neighborhoods={neighborhoods || []}
      locationSlug={location}
    />
  );
}
