'use client';

import Link from 'next/link';
import { Phone, ArrowRight, MapPin, Wrench, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderBrandDetail, PublicRenderAreaListing, PublicRenderReview, PublicRenderBrandListing } from '@/lib/sites/public-render-model';
import type { BrandValueProp, ServiceFAQ } from '@/types/database';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildWebPageSchema,
  buildFAQPageSchema,
  buildBreadcrumbSchema,
  getSiteUrl,
  toBusinessInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';
import { TestimonialsSection } from './testimonials-section';

interface BrandService {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  isPrimaryCategory: boolean;
}

interface BrandDetailPageProps {
  site: PublicRenderSite;
  brand: PublicRenderBrandDetail;
  primaryLocation: PublicRenderLocation | null;
  services: BrandService[];
  serviceAreas: PublicRenderAreaListing[];
  brands: PublicRenderBrandListing[];
  categories: NavCategory[];
  googleReviews: PublicRenderReview[];
  siteSlug: string;
  locationSlug?: string;
}

export function BrandDetailPage({
  site,
  brand,
  primaryLocation,
  services,
  serviceAreas,
  brands,
  categories,
  googleReviews,
  siteSlug,
  locationSlug,
}: BrandDetailPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';
  const state = primaryLocation?.state || '';
  const phone = site.settings?.phone || primaryLocation?.phone;
  const industry = (site.settings?.core_industry as string) || '';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;

  // Other brands for cross-linking (exclude current)
  const otherBrands = brands.filter(b => b.id !== brand.id);

  // AI content with template fallbacks
  const heroHeading = brand.h1 || `${brand.name} ${industry}${city ? ` ${city} ${state}` : ''}${city ? ' & Local Areas' : ''}`;
  const heroDescription = brand.hero_description || `${site.name} provides professional ${brand.name} ${industry.toLowerCase()} services${city ? ` in ${city}, ${state} and surrounding areas` : ''}. Trust your local experts for all your ${brand.name} needs.`;
  const valueProps: BrandValueProp[] = (brand.value_props as BrandValueProp[] | null) || [
    { title: 'Experienced Technicians', description: `Our team is trained and experienced with ${brand.name} products and equipment.` },
    { title: 'Fast, Reliable Service', description: `Same-day and next-day appointments available for ${brand.name} service calls${city ? ` in ${city}` : ''}.` },
    { title: 'Local & Trusted', description: `${site.name} is a trusted local business${city ? ` serving ${city} and surrounding communities` : ''}.` },
  ];
  const ctaHeading = brand.cta_heading || `Need ${brand.name} Service${city ? ` in ${city}` : ''}?`;
  const ctaDescription = brand.cta_description || `Contact ${site.name} today for expert ${brand.name} ${industry.toLowerCase()} service.${phone ? ' Call now or fill out the form below.' : ' Fill out the form below to get started.'}`;
  const faqs = brand.faqs as ServiceFAQ[] | null;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const brandUrl = siteUrl + paths.brandPage(brand.slug, locationSlug);
  const webPageSchema = buildWebPageSchema(
    heroHeading,
    heroDescription,
    brandUrl,
    'WebPage',
    businessInput
  );
  const faqSchema = faqs && faqs.length > 0
    ? buildFAQPageSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))
    : null;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: siteUrl },
    { name: 'Brands', url: siteUrl + paths.brandsIndex(locationSlug) },
    { name: brand.name, url: brandUrl },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[webPageSchema, faqSchema, breadcrumbSchema]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              {heroHeading}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              {heroDescription}
            </p>
            {phone && (
              <Button
                asChild
                size="lg"
                className="mt-6 bg-white hover:bg-gray-100"
                style={{ color: brandColor }}
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            )}
          </div>
        </section>

        {/* Why Choose Us for Brand */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Why Choose {site.name} for {brand.name}?
            </h2>
            {brand.body_copy && (
              <p className="mt-4 max-w-3xl text-gray-600">
                {brand.body_copy}
              </p>
            )}
            <div className={`mt-8 grid gap-6 ${valueProps.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
              {valueProps.map((prop, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" style={{ color: brandColor }} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{prop.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{prop.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services for this Brand */}
        {services.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Our {brand.name} Services
              </h2>
              <p className="mt-2 text-gray-600">
                We offer a full range of services for your {brand.name} products.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <Link
                    key={service.id}
                    href={paths.servicePage(service.slug, service.categorySlug, service.isPrimaryCategory, locationSlug)}
                  >
                    <Card className="h-full cursor-pointer transition-all hover:shadow-lg">
                      <CardContent className="p-5">
                        <div
                          className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <Wrench className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <h3 className="font-bold text-gray-900">{service.name}</h3>
                        <span
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                          style={{ color: brandColor }}
                        >
                          Learn More
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Service Areas */}
        {serviceAreas.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                {brand.name} Service Available In
              </h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {serviceAreas.map((area) => (
                  <Link key={area.id} href={paths.areaPage(area.slug, locationSlug)}>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:shadow-sm">
                      <MapPin className="h-4 w-4 shrink-0" style={{ color: brandColor }} />
                      <span className="text-sm font-medium text-gray-900">
                        {area.name}{area.state ? `, ${area.state}` : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Testimonials */}
        <TestimonialsSection
          city={city || 'Our'}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />

        {/* FAQs — only rendered when AI content is available */}
        {faqs && faqs.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                {brand.name} FAQs
              </h2>
              <div className="mt-8 space-y-6">
                {faqs.map((faq, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                    <p className="mt-2 text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-12" style={{ backgroundColor: `${brandColor}08` }}>
          <div className="mx-auto max-w-7xl px-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {ctaHeading}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-600">
              {ctaDescription}
            </p>
            {phone && (
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
            )}
          </div>
        </section>

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />

        {/* Other Brands */}
        {otherBrands.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Other Brands We Service
              </h2>
              <div className="mt-6 flex flex-wrap gap-2">
                {otherBrands.map((b) => (
                  <Link
                    key={b.id}
                    href={paths.brandPage(b.slug, locationSlug)}
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:shadow-sm"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
