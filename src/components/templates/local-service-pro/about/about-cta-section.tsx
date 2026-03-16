'use client';

import Link from 'next/link';
import type { AboutPageSections } from '@/types/database';
import * as paths from '@/lib/routing/paths';

interface AboutCTASectionProps {
  sections: AboutPageSections | null;
  brandColor: string;
  phone?: string | null;
  siteSlug: string;
  locationSlug?: string;
}

export function AboutCTASection({ sections, brandColor, phone, locationSlug }: AboutCTASectionProps) {
  const cta = sections?.cta;
  if (!cta) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="mb-4 text-3xl font-bold text-gray-900">{cta.heading}</h2>
        <p className="mb-8 text-lg text-gray-600">{cta.description}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href={paths.contactPage(locationSlug)}
            className="inline-flex items-center gap-2 rounded-lg px-8 py-3 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            Contact Us
          </Link>
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg border-2 px-8 py-3 text-lg font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: brandColor, color: brandColor }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
