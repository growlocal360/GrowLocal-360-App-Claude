'use client';

import Link from 'next/link';
import type { Site, Location, ServiceAreaDB } from '@/types/database';
import type { WorkItemWithRelations } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';
import * as paths from '@/lib/routing/paths';

interface WorkHubPageProps {
  site: Site;
  primaryLocation: Location | null;
  workItems: WorkItemWithRelations[];
  serviceAreas?: ServiceAreaDB[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function WorkItemCard({
  item,
  locationSlug,
}: {
  item: WorkItemWithRelations;
  locationSlug?: string;
}) {
  const firstImage = item.images?.[0];
  const city = item.address_city || item.location?.city;
  const state = item.address_state || item.location?.state;

  return (
    <Link
      href={paths.workDetail(item.slug, locationSlug)}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage.url}
            alt={firstImage.alt || item.title}
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

      {/* Content */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
          {item.title}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {item.service && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {item.service.name}
            </span>
          )}
          {city && state && (
            <span>{city}, {state}</span>
          )}
          {item.performed_at && (
            <span>{formatDate(item.performed_at)}</span>
          )}
        </div>

        {item.summary && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.summary}</p>
        )}
      </div>
    </Link>
  );
}

export function WorkHubPage({
  site,
  primaryLocation,
  workItems,
  serviceAreas,
  categories,
  siteSlug,
  locationSlug,
}: WorkHubPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader
        site={site}
        primaryLocation={primaryLocation}
        categories={categories}
        siteSlug={siteSlug}
        locationSlug={locationSlug}
      />

      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">Recent Work</h1>
            <p className="mt-4 text-lg text-white/90">
              See examples of our recent projects and the quality work we deliver.
            </p>
          </div>
        </section>

        {/* Work Items Grid */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            {workItems.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {workItems.map((item) => (
                  <WorkItemCard key={item.id} item={item} locationSlug={locationSlug} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-lg text-gray-500">
                  No work items to show yet. Check back soon for examples of our recent projects.
                </p>
              </div>
            )}
          </div>
        </section>

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
