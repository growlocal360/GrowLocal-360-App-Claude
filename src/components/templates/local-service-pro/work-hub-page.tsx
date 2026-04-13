'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing, PublicRenderWorkItem, PublicRenderCategory } from '@/lib/sites/public-render-model';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { UnifiedLeadForm } from './unified-lead-form';
import * as paths from '@/lib/routing/paths';

interface WorkHubPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  workItems: PublicRenderWorkItem[];
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  siteId: string;
  hasMore?: boolean;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function WorkItemCard({
  item,
  locationSlug,
}: {
  item: PublicRenderWorkItem;
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
      <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100">
        {firstImage ? (
          <Image
            src={firstImage.url}
            alt={firstImage.alt || item.title}
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
          {item.brand_name && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {item.brand_name}
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
  siteId,
  hasMore = false,
  formCategories,
  schedulingActive = false,
  ctaStyle = 'booking',
}: WorkHubPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const [displayedItems, setDisplayedItems] = useState(workItems);
  const [hasMoreItems, setHasMoreItems] = useState(hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/public/work?siteId=${siteId}&offset=${displayedItems.length}&limit=12`
      );
      const json = await res.json();
      setDisplayedItems((prev) => [...prev, ...json.items]);
      setHasMoreItems(json.hasMore);
    } catch {
      // silently fail — items already displayed
    } finally {
      setIsLoadingMore(false);
    }
  }

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
            {displayedItems.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedItems.map((item) => (
                    <WorkItemCard key={item.id} item={item} locationSlug={locationSlug} />
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="rounded-lg border border-gray-300 bg-white px-8 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      {isLoadingMore ? 'Loading…' : 'Load More Work'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-lg text-gray-500">
                  No work items to show yet. Check back soon for examples of our recent projects.
                </p>
              </div>
            )}
          </div>
        </section>

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
