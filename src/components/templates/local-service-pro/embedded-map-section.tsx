'use client';

import type { Location } from '@/types/database';

interface EmbeddedMapSectionProps {
  primaryLocation: Location | null;
  /** Override the map query (e.g. "Sulphur, LA" for service area pages) */
  mapQuery?: string;
}

export function EmbeddedMapSection({ primaryLocation, mapQuery }: EmbeddedMapSectionProps) {
  if (!primaryLocation && !mapQuery) return null;

  const query = mapQuery
    ? encodeURIComponent(mapQuery)
    : encodeURIComponent(
        `${primaryLocation!.address_line1}, ${primaryLocation!.city}, ${primaryLocation!.state} ${primaryLocation!.zip_code}`
      );

  const title = mapQuery || `${primaryLocation!.city}, ${primaryLocation!.state}`;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-lg">
          <iframe
            title={`Map of ${title}`}
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${query}`}
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
