'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Site, ServiceAreaDB, Neighborhood } from '@/types/database';
import * as paths from '@/lib/routing/paths';

interface ServiceAreasSectionProps {
  site: Site;
  serviceAreas: ServiceAreaDB[];
  neighborhoods?: Neighborhood[];
  siteSlug: string;
  locationSlug?: string;
}

export function ServiceAreasSection({ site, serviceAreas, neighborhoods, locationSlug }: ServiceAreasSectionProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';

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
    <section id="service-areas" className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
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
              className="flex items-center gap-1 text-sm hover:underline"
              style={{ color: brandColor }}
            >
              <ChevronRight className="h-3 w-3 shrink-0" />
              {area.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
