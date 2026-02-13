'use client';

import Link from 'next/link';
import type { Site, Location, ServiceAreaDB } from '@/types/database';
import type { WorkItem, WorkItemWithRelations } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';
import * as paths from '@/lib/routing/paths';

interface WorkDetailPageProps {
  site: Site;
  primaryLocation: Location;
  workItem: WorkItem;
  service?: { id: string; name: string; slug: string } | null;
  itemLocation?: { id: string; city: string; state: string; slug: string } | null;
  relatedItems: WorkItemWithRelations[];
  serviceAreas?: ServiceAreaDB[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
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
}: WorkDetailPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
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

  // Schema.org JSON-LD
  const domain = site.domain || site.custom_domain || `${siteSlug}.growlocal360.com`;
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: h1,
    provider: {
      '@type': 'LocalBusiness',
      name: site.name,
      telephone: phone,
      address: {
        '@type': 'PostalAddress',
        addressLocality: primaryLocation.city,
        addressRegion: primaryLocation.state,
        postalCode: primaryLocation.zip_code,
      },
    },
    ...(workItem.description && { description: workItem.description.slice(0, 300) }),
    ...(workItem.images.length > 0 && {
      image: workItem.images.map(img => img.url),
    }),
    areaServed: city && state ? {
      '@type': 'City',
      name: city,
      containedInPlace: { '@type': 'State', name: state },
    } : undefined,
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

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
        {workItem.images.length > 0 && (
          <section className="pb-12">
            <div className="mx-auto max-w-4xl px-4">
              <div className={`grid gap-4 ${
                workItem.images.length === 1
                  ? 'grid-cols-1'
                  : workItem.images.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {workItem.images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={img.url}
                    alt={img.alt || `${workItem.title} - Image ${i + 1}`}
                    className="w-full rounded-lg object-cover"
                    {...(img.width && img.height ? { width: img.width, height: img.height } : {})}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

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
                      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                        {itemImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage.url}
                            alt={itemImage.alt || item.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
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

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
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
