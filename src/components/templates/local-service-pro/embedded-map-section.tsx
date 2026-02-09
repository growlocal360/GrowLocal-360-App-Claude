'use client';

import type { Location } from '@/types/database';

interface EmbeddedMapSectionProps {
  primaryLocation: Location | null;
}

export function EmbeddedMapSection({ primaryLocation }: EmbeddedMapSectionProps) {
  if (!primaryLocation) return null;

  const address = encodeURIComponent(
    `${primaryLocation.address_line1}, ${primaryLocation.city}, ${primaryLocation.state} ${primaryLocation.zip_code}`
  );

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-lg">
          <iframe
            title={`Map of ${primaryLocation.city}, ${primaryLocation.state}`}
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${address}`}
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
