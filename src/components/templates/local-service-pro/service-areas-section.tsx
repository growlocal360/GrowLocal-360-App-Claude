'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Site, ServiceAreaDB } from '@/types/database';

interface ServiceAreasSectionProps {
  site: Site;
  serviceAreas: ServiceAreaDB[];
  siteSlug: string;
}

export function ServiceAreasSection({ site, serviceAreas, siteSlug }: ServiceAreasSectionProps) {
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';

  return (
    <section id="areas" className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Service Areas
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Proudly serving these communities with quality {industry.toLowerCase()}
          </p>
        </div>

        {/* Service areas grid */}
        <div className="flex flex-wrap justify-center gap-3">
          {serviceAreas.map((area) => (
            <Link key={area.id} href={`/sites/${siteSlug}/areas/${area.slug}`}>
              <Badge
                variant="outline"
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-base transition-colors hover:bg-gray-100"
              >
                <MapPin className="h-4 w-4" style={{ color: brandColor }} />
                <span>
                  {area.name}
                  {area.state && `, ${area.state}`}
                </span>
                {area.distance_miles && (
                  <span className="text-xs text-gray-400">
                    ({area.distance_miles} mi)
                  </span>
                )}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Additional info */}
        <p className="mt-8 text-center text-gray-600">
          Don&apos;t see your area listed?{' '}
          <a
            href="#contact"
            className="font-medium underline"
            style={{ color: brandColor }}
          >
            Contact us
          </a>{' '}
          - we may still be able to help!
        </p>
      </div>
    </section>
  );
}
