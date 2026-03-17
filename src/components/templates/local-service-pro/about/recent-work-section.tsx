'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PublicRenderWorkItem } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface RecentWorkSectionProps {
  workItems: PublicRenderWorkItem[];
  brandColor: string;
  siteSlug: string;
  locationSlug?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RecentWorkSection({ workItems, locationSlug }: RecentWorkSectionProps) {
  if (workItems.length === 0) return null;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Recent Work Completed</h2>
            <p className="mt-1 text-gray-600">A look at recent projects from our team.</p>
          </div>
          <Link
            href={paths.workHub(locationSlug)}
            className="hidden items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 sm:flex"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workItems.map((item) => {
            const firstImage = item.images?.[0];
            const city = item.address_city || item.location?.city;
            const state = item.address_state || item.location?.state;

            return (
              <Link
                key={item.id}
                href={paths.workDetail(item.slug, locationSlug)}
                className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Image */}
                <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                  {firstImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstImage.url}
                      alt={firstImage.alt || item.title || 'Completed work'}
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
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-gray-700">
                    {item.title || item.h1 || 'Completed Project'}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    {item.service?.name && (
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
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={paths.workHub(locationSlug)}>
              View All Completed Work
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
