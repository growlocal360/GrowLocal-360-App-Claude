'use client';

import Link from 'next/link';
import { Phone, MapPin, ChevronRight, Wrench, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory } from '@/types/database';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

interface CategoryPageProps {
  data: {
    site: SiteWithRelations;
    location: Location;
    category: SiteCategory & { gbp_category: GBPCategory };
    services: Service[];
    allCategories: (SiteCategory & { gbp_category: GBPCategory })[];
    pageContent?: {
      meta_title?: string | null;
      meta_description?: string | null;
      h1?: string | null;
      h2?: string | null;
      body_copy?: string | null;
    } | null;
  };
  siteSlug: string;
}

export function CategoryPage({ data, siteSlug }: CategoryPageProps) {
  const { site, location, category, services, allCategories, pageContent } = data;
  const brandColor = site.settings?.brand_color || '#10b981';
  const phone = site.settings?.phone || location.phone;
  const categoryName = category.gbp_category.display_name;
  const categorySlug = category.gbp_category.name;

  // Use SEO content from pageContent if available, otherwise use defaults
  const h1 = pageContent?.h1 || `${categoryName} in ${location.city}`;
  const bodyCopy = pageContent?.body_copy ||
    `${site.name} provides professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}. From repairs to installations, our experienced team is ready to help.`;

  // Other categories for internal linking
  const otherCategories = allCategories.filter(c => c.id !== category.id);

  // Get service URL
  const getServiceUrl = (svc: Service) => {
    return `/sites/${siteSlug}/${categorySlug}/${svc.slug}`;
  };

  // Generate Service schema for the category
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `https://${site.domain || `${siteSlug}.growlocal360.com`}/${categorySlug}#service`,
    name: categoryName,
    description: `Professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}`,
    provider: {
      '@type': 'LocalBusiness',
      name: site.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: location.address_line1,
        addressLocality: location.city,
        addressRegion: location.state,
        postalCode: location.zip_code,
        addressCountry: location.country || 'US',
      },
      telephone: phone,
    },
    areaServed: {
      '@type': 'City',
      name: `${location.city}, ${location.state}`,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${categoryName} Services`,
      itemListElement: services.map((svc, index) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: svc.name,
          description: svc.description,
        },
        position: index + 1,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <SiteHeader site={site} primaryLocation={location} />

      <main>
        {/* Breadcrumb */}
        <div className="border-b bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link href={`/sites/${siteSlug}`} className="hover:text-gray-900">
                Home
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-gray-900">{categoryName}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                {/* Location badge */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  <MapPin className="h-4 w-4" />
                  <span>{location.city}, {location.state}</span>
                </div>

                {/* H1 */}
                <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                  {h1}
                </h1>

                <p className="mt-6 text-lg text-gray-300">
                  {bodyCopy.split('\n\n')[0] || bodyCopy}
                </p>

                {/* CTA Buttons */}
                <div className="mt-8 flex flex-wrap gap-4">
                  {phone && (
                    <Button
                      asChild
                      size="lg"
                      style={{ backgroundColor: brandColor }}
                      className="text-lg hover:opacity-90"
                    >
                      <a href={`tel:${phone.replace(/\D/g, '')}`}>
                        <Phone className="mr-2 h-5 w-5" />
                        Call Now: {phone}
                      </a>
                    </Button>
                  )}
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-white text-lg text-white hover:bg-white/10"
                  >
                    <a href="#contact">Get a Free Quote</a>
                  </Button>
                </div>
              </div>

              {/* Quick Features */}
              <div className="flex items-center justify-center lg:justify-end">
                <Card className="w-full max-w-md bg-white text-gray-900">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold">Why Choose {site.name}</h2>
                    <ul className="mt-4 space-y-3">
                      {[
                        'Licensed & Insured',
                        'Upfront, Honest Pricing',
                        'Same-Day Service Available',
                        'Satisfaction Guaranteed',
                        'Free Estimates',
                      ].map((feature, index) => (
                        <li key={index} className="flex items-center gap-3">
                          <CheckCircle
                            className="h-5 w-5 shrink-0"
                            style={{ color: brandColor }}
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">
                Our {categoryName} Services
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                We offer a comprehensive range of {categoryName.toLowerCase()} services
                to meet all your needs in {location.city}.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Link key={service.id} href={getServiceUrl(service)}>
                  <Card className="h-full cursor-pointer transition-all hover:border-gray-300 hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}20` }}
                        >
                          <Wrench className="h-6 w-6" style={{ color: brandColor }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          {service.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                              {service.description}
                            </p>
                          )}
                          <div
                            className="mt-3 flex items-center gap-1 text-sm font-medium"
                            style={{ color: brandColor }}
                          >
                            Learn More
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {pageContent?.h2 || `${categoryName} Experts in ${location.city}`}
                </h2>
                <div className="mt-6 space-y-4 text-gray-600">
                  {bodyCopy.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                  {!pageContent?.body_copy && (
                    <>
                      <p>
                        Whether you need emergency repairs, routine maintenance, or a complete installation,
                        we have the skills and experience to get the job done right. We pride ourselves on
                        honest pricing, quality workmanship, and excellent customer service.
                      </p>
                      <p>
                        Contact us today to schedule your {categoryName.toLowerCase()} service in {location.city}.
                        We offer free estimates and same-day service availability.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Other Categories */}
              {otherCategories.length > 0 && (
                <div>
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-bold text-gray-900">Our Other Services</h3>
                      <div className="mt-4 space-y-2">
                        {otherCategories.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/sites/${siteSlug}/${cat.gbp_category.name}`}
                            className="flex items-center gap-2 text-sm hover:underline"
                            style={{ color: brandColor }}
                          >
                            <Wrench className="h-3 w-3" />
                            {cat.gbp_category.display_name}
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          id="contact"
          className="py-16"
          style={{ backgroundColor: brandColor }}
        >
          <div className="mx-auto max-w-7xl px-4 text-center text-white">
            <h2 className="text-3xl font-bold md:text-4xl">
              Need {categoryName} in {location.city}?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
              Contact {site.name} today for professional service.
              We offer free estimates and same-day availability.
            </p>
            {phone && (
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-8 text-lg"
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            )}
          </div>
        </section>
      </main>

      <SiteFooter site={site} primaryLocation={location} />
    </div>
  );
}
