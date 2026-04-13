import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServiceBySlugSingleLocation, getCategoryBySlugSingleLocation, getCategoriesWithServices, getAllServiceOrCategoryParams } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getAllGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { matchReviewsToService, matchReviewsToCategory } from '@/lib/sites/match-reviews';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import { CategoryPage } from '@/components/templates/local-service-pro/category-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite, toPublicLocation, toPublicServiceDetail, toPublicServiceListing,
  toPublicCategory, toPublicReview, toPublicAreaListing, toPublicNeighborhoodListing,
  toPublicPageContent, toPublicWorkItem,
} from '@/lib/sites/public-render-model';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';

export const revalidate = 3600;

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

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';

  // Try to get as a service first (primary category services)
  const serviceData = await getServiceBySlugSingleLocation(slug, serviceOrCategory);
  if (serviceData) {
    const { service, location, site } = serviceData;
    const domain = site.custom_domain || `${slug}.${appDomain}`;
    const canonicalUrl = `https://${domain}/${serviceOrCategory}`;
    const ogImage = getSiteOgImage(site.settings);
    return withOpenGraph({
      title: service.meta_title || `${service.name} in ${location.city}, ${location.state} | ${site.name}`,
      description: service.meta_description || service.description ||
        `Professional ${service.name.toLowerCase()} services in ${location.city}. Contact ${site.name} for fast, reliable service.`,
      alternates: {
        canonical: canonicalUrl,
      },
    }, { url: canonicalUrl, siteName: site.name, logoUrl: ogImage });
  }

  // Try to get as a category (secondary categories only — primary category = home page)
  const categoryData = await getCategoryBySlugSingleLocation(slug, serviceOrCategory);
  if (categoryData) {
    if (categoryData.category.is_primary) {
      return { title: 'Redirecting...' };
    }
    const { category, location, site, pageContent } = categoryData;
    const categoryName = category.gbp_category.display_name;
    const domain = site.custom_domain || `${slug}.${appDomain}`;
    const canonicalUrl = `https://${domain}/${serviceOrCategory}`;
    const ogImage = getSiteOgImage(site.settings);
    return withOpenGraph({
      title: pageContent?.meta_title || `${categoryName} in ${location.city}, ${location.state} | ${site.name}`,
      description: pageContent?.meta_description || `Professional ${categoryName.toLowerCase()} services in ${location.city}. ${site.name} provides expert service with upfront pricing.`,
      alternates: {
        canonical: canonicalUrl,
      },
    }, { url: canonicalUrl, siteName: site.name, logoUrl: ogImage });
  }

  return { title: 'Page Not Found' };
}

export default async function ServiceOrCategoryPage({ params }: ServiceOrCategoryPageProps) {
  const { slug, serviceOrCategory } = await params;

  // Try to get as a service first (primary category services are at root level)
  const serviceData = await getServiceBySlugSingleLocation(slug, serviceOrCategory);
  if (serviceData) {
    const isPrimaryCategory = serviceData.category.is_primary;
    const admin = createAdminClient();
    const [allReviews, { categories }, { data: serviceAreas }, { data: schedulingConfig }] = await Promise.all([
      getAllGoogleReviewsForSite(serviceData.site.id),
      getCategoriesWithServices(serviceData.site.id),
      admin.from('service_areas').select('*').eq('site_id', serviceData.site.id).order('sort_order'),
      admin
        .from('scheduling_configs')
        .select('is_active, cta_style')
        .eq('site_id', serviceData.site.id)
        .single(),
    ]);

    const navCategories: NavCategory[] = categories.map(c => ({
      id: c.id,
    name: c.gbp_category.display_name,
      slug: normalizeCategorySlug(c.gbp_category.display_name),
      isPrimary: c.is_primary,
    }));

    // Smart match: show reviews mentioning this service, fall back to all
    const publicReviews = allReviews.map(toPublicReview);
    const matched = matchReviewsToService(publicReviews, serviceData.service.name);
    const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

    return (
      <ServicePage
        data={{
          site: toPublicSite(serviceData.site),
          location: toPublicLocation(serviceData.location),
          service: toPublicServiceDetail(serviceData.service),
          category: toPublicCategory(serviceData.category),
          siblingServices: serviceData.siblingServices.map(toPublicServiceListing),
        }}
        siteSlug={slug}
        isPrimaryCategory={isPrimaryCategory}
        googleReviews={displayReviews}
        categories={navCategories}
        serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
        formCategories={categories.map(toPublicCategory)}
        schedulingActive={schedulingConfig?.is_active || false}
        ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      />
    );
  }

  // Try to get as a category (secondary categories only — primary category = home page)
  const categoryData = await getCategoryBySlugSingleLocation(slug, serviceOrCategory);
  if (categoryData) {
    if (categoryData.category.is_primary) {
      redirect('/');
    }
    const admin = createAdminClient();

    // Fetch work items for all services in this category
    const categoryServiceIds = categoryData.services.map(s => s.id);
    const [allCategoryReviews, { data: serviceAreas }, { data: neighborhoods }, { data: catSchedulingConfig }, ...workItemResults] = await Promise.all([
      getAllGoogleReviewsForSite(categoryData.site.id),
      admin.from('service_areas').select('*').eq('site_id', categoryData.site.id).order('sort_order'),
      admin.from('neighborhoods').select('*').eq('site_id', categoryData.site.id).eq('is_active', true).order('sort_order'),
      admin
        .from('scheduling_configs')
        .select('is_active, cta_style')
        .eq('site_id', categoryData.site.id)
        .single(),
      ...categoryServiceIds.map(sid => getPublishedWorkItems(categoryData.site.id, { serviceId: sid, limit: 6 })),
    ]);

    // Dedupe and limit to 6 work items across all services
    const seenIds = new Set<string>();
    const categoryWorkItems = workItemResults.flat().filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    }).slice(0, 6);

    // Smart match: show reviews mentioning this category or its services
    const categoryName = categoryData.category.gbp_category.display_name;
    const serviceNames = categoryData.services.map(s => s.name);
    const publicCatReviews = allCategoryReviews.map(toPublicReview);
    const matchedCatReviews = matchReviewsToCategory(publicCatReviews, categoryName, serviceNames);
    const displayCatReviews = matchedCatReviews.length > 0 ? matchedCatReviews : publicCatReviews.slice(0, 10);

    return (
      <CategoryPage
        data={{
          site: toPublicSite(categoryData.site),
          location: toPublicLocation(categoryData.location),
          category: toPublicCategory(categoryData.category),
          services: categoryData.services.map(toPublicServiceListing),
          allCategories: categoryData.allCategories.map(toPublicCategory),
          pageContent: categoryData.pageContent ? toPublicPageContent(categoryData.pageContent) : null,
        }}
        siteSlug={slug}
        googleReviews={displayCatReviews}
        serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
        neighborhoods={(neighborhoods || []).map(toPublicNeighborhoodListing)}
        recentWorkItems={categoryWorkItems.map(toPublicWorkItem)}
        formCategories={categoryData.allCategories.map(toPublicCategory)}
        schedulingActive={catSchedulingConfig?.is_active || false}
        ctaStyle={(catSchedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      />
    );
  }

  // Neither service nor category found
  notFound();
}
