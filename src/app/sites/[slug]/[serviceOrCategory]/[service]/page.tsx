import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory } from '@/types/database';

interface NestedServicePageProps {
  params: Promise<{ slug: string; serviceOrCategory: string; service: string }>;
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
      c.gbp_category.display_name.toLowerCase().replace(/\s+/g, '-') === categorySlug
  );

  if (!category) return null;

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
    return { title: 'Page Not Found' };
  }

  const { service: svc, location, site } = data;
  return {
    title: svc.meta_title || `${svc.name} in ${location.city}, ${location.state} | ${site.name}`,
    description: svc.meta_description || svc.description ||
      `Professional ${svc.name.toLowerCase()} services in ${location.city}. Contact ${site.name} for fast, reliable service.`,
  };
}

export default async function NestedServicePage({ params }: NestedServicePageProps) {
  const { slug, serviceOrCategory, service } = await params;

  const data = await getNestedServiceData(slug, serviceOrCategory, service);
  if (!data) {
    notFound();
  }

  const [googleReviews, { categories }] = await Promise.all([
    getGoogleReviewsForSite(data.site.id),
    getCategoriesWithServices(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: c.gbp_category.name,
    isPrimary: c.is_primary,
  }));

  return (
    <ServicePage
      data={data}
      siteSlug={slug}
      isPrimaryCategory={false}
      googleReviews={googleReviews}
      categories={navCategories}
    />
  );
}
