'use client';

import Link from 'next/link';
import { Phone, MapPin, ChevronRight, Wrench, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory } from '@/types/database';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

interface ServicePageProps {
  data: {
    site: SiteWithRelations;
    location: Location;
    service: Service;
    category: SiteCategory & { gbp_category: GBPCategory };
    siblingServices: Service[];
  };
  siteSlug: string;
  isPrimaryCategory: boolean;
}

export function ServicePage({ data, siteSlug, isPrimaryCategory }: ServicePageProps) {
  const { site, location, service, category, siblingServices } = data;
  const brandColor = site.settings?.brand_color || '#10b981';
  const phone = site.settings?.phone || location.phone;
  const categoryName = category.gbp_category.display_name;
  const categorySlug = category.gbp_category.name;

  // Build the service URL based on whether it's primary category or not
  const getServiceUrl = (svc: Service) => {
    if (isPrimaryCategory) {
      return `/sites/${siteSlug}/${svc.slug}`;
    }
    return `/sites/${siteSlug}/${categorySlug}/${svc.slug}`;
  };

  // Build breadcrumb
  const breadcrumbs = [
    { label: 'Home', href: `/sites/${siteSlug}` },
  ];

  if (!isPrimaryCategory) {
    breadcrumbs.push({
      label: categoryName,
      href: `/sites/${siteSlug}/${categorySlug}`,
    });
  }

  breadcrumbs.push({
    label: service.name,
    href: getServiceUrl(service),
  });

  // Generate Service schema
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `https://${site.domain || `${siteSlug}.growlocal360.com`}${getServiceUrl(service)}#service`,
    name: service.name,
    description: service.description || `Professional ${service.name} services in ${location.city}, ${location.state}`,
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
    serviceType: categoryName,
  };

  // Use SEO fields from service if available, otherwise generate defaults
  const pageTitle = service.meta_title || `${service.name} in ${location.city}, ${location.state} | ${site.name}`;
  const pageDescription = service.meta_description || service.description ||
    `Professional ${service.name.toLowerCase()} services in ${location.city}. ${site.name} provides fast, reliable service. Call today for a free estimate!`;
  const h1 = service.h1 || `${service.name} in ${location.city}`;
  const bodyCopy = service.body_copy ||
    `Looking for professional ${service.name.toLowerCase()} in ${location.city}, ${location.state}? ` +
    `${site.name} is your trusted local provider for all ${categoryName.toLowerCase()} needs. ` +
    `Our experienced technicians are ready to help with fast, reliable service and upfront pricing.`;

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
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="h-4 w-4" />}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-gray-900">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-gray-900">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                {/* Category badge */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  <Wrench className="h-4 w-4" />
                  <span>{categoryName}</span>
                </div>

                {/* H1 */}
                <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                  {h1}
                </h1>

                {/* Description */}
                {service.description && (
                  <p className="mt-6 text-lg text-gray-300">
                    {service.description}
                  </p>
                )}

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

                {/* Location */}
                <div className="mt-6 flex items-center gap-2 text-gray-400">
                  <MapPin className="h-4 w-4" />
                  <span>Serving {location.city}, {location.state} and surrounding areas</span>
                </div>
              </div>

              {/* Quick Features */}
              <div className="flex items-center justify-center lg:justify-end">
                <Card className="w-full max-w-md bg-white text-gray-900">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold">Why Choose Us for {service.name}</h2>
                    <ul className="mt-4 space-y-3">
                      {[
                        'Licensed & Insured Technicians',
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

        {/* Main Content */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-12 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Professional {service.name} Services
                </h2>

                <div className="mt-6 space-y-4 text-gray-600">
                  <p>{bodyCopy}</p>

                  <p>
                    At {site.name}, we understand that {service.name.toLowerCase()} issues can be stressful.
                    That&apos;s why we offer prompt, professional service to get your problem solved quickly.
                    Our team has years of experience handling all types of {categoryName.toLowerCase()} work.
                  </p>

                  <p>
                    We serve {location.city} and the surrounding {location.state} area with
                    reliable, affordable {service.name.toLowerCase()} services. Contact us today to schedule
                    your appointment or to learn more about how we can help.
                  </p>
                </div>

                {/* FAQs */}
                {service.faqs && service.faqs.length > 0 && (
                  <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Frequently Asked Questions
                    </h2>
                    <div className="mt-6 space-y-6">
                      {service.faqs.map((faq, index) => (
                        <div key={index} className="border-b pb-6 last:border-0">
                          <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                          <p className="mt-2 text-gray-600">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Contact */}
                <Card className="border-2" style={{ borderColor: brandColor }}>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900">
                      Need {service.name}?
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Call us now for fast, friendly service in {location.city}.
                    </p>
                    {phone && (
                      <Button
                        asChild
                        className="mt-4 w-full"
                        style={{ backgroundColor: brandColor }}
                      >
                        <a href={`tel:${phone.replace(/\D/g, '')}`}>
                          <Phone className="mr-2 h-4 w-4" />
                          {phone}
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Related Services */}
                {siblingServices.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="flex items-center gap-2 font-bold text-gray-900">
                        <Wrench className="h-4 w-4" />
                        Related Services
                      </h3>
                      <div className="mt-4 space-y-2">
                        {siblingServices.slice(0, 5).map((svc) => (
                          <Link
                            key={svc.id}
                            href={getServiceUrl(svc)}
                            className="flex items-center gap-2 text-sm hover:underline"
                            style={{ color: brandColor }}
                          >
                            <ChevronRight className="h-3 w-3" />
                            {svc.name}
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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
              Ready for {service.name}?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
              Contact {site.name} today for professional service in {location.city}.
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
