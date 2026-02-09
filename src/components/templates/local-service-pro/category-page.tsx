'use client';

import Link from 'next/link';
import { Phone, ChevronRight, Wrench, ArrowRight, Star, Shield, Award, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory, GoogleReview } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { MultiStepForm } from './multi-step-form';
import { TrustBar } from './trust-bar';
import { LeadCaptureSection } from './lead-capture-section';
import { TestimonialsSection } from './testimonials-section';

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
      hero_description?: string | null;
      body_copy?: string | null;
      body_copy_2?: string | null;
    } | null;
  };
  siteSlug: string;
  googleReviews?: GoogleReview[];
}

export function CategoryPage({ data, siteSlug, googleReviews }: CategoryPageProps) {
  const { site, location, category, services, allCategories, pageContent } = data;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const phone = site.settings?.phone || location.phone;
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const categoryName = category.gbp_category.display_name;
  const categorySlug = category.gbp_category.name;

  const h1 = pageContent?.h1 || `${categoryName} in ${location.city}`;
  const heroDescription = pageContent?.hero_description ||
    `Professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}.`;
  const bodyCopy = pageContent?.body_copy ||
    `${site.name} provides professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}.`;
  const otherCategories = allCategories.filter(c => c.id !== category.id);

  const navCategories: NavCategory[] = allCategories.map(c => ({
    name: c.gbp_category.display_name,
    slug: c.gbp_category.name,
    isPrimary: c.is_primary,
  }));

  const getServiceUrl = (svc: Service) => {
    return `/${categorySlug}/${svc.slug}`;
  };

  // Schema.org
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: categoryName,
    description: `Professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}`,
    provider: {
      '@type': 'LocalBusiness',
      name: site.name,
      telephone: phone,
    },
    areaServed: {
      '@type': 'City',
      name: `${location.city}, ${location.state}`,
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <SiteHeader site={site} primaryLocation={location} categories={navCategories} siteSlug={siteSlug} />

      <main>
        {/* Breadcrumb */}
        <div className="border-b bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link href="/" className="hover:text-gray-900">
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
              <div className="flex flex-col justify-center">
                <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i <= Math.round(averageRating || 5)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-500 text-gray-500'
                        }`}
                      />
                    ))}
                  </div>
                  <span>
                    {averageRating
                      ? `${averageRating.toFixed(1)}-Star Rated · ${totalReviewCount || 0} Google Reviews`
                      : '5-Star Rated Service'}
                  </span>
                </div>

                <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                  {h1}
                </h1>

                <p className="mt-4 text-lg text-gray-300">
                  {heroDescription}
                </p>

                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { icon: Shield, label: 'Licensed & Insured' },
                    { icon: Award, label: 'Locally Owned' },
                    { icon: Clock, label: 'Same-Day Service' },
                  ].map((badge) => (
                    <div key={badge.label} className="flex items-center gap-2 text-sm text-gray-300">
                      <badge.icon className="h-5 w-5 shrink-0" style={{ color: brandColor }} />
                      <span>{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-step form */}
              <div className="flex items-center justify-center lg:justify-end">
                <Card className="w-full max-w-md bg-white text-gray-900">
                  <CardContent className="p-6">
                    <MultiStepForm
                      siteId={site.id}
                      brandColor={brandColor}
                      services={services}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <TrustBar brandColor={brandColor} averageRating={averageRating} totalReviewCount={totalReviewCount} />

        {/* Services Grid */}
        {services.length > 0 && (
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
        )}

        {/* Localized Content Section */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                  {pageContent?.h2 || `${categoryName} Experts in ${location.city}`}
                </h2>
                <div className="mt-6 space-y-4 text-gray-600">
                  {bodyCopy.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="aspect-[4/3] rounded-lg bg-gray-200" />
                <div className="aspect-[4/3] rounded-lg bg-gray-200" />
              </div>
            </div>
          </div>
        </section>

        {/* Lead Capture Form */}
        <LeadCaptureSection
          siteId={site.id}
          brandColor={brandColor}
          services={services}
        />

        {/* Testimonials */}
        <TestimonialsSection
          city={location.city}
          count={3}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />

        {/* Other Categories */}
        {otherCategories.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-center text-2xl font-bold text-gray-900">
                Our Other Services
              </h2>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {otherCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/${cat.gbp_category.name}`}
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                    style={{ color: brandColor }}
                  >
                    <Wrench className="h-4 w-4 shrink-0" />
                    {cat.gbp_category.display_name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section
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

      <SiteFooter site={site} primaryLocation={location} siteSlug={siteSlug} />
    </div>
  );
}
