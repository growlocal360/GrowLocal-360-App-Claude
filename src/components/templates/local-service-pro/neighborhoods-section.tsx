'use client';

import Link from 'next/link';
import { Home, MapPin, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Location, Neighborhood } from '@/types/database';

interface NeighborhoodsSectionProps {
  site: Site;
  neighborhoods: Neighborhood[];
  locations: Location[];
}

export function NeighborhoodsSection({ site, neighborhoods, locations }: NeighborhoodsSectionProps) {
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';

  // Group neighborhoods by location
  const neighborhoodsByLocation: Record<string, Neighborhood[]> = {};
  neighborhoods.forEach((n) => {
    if (!neighborhoodsByLocation[n.location_id]) {
      neighborhoodsByLocation[n.location_id] = [];
    }
    neighborhoodsByLocation[n.location_id].push(n);
  });

  // Get location details
  const getLocation = (locationId: string) => {
    return locations.find((l) => l.id === locationId);
  };

  // For single location sites, show a simpler layout
  const isSingleLocation = locations.length === 1;

  return (
    <section id="neighborhoods" className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Neighborhoods We Serve
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Hyper-local {industry.toLowerCase()} expertise in your neighborhood
          </p>
        </div>

        {isSingleLocation ? (
          // Single location: simple grid of neighborhoods
          <div className="flex flex-wrap justify-center gap-3">
            {neighborhoods.map((neighborhood) => {
              const location = getLocation(neighborhood.location_id);
              if (!location) return null;

              return (
                <Link
                  key={neighborhood.id}
                  href={`/sites/${site.slug}/locations/${location.slug}/neighborhoods/${neighborhood.slug}`}
                >
                  <Badge
                    variant="outline"
                    className="flex cursor-pointer items-center gap-2 px-4 py-2 text-base transition-colors hover:bg-gray-100"
                  >
                    <Home className="h-4 w-4" style={{ color: brandColor }} />
                    {neighborhood.name}
                  </Badge>
                </Link>
              );
            })}
          </div>
        ) : (
          // Multi-location: grouped by location with cards
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(neighborhoodsByLocation).map(([locationId, locNeighborhoods]) => {
              const location = getLocation(locationId);
              if (!location) return null;

              return (
                <Card key={locationId}>
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5" style={{ color: brandColor }} />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {location.city}, {location.state}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {locNeighborhoods.map((neighborhood) => (
                        <Link
                          key={neighborhood.id}
                          href={`/sites/${site.slug}/locations/${location.slug}/neighborhoods/${neighborhood.slug}`}
                        >
                          <Badge
                            variant="outline"
                            className="cursor-pointer transition-colors hover:bg-gray-100"
                          >
                            {neighborhood.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>

                    <Link
                      href={`/sites/${site.slug}/locations/${location.slug}`}
                      className="mt-4 inline-flex items-center text-sm font-medium"
                      style={{ color: brandColor }}
                    >
                      View {location.city} services
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* SEO text */}
        <p className="mt-8 text-center text-gray-600">
          Looking for {industry.toLowerCase()} in a specific neighborhood?{' '}
          <a
            href="#contact"
            className="font-medium underline"
            style={{ color: brandColor }}
          >
            Contact us
          </a>{' '}
          to learn more about our services in your area.
        </p>
      </div>
    </section>
  );
}
