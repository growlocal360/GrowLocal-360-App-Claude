'use client';

import Link from 'next/link';
import type { PublicRenderWorkItem } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface RecentWorkSectionProps {
  workItems: PublicRenderWorkItem[];
  brandColor: string;
  siteSlug: string;
  locationSlug?: string;
}

export function RecentWorkSection({ workItems, brandColor, locationSlug }: RecentWorkSectionProps) {
  if (workItems.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-4 text-3xl font-bold text-gray-900">Recent Work We&apos;ve Completed</h2>
        <p className="mb-8 text-lg text-gray-600">
          Real projects from real customers in our service area.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workItems.map((item) => {
            const href = paths.workDetail(item.slug, locationSlug);
            const image = item.images?.[0];

            return (
              <Link
                key={item.id}
                href={href}
                className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt={image.alt || item.title || 'Completed work'}
                    className="h-48 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:underline">
                    {item.title || item.h1 || 'Completed Project'}
                  </h3>
                  {item.summary && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.service?.name && (
                      <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${brandColor}15`, color: brandColor }}>
                        {item.service.name}
                      </span>
                    )}
                    {item.address_city && (
                      <span>{item.address_city}, {item.address_state}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link
            href={paths.workHub(locationSlug)}
            className="inline-flex items-center gap-2 font-medium hover:underline"
            style={{ color: brandColor }}
          >
            View All Completed Work
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
