'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrench, CheckCircle, Shield, Clock, Award, ThumbsUp, AlertTriangle, Plus, Minus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory, GoogleReview, SitePage } from '@/types/database';
import { categorySlugFromName } from '@/lib/sites/get-services';
import * as paths from '@/lib/routing/paths';
import { SiteHeader, NavCategory } from './site-header';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';
import { SiteFooter } from './site-footer';
import { TestimonialsSection } from './testimonials-section';
import { LeadCaptureSection } from './lead-capture-section';

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
  googleReviews?: GoogleReview[];
  categories?: NavCategory[];
  locationSlug?: string;
}

export function ServicePage({ data, siteSlug, isPrimaryCategory, googleReviews, categories, locationSlug }: ServicePageProps) {
  const { site, location, service, category, siblingServices } = data;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const phone = site.settings?.phone || location.phone;
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const categoryName = category.gbp_category.display_name;
  const categorySlug = categorySlugFromName(category.gbp_category.display_name);

  const getServiceUrl = (svc: Service) => {
    return paths.servicePage(svc.slug, categorySlug, isPrimaryCategory, locationSlug);
  };

  // Construct SitePage-like object for shared HeroSection
  const heroContent = {
    h1: service.h1 || `Professional ${service.name} Services in ${location.city}, ${location.state}`,
    hero_description: service.intro_copy || service.description ||
      `Looking for professional ${service.name.toLowerCase()} in ${location.city}, ${location.state}? ${site.name} is your trusted local provider.`,
  } as SitePage;

  const allServices = siblingServices.length > 0 ? [service, ...siblingServices] : [service];

  const bodyCopy = service.body_copy ||
    `${site.name} provides expert ${service.name.toLowerCase()} services in ${location.city}. Our experienced team delivers quality workmanship with upfront pricing.`;

  // Schema.org
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
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

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <SiteHeader site={site} primaryLocation={location} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />

      <main>
        <HeroSection
          site={site}
          primaryLocation={location}
          pageContent={heroContent}
          services={allServices}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        <TrustBar
          brandColor={brandColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />

        {/* Service Introduction Card */}
        {service.intro_copy && (
          <section className="py-12">
            <div className="mx-auto max-w-7xl px-4">
              <Card className="border-l-4" style={{ borderLeftColor: brandColor }}>
                <CardContent className="p-6">
                  <p className="text-gray-700">{service.intro_copy}</p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* Problems / Solutions Section */}
        {service.problems && service.problems.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Common Issues We Solve
              </h2>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {service.problems.map((problem, index) => (
                  <Card key={index} className="border-0 shadow-md">
                    <CardContent className="p-6">
                      <div
                        className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${brandColor}20` }}
                      >
                        <AlertTriangle className="h-6 w-6" style={{ color: brandColor }} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{problem.heading}</h3>
                      <p className="mt-2 text-sm text-gray-600">{problem.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Detailed Service Information */}
        {service.detailed_sections && service.detailed_sections.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-4xl px-4">
              {service.detailed_sections.map((section, index) => (
                <div key={index} className={index > 0 ? 'mt-12' : ''}>
                  <h2 className="text-xl font-bold text-gray-900 md:text-2xl">{section.h2}</h2>
                  <p className="mt-4 text-gray-600">{section.body}</p>
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {section.bullets.map((bullet, bIndex) => (
                        <li key={bIndex} className="flex items-start gap-2 text-gray-600">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brandColor }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fallback body copy if no detailed_sections */}
        {(!service.detailed_sections || service.detailed_sections.length === 0) && (
          <section className="py-16">
            <div className="mx-auto max-w-4xl px-4">
              <h2 className="text-2xl font-bold text-gray-900">
                About Our {service.name} Services
              </h2>
              <div className="mt-6 space-y-4 text-gray-600">
                {bodyCopy.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Why Choose Us */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-center text-2xl font-bold text-gray-900 md:text-3xl">
              Why Choose {site.name}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Shield, title: 'Licensed & Insured', desc: 'Fully licensed and insured for your protection.' },
                { icon: Clock, title: 'Fast Service', desc: 'Quick response times and same-day availability.' },
                { icon: ThumbsUp, title: 'Upfront Pricing', desc: 'No hidden fees. Know the cost before we start.' },
                { icon: Award, title: 'Satisfaction Guaranteed', desc: 'We stand behind our work 100%.' },
              ].map((feature) => (
                <div key={feature.title} className="text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${brandColor}20` }}
                  >
                    <feature.icon className="h-7 w-7" style={{ color: brandColor }} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Lead Capture Form */}
        <LeadCaptureSection
          siteId={site.id}
          brandColor={brandColor}
          services={allServices}
        />

        {/* Testimonials */}
        <TestimonialsSection
          city={location.city}
          count={2}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />

        {/* FAQ Accordion Section */}
        {service.faqs && service.faqs.length > 0 && (
          <FAQSection faqs={service.faqs} brandColor={brandColor} />
        )}

        {/* Related Services */}
        {siblingServices.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Related Services
              </h2>
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {siblingServices.slice(0, 4).map((svc) => (
                  <Link key={svc.id} href={getServiceUrl(svc)}>
                    <Card className="h-full cursor-pointer transition-all hover:border-gray-300 hover:shadow-lg">
                      <CardContent className="p-6">
                        <div
                          className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}20` }}
                        >
                          <Wrench className="h-6 w-6" style={{ color: brandColor }} />
                        </div>
                        <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                        <div
                          className="mt-2 flex items-center gap-1 text-sm font-medium"
                          style={{ color: brandColor }}
                        >
                          Learn More
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter site={site} primaryLocation={location} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}

// FAQ Accordion component
function FAQSection({ faqs, brandColor }: { faqs: { question: string; answer: string }[]; brandColor: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-2xl font-bold text-gray-900 md:text-3xl">
          Frequently Asked Questions
        </h2>
        <div className="mt-10 space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-lg border">
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                {openIndex === index ? (
                  <Minus className="h-5 w-5 shrink-0 text-gray-500" />
                ) : (
                  <Plus className="h-5 w-5 shrink-0 text-gray-500" />
                )}
              </button>
              {openIndex === index && (
                <div className="border-t px-6 py-4">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
