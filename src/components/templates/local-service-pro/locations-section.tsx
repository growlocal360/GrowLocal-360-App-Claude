'use client';

import { MapPin, Phone, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';

interface LocationsSectionProps {
  site: Site;
  locations: Location[];
}

export function LocationsSection({ site, locations }: LocationsSectionProps) {
  const brandColor = site.settings?.brand_color || '#10b981';

  const getDirectionsUrl = (location: Location) => {
    const address = encodeURIComponent(
      `${location.address_line1}, ${location.city}, ${location.state} ${location.zip_code}`
    );
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  return (
    <section id="locations" className="bg-gray-50 py-20">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Our Locations
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Multiple locations to serve you better
          </p>
        </div>

        {/* Locations grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card key={location.id} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {location.name}
                  </h3>
                  {location.is_primary && (
                    <Badge
                      style={{ backgroundColor: brandColor }}
                      className="text-white"
                    >
                      Main
                    </Badge>
                  )}
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <p>{location.address_line1}</p>
                      {location.address_line2 && <p>{location.address_line2}</p>}
                      <p>
                        {location.city}, {location.state} {location.zip_code}
                      </p>
                    </div>
                  </div>

                  {location.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <a
                        href={`tel:${location.phone.replace(/\D/g, '')}`}
                        className="hover:underline"
                        style={{ color: brandColor }}
                      >
                        {location.phone}
                      </a>
                    </div>
                  )}
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="mt-4 w-full"
                >
                  <a
                    href={getDirectionsUrl(location)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
