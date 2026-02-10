'use client';

import Link from 'next/link';
import { Wrench, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Service, Location } from '@/types/database';
import * as paths from '@/lib/routing/paths';

interface ServicesPreviewProps {
  site: Site;
  services: Service[];
  primaryLocation: Location | null;
  siteSlug: string;
  categorySlug?: string;
  isPrimaryCategory?: boolean;
  locationSlug?: string;
}

export function ServicesPreview({ site, services, primaryLocation, categorySlug, isPrimaryCategory, locationSlug }: ServicesPreviewProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';

  const getServiceUrl = (service: Service) => {
    return paths.servicePage(service.slug, categorySlug, isPrimaryCategory, locationSlug);
  };

  if (services.length === 0) return null;

  return (
    <section id="services" className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Our Services{city ? ` in ${city}` : ''}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            We offer a comprehensive range of services to meet all your needs.
          </p>
        </div>

        {/* Services grid — 3 columns */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 9).map((service) => (
            <Link key={service.id} href={getServiceUrl(service)}>
              <Card className="h-full cursor-pointer transition-all hover:border-gray-300 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${brandColor}20` }}
                    >
                      <Wrench className="h-6 w-6" style={{ color: brandColor }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      {service.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                          {service.description}
                        </p>
                      )}
                      <div
                        className="mt-3 flex items-center gap-1 text-sm font-medium"
                        style={{ color: brandColor }}
                      >
                        Learn More
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
