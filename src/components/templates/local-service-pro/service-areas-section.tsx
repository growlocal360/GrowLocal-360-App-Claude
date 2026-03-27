'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { PublicRenderSite, PublicRenderAreaListing, PublicRenderNeighborhoodListing } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface ServiceAreasSectionProps {
  site: PublicRenderSite;
  serviceAreas: PublicRenderAreaListing[];
  neighborhoods?: PublicRenderNeighborhoodListing[];
  siteSlug: string;
  locationSlug?: string;
}

export function ServiceAreasSection({ site, serviceAreas, neighborhoods, locationSlug }: ServiceAreasSectionProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';

  // Combine neighborhoods and service areas for display
  const allAreas = [
    ...(neighborhoods || []).map((n) => ({
      id: n.id,
      name: n.name,
      href: paths.neighborhoodPage(n.slug, locationSlug),
    })),
    ...serviceAreas.map((a) => ({
      id: a.id,
      name: a.state ? `${a.name}, ${a.state}` : a.name,
      href: paths.areaPage(a.slug, locationSlug),
    })),
  ];

  if (allAreas.length === 0) return null;

  return (
    <section id="service-areas" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Neighborhoods & Cities We Serve
          </h2>
          <p className="mt-2 text-gray-600">
            Proudly serving these communities and beyond
          </p>
        </div>

        {/* 4-column grid of linked area names */}
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {allAreas.map((area) => (
            <Link
              key={area.id}
              href={area.href}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-300 hover:shadow-sm"
              style={{ borderColor: `${brandColor}30` }}
            >
              <ChevronRight className="h-3 w-3 shrink-0" style={{ color: brandColor }} />
              {area.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
