import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { JobSnapsPage } from '@/components/templates/local-service-pro/job-snaps-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicAreaListing,
} from '@/lib/sites/public-render-model';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface JobSnapsPageRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: JobSnapsPageRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = data.site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/job-snaps`;

  return {
    title: `Careers at ${data.site.name} | Job Opportunities`,
    description: `Looking for a career in ${data.site.settings?.core_industry?.toLowerCase() || 'professional services'}? Join the ${data.site.name} team.`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function JobSnapsPageRoute({ params }: JobSnapsPageRouteProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <JobSnapsPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
