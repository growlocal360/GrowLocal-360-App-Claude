import { notFound } from 'next/navigation';
import { getServiceBySlugSingleLocation, getCategoryBySlugSingleLocation } from '@/lib/sites/get-services';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import { CategoryPage } from '@/components/templates/local-service-pro/category-page';

interface ServiceOrCategoryPageProps {
  params: Promise<{ slug: string; serviceOrCategory: string }>;
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
    const { category, location, site } = categoryData;
    const categoryName = category.gbp_category.display_name;
    return {
      title: `${categoryName} in ${location.city}, ${location.state} | ${site.name}`,
      description: `Professional ${categoryName.toLowerCase()} services in ${location.city}. ${site.name} provides expert service with upfront pricing.`,
    };
  }

  return { title: 'Page Not Found' };
}

export default async function ServiceOrCategoryPage({ params }: ServiceOrCategoryPageProps) {
  const { slug, serviceOrCategory } = await params;

  // Try to get as a service first (primary category services are at root level)
  const serviceData = await getServiceBySlugSingleLocation(slug, serviceOrCategory);
  if (serviceData) {
    // Check if this service belongs to the primary category
    const isPrimaryCategory = serviceData.category.is_primary;

    return (
      <ServicePage
        data={serviceData}
        siteSlug={slug}
        isPrimaryCategory={isPrimaryCategory}
      />
    );
  }

  // Try to get as a category (secondary categories have their own page)
  const categoryData = await getCategoryBySlugSingleLocation(slug, serviceOrCategory);
  if (categoryData) {
    return (
      <CategoryPage
        data={categoryData}
        siteSlug={slug}
      />
    );
  }

  // Neither service nor category found
  notFound();
}
