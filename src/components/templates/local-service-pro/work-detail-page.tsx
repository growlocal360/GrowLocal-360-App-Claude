'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing, PublicRenderWorkItem, PublicRenderCategory } from '@/lib/sites/public-render-model';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { UnifiedLeadForm } from './unified-lead-form';
import { BeforeAfterSlider } from './before-after-slider';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildServiceSchema,
  buildBreadcrumbSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';

interface WorkDetailPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation;
  workItem: PublicRenderWorkItem;
  service?: { id: string; name: string; slug: string } | null;
  itemLocation?: { id: string; city: string; state: string; slug: string } | null;
  relatedItems: PublicRenderWorkItem[];
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function WorkDetailPage({
  site,
  primaryLocation,
  workItem,
  service,
  itemLocation,
  relatedItems,
  serviceAreas,
  categories,
  siteSlug,
  locationSlug,
  formCategories,
  schedulingActive = false,
  ctaStyle = 'booking',
}: WorkDetailPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || primaryLocation.phone;

  // Build H1: {Brand?} {Service Name} in {City}, {State}
  const city = workItem.address_city || itemLocation?.city || primaryLocation.city;
  const state = workItem.address_state || itemLocation?.state || primaryLocation.state;
  const serviceName = service?.name || '';
  const h1 = workItem.h1 || [
    workItem.brand_name,
    serviceName,
    city && state ? `in ${city}, ${state}` : '',
  ].filter(Boolean).join(' ');

  // Address line: streetName, City, State ZIP (no house number)
  const addressParts = [
    workItem.address_street_name,
    city && state ? `${city}, ${state}` : null,
    workItem.address_zip,
  ].filter(Boolean);
  const addressLine = addressParts.length > 0 ? addressParts.join(' ') : null;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const locationInput = toLocationInput(primaryLocation);
  const siteUrl = getSiteUrl(businessInput);

  const serviceSchema = buildServiceSchema(
    {
      name: h1,
      slug: workItem.slug,
      description: workItem.description ? workItem.description.slice(0, 300) : null,
      categoryName: serviceName || 'Service',
    },
    businessInput,
    locationInput,
    { serviceUrl: siteUrl + paths.workDetail(workItem.slug, locationSlug) }
  );
  // Add images if available
  if (workItem.images.length > 0) {
    serviceSchema.image = workItem.images.map(img => img.url);
  }

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: siteUrl + paths.locationHome(locationSlug) },
    { name: 'Our Work', url: siteUrl + paths.workHub(locationSlug) },
    { name: h1, url: siteUrl + paths.workDetail(workItem.slug, locationSlug) },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceSchema, breadcrumbSchema]} />

      <SiteHeader
        site={site}
        primaryLocation={primaryLocation}
        categories={categories}
        siteSlug={siteSlug}
        locationSlug={locationSlug}
      />

      <main>
        {/* Breadcrumb */}
        <nav className="border-b bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <ol className="flex items-center gap-2 text-sm text-gray-500">
              <li>
                <Link href={paths.locationHome(locationSlug)} className="hover:text-gray-700">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href={paths.workHub(locationSlug)} className="hover:text-gray-700">
                  Recent Work
                </Link>
              </li>
              <li>/</li>
              <li className="text-gray-900">{workItem.title}</li>
            </ol>
          </div>
        </nav>

        {/* Header */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4">
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">{h1}</h1>

            {addressLine && (
              <p className="mt-2 text-gray-500">{addressLine}</p>
            )}

            {/* Meta Row */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {workItem.performed_at && (
                <span>{formatDate(workItem.performed_at)}</span>
              )}
              {service && (
                <Link
                  href={paths.servicePage(service.slug, undefined, true, locationSlug)}
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {service.name}
                </Link>
              )}
              {workItem.brand_name && (
                <span className="text-gray-500">{workItem.brand_name}</span>
              )}
            </div>
          </div>
        </section>

        {/* Image Gallery */}
        {workItem.images.length > 0 && (() => {
          // Detect before/after pairs
          const pairs = new Map<number, { before?: typeof workItem.images[0]; after?: typeof workItem.images[0] }>();
          const standardImages: typeof workItem.images = [];

          for (const img of workItem.images) {
            if (img.pairGroup && (img.role === 'before' || img.role === 'after')) {
              const pair = pairs.get(img.pairGroup) || {};
              pair[img.role] = img;
              pairs.set(img.pairGroup, pair);
            } else {
              standardImages.push(img);
            }
          }

          const completePairs = Array.from(pairs.entries())
            .filter(([, p]) => p.before && p.after)
            .sort(([a], [b]) => a - b);

          return (
            <section className="pb-12">
              <div className="mx-auto max-w-4xl px-4 space-y-6">
                {/* Before/After sliders */}
                {completePairs.length > 0 && (
                  <div className={`grid gap-6 ${completePairs.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {completePairs.map(([group, pair]) => (
                      <BeforeAfterSlider
                        key={group}
                        beforeSrc={pair.before!.url}
                        afterSrc={pair.after!.url}
                        beforeAlt={pair.before!.alt || `Before — ${workItem.title}`}
                        afterAlt={pair.after!.alt || `After — ${workItem.title}`}
                      />
                    ))}
                  </div>
                )}

                {/* Standard images */}
                {standardImages.length > 0 && (
                  <div className={`grid gap-4 ${
                    standardImages.length === 1
                      ? 'grid-cols-1'
                      : standardImages.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {standardImages.map((img, i) => (
                      <div key={i} className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={img.url}
                          alt={img.alt || `${workItem.title} - Image ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          priority={i === 0}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Description */}
        {workItem.description && (
          <section className="pb-12">
            <div className="mx-auto max-w-4xl px-4">
              <div className="prose prose-lg max-w-none text-gray-700">
                {workItem.description.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Related Work */}
        {relatedItems.length > 0 && (
          <section className="border-t bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="mb-8 text-2xl font-bold text-gray-900">More Recent Work</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedItems.map((item) => {
                  const itemImage = item.images?.[0];
                  const itemCity = item.address_city || item.location?.city;
                  const itemState = item.address_state || item.location?.state;

                  return (
                    <Link
                      key={item.id}
                      href={paths.workDetail(item.slug, locationSlug)}
                      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100">
                        {itemImage ? (
                          <Image
                            src={itemImage.url}
                            alt={itemImage.alt || item.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-400">
                            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                          {item.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                          {item.service && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                              {item.service.name}
                            </span>
                          )}
                          {itemCity && itemState && (
                            <span>{itemCity}, {itemState}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <UnifiedLeadForm
          siteId={site.id}
          brandColor={brandColor}
          categories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          variant="section"
        />
      </main>

      <SiteFooter
        site={site}
        primaryLocation={primaryLocation}
        serviceAreas={serviceAreas}
        siteSlug={siteSlug}
        locationSlug={locationSlug}
      />
    </div>
  );
}
