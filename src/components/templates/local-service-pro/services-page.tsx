'use client';

import Link from 'next/link';
import { Wrench, ArrowRight, Phone, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Site, Location, Service, SiteCategory, GBPCategory, ServiceAreaDB } from '@/types/database';
import { categorySlugFromName } from '@/lib/sites/get-services';
import * as paths from '@/lib/routing/paths';
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
  locationSlug?: string;
}

export function ServicesPage({ site, primaryLocation, categories, servicesByCategory, serviceAreas, siteSlug, locationSlug }: ServicesPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';
  const phone = site.settings?.phone || primaryLocation?.phone;

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const getCategoryUrl = (cat: SiteCategory & { gbp_category: GBPCategory }) => {
    const catSlug = categorySlugFromName(cat.gbp_category.display_name);
    return paths.categoryPage(catSlug, cat.is_primary, locationSlug);
  };

  const getServiceUrl = (cat: SiteCategory & { gbp_category: GBPCategory }, serviceSlug: string) => {
    const catSlug = categorySlugFromName(cat.gbp_category.display_name);
    return paths.servicePage(serviceSlug, catSlug, cat.is_primary, locationSlug);
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={navCategories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Our Services{city ? ` in ${city}` : ''}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              Browse our full range of professional services. {site.name} is your trusted local provider
              {city ? ` serving ${city} and surrounding areas` : ''}.
            </p>
          </div>
        </section>

        {/* Category Cards Overview */}
        {categories.length > 1 && (
          <section className="border-b bg-gray-50 py-12">
            <div className="mx-auto max-w-7xl px-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map((cat) => {
                  const services = servicesByCategory[cat.id] || [];
                  return (
                    <Link key={cat.id} href={getCategoryUrl(cat)}>
                      <Card className="h-full cursor-pointer transition-all hover:shadow-lg" style={{ borderTop: `3px solid ${brandColor}` }}>
                        <CardContent className="p-5">
                          <div
                            className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${brandColor}15` }}
                          >
                            <Wrench className="h-5 w-5" style={{ color: brandColor }} />
                          </div>
                          <h3 className="font-bold text-gray-900">{cat.gbp_category.display_name}</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {services.length} {services.length === 1 ? 'service' : 'services'}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Categories with Services - Detailed Sections */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="space-y-20">
              {categories.map((cat, index) => {
                const services = servicesByCategory[cat.id] || [];
                const categoryName = cat.gbp_category.display_name;

                return (
                  <div key={cat.id} id={`category-${cat.id}`} className="scroll-mt-24">
                    {/* Category Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${brandColor}15` }}
                          >
                            <Wrench className="h-6 w-6" style={{ color: brandColor }} />
                          </div>
                          <div>
                            <Link href={getCategoryUrl(cat)} className="hover:underline">
                              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                                {categoryName}
                              </h2>
                            </Link>
                            {city && (
                              <p className="mt-1 text-sm text-gray-500">
                                Professional {categoryName.toLowerCase()} services in {city}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={getCategoryUrl(cat)}
                        className="hidden items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:flex"
                        style={{ backgroundColor: brandColor }}
                      >
                        View All {categoryName}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {/* Services Grid */}
                    {services.length > 0 ? (
                      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {services.map((service) => (
                          <Link key={service.id} href={getServiceUrl(cat, service.slug)}>
                            <Card className="group h-full cursor-pointer border-gray-200 transition-all hover:border-gray-300 hover:shadow-lg">
                              <CardContent className="p-5">
                                <div className="flex items-start gap-3">
                                  <CheckCircle
                                    className="mt-0.5 h-5 w-5 shrink-0"
                                    style={{ color: brandColor }}
                                  />
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 group-hover:underline">
                                      {service.name}
                                    </h3>
                                    {service.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                                        {service.description}
                                      </p>
                                    )}
                                    <span
                                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                                      style={{ color: brandColor }}
                                    >
                                      Learn More
                                      <ArrowRight className="h-3 w-3" />
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-6 text-gray-500">Services coming soon.</p>
                    )}

                    {/* Mobile "View All" link */}
                    <div className="mt-6 sm:hidden">
                      <Link
                        href={getCategoryUrl(cat)}
                        className="inline-flex items-center gap-1 text-sm font-medium"
                        style={{ color: brandColor }}
                      >
                        View All {categoryName}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {/* Divider between categories */}
                    {index < categories.length - 1 && (
                      <div className="mt-16 border-b" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        {phone && (
          <section className="py-12" style={{ backgroundColor: `${brandColor}08` }}>
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Need Help Choosing a Service?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-gray-600">
                Our team is here to help. Call us for a free consultation and we&apos;ll recommend the right service for your needs.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 text-lg hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            </div>
          </section>
        )}

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
