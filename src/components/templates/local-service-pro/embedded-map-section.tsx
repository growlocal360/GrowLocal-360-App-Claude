'use client';

import type { Location } from '@/types/database';

interface EmbeddedMapSectionProps {
  primaryLocation: Location | null;
  /** Override the map query entirely (e.g. "Sulphur, LA" for service area pages) */
  mapQuery?: string;
}

export function EmbeddedMapSection({ primaryLocation, mapQuery }: EmbeddedMapSectionProps) {
  if (!primaryLocation && !mapQuery) return null;

  let query: string;
  let title: string;

  if (mapQuery) {
    // Service area pages: show city-level map
    query = encodeURIComponent(mapQuery);
    title = mapQuery;
  } else if (primaryLocation?.gbp_place_id) {
    // GBP Place ID: guaranteed match to exact business listing (shows reviews, hours, etc.)
    query = `place_id:${primaryLocation.gbp_place_id}`;
    title = `${primaryLocation.city}, ${primaryLocation.state}`;
  } else {
    // Fallback: query by address
    query = encodeURIComponent(
      `${primaryLocation!.address_line1}, ${primaryLocation!.city}, ${primaryLocation!.state} ${primaryLocation!.zip_code}`
    );
    title = `${primaryLocation!.city}, ${primaryLocation!.state}`;
  }

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
