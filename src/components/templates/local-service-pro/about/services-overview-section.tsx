'use client';

import Link from 'next/link';
import type { PublicRenderServiceListing } from '@/lib/sites/public-render-model';
import type { NavCategory } from '../site-header';
import * as paths from '@/lib/routing/paths';
import { normalizeCategorySlug } from '@/lib/utils/slugify';

interface ServicesOverviewSectionProps {
  services: PublicRenderServiceListing[];
  categories: NavCategory[];
  brandColor: string;
  siteSlug: string;
  locationSlug?: string;
}

export function ServicesOverviewSection({
  services,
  categories,
  brandColor,
  locationSlug,
}: ServicesOverviewSectionProps) {
  if (services.length === 0) return null;

  // Group services by category
  const primaryCategory = categories.find((c) => c.isPrimary);
  const displayServices = services.slice(0, 12);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-4 text-3xl font-bold text-gray-900">What We Specialize In</h2>
        <p className="mb-8 text-lg text-gray-600">
          Explore our range of services designed to meet your needs.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayServices.map((service) => {
            const categorySlug = primaryCategory
              ? normalizeCategorySlug(primaryCategory.name)
              : '';
            const href = paths.servicePage(
              categorySlug,
              service.slug,
              !!primaryCategory?.isPrimary,
              locationSlug
            );

            return (
              <Link
                key={service.id}
                href={href}
                className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900 group-hover:underline">
                  {service.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
