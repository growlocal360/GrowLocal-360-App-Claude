'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderBrandListing } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface BrandsSectionProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  brands: PublicRenderBrandListing[];
  siteSlug: string;
  locationSlug?: string;
}

export function BrandsSection({ site, primaryLocation, brands, siteSlug, locationSlug }: BrandsSectionProps) {
  if (brands.length === 0) return null;

  const brandColor = site.settings?.brand_color || '#00ef99';
  const accentColor = site.settings?.secondary_color || brandColor;
  const city = primaryLocation?.city || '';
  const primaryCategory = site.settings?.core_industry || '';

  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          {primaryCategory ? `${primaryCategory} Brands` : 'Brands'} We Service
          {city ? ` in ${city}` : ''}
        </h2>
        <p className="mt-2 text-gray-600">
          We service and repair all major brands. Select a brand to learn more about our services.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {brands.map((brand) => (
            <Link key={brand.id} href={paths.brandPage(brand.slug, locationSlug)}>
              <Card
                className="group h-full cursor-pointer rounded-2xl border-gray-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CardContent className="flex items-center justify-between p-5">
                  <span className="font-bold text-gray-900">{brand.name}</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1" style={{ color: accentColor }} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href={paths.brandsIndex(locationSlug)}
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: accentColor }}
          >
            View All Brands
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
