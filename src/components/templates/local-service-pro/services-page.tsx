'use client';

import Link from 'next/link';
import { Wrench, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Location, Service, SiteCategory, GBPCategory, ServiceAreaDB } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';

interface ServicesPageProps {
  site: Site;
  primaryLocation: Location | null;
  categories: (SiteCategory & { gbp_category: GBPCategory })[];
  servicesByCategory: Record<string, Service[]>;
  serviceAreas?: ServiceAreaDB[];
  siteSlug: string;
}

export function ServicesPage({ site, primaryLocation, categories, servicesByCategory, serviceAreas, siteSlug }: ServicesPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: c.gbp_category.name,
    isPrimary: c.is_primary,
  }));

  const getCategoryUrl = (cat: SiteCategory & { gbp_category: GBPCategory }) => {
    return cat.is_primary ? '/' : `/${cat.gbp_category.name}`;
  };

  const getServiceUrl = (cat: SiteCategory & { gbp_category: GBPCategory }, serviceSlug: string) => {
    if (cat.is_primary) {
      return `/${serviceSlug}`;
    }
    return `/${cat.gbp_category.name}/${serviceSlug}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={navCategories} siteSlug={siteSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Our Services{city ? ` in ${city}` : ''}
            </h1>
            <p className="mt-4 text-lg text-white/90">
              {site.name} offers a comprehensive range of professional services to meet all your needs.
            </p>
          </div>
        </section>

        {/* Categories with Services */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="space-y-16">
              {categories.map((cat) => {
                const services = servicesByCategory[cat.id] || [];
                const categoryName = cat.gbp_category.display_name;

                return (
                  <div key={cat.id}>
                    {/* Category Header */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                        {categoryName}
                      </h2>
                      <Link
                        href={getCategoryUrl(cat)}
                        className="flex items-center gap-1 text-sm font-medium hover:underline"
                        style={{ color: brandColor }}
                      >
                        View All
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {/* Services Grid */}
                    {services.length > 0 ? (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {services.map((service) => (
                          <Link key={service.id} href={getServiceUrl(cat, service.slug)}>
                            <Card className="h-full cursor-pointer transition-all hover:border-gray-300 hover:shadow-lg">
                              <CardContent className="p-5">
                                <div className="flex items-start gap-3">
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                                    style={{ backgroundColor: `${brandColor}20` }}
                                  >
                                    <Wrench className="h-5 w-5" style={{ color: brandColor }} />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                                    {service.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                                        {service.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-gray-500">Services coming soon.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} />
    </div>
  );
}
