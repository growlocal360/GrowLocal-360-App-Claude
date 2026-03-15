'use client';

import type { AboutPageSections } from '@/types/database';
import type { PublicRenderAreaListing } from '@/lib/sites/public-render-model';

interface LocalConnectionSectionProps {
  sections: AboutPageSections | null;
  serviceAreas: PublicRenderAreaListing[];
  brandColor: string;
}

export function LocalConnectionSection({ sections, serviceAreas, brandColor }: LocalConnectionSectionProps) {
  const localConnection = sections?.local_connection;
  if (!localConnection) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-6 text-3xl font-bold text-gray-900">{localConnection.heading}</h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              {localConnection.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          {serviceAreas.length > 0 && (
            <div className="flex flex-col justify-center">
              <div
                className="rounded-xl p-6 text-white"
                style={{ backgroundColor: brandColor }}
              >
                <p className="text-4xl font-bold">{serviceAreas.length}+</p>
                <p className="mt-1 text-lg font-medium text-white/90">Communities Served</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
