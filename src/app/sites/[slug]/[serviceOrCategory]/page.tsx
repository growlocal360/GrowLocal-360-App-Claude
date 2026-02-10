import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServiceBySlugSingleLocation, getCategoryBySlugSingleLocation, getCategoriesWithServices, getAllServiceOrCategoryParams } from '@/lib/sites/get-services';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import { CategoryPage } from '@/components/templates/local-service-pro/category-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

interface ServiceOrCategoryPageProps {
  params: Promise<{ slug: string; serviceOrCategory: string }>;
}

export async function generateStaticParams() {
  const params = await getAllServiceOrCategoryParams();
  return params.map(({ siteSlug, serviceOrCategory }) => ({
    slug: siteSlug,
    serviceOrCategory,
  }));
}

export async function generateMetadata({ params }: ServiceOrCategoryPageProps) {
  const { slug, serviceOrCategory } = await params;

  // Try to get as a service first (primary category services)
  const serviceData = await getServiceBySlugSingleLocation(slug, serviceOrCategory);
  if (serviceData) {
    const { service, location, site } = serviceData;
    return {
      title: service.meta_title || `${service.name} in ${location.city}, ${location.state} | ${site.name}`,
      description: service.meta_description || service.description ||
        `Professional ${service.name.toLowerCase()} services in ${location.city}. Contact ${site.name} for fast, reliable service.`,
    };
  }

  // Try to get as a category (secondary categories)
  const categoryData = await getCategoryBySlugSingleLocation(slug, serviceOrCategory);
  if (categoryData) {
    const { category, location, site, pageContent } = categoryData;
    const categoryName = category.gbp_category.display_name;
    return {
      title: pageContent?.meta_title || `${categoryName} in ${location.city}, ${location.state} | ${site.name}`,
      description: pageContent?.meta_description || `Professional ${categoryName.toLowerCase()} services in ${location.city}. ${site.name} provides expert service with upfront pricing.`,
    };
  }

  return { title: 'Page Not Found' };
}

export default async function ServiceOrCategoryPage({ params }: ServiceOrCategoryPageProps) {
  const { slug, serviceOrCategory } = await params;

  // Try to get as a service first (primary category services are at root level)
  const serviceData = await getServiceBySlugSingleLocation(slug, serviceOrCategory);
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

  // Try to get as a category (secondary categories have their own page)
  const categoryData = await getCategoryBySlugSingleLocation(slug, serviceOrCategory);
  if (categoryData) {
    const admin = createAdminClient();
    const [googleReviews, { data: serviceAreas }, { data: neighborhoods }] = await Promise.all([
      getGoogleReviewsForSite(categoryData.site.id),
      admin.from('service_areas').select('*').eq('site_id', categoryData.site.id).order('sort_order'),
      admin.from('neighborhoods').select('*').eq('site_id', categoryData.site.id).eq('is_active', true).order('sort_order'),
    ]);

    return (
      <CategoryPage
        data={categoryData}
        siteSlug={slug}
        googleReviews={googleReviews}
        serviceAreas={serviceAreas || []}
        neighborhoods={neighborhoods || []}
      />
    );
  }

  // Neither service nor category found
  notFound();
}
