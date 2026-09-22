'use client';

/**
 * Google Maps embed for a city (Maps Embed API "place" mode draws the city
 * boundary for a locality query). Rendered under the lead form on city and
 * service-area pages. Free/unlimited on the Embed API; needs
 * NEXT_PUBLIC_GOOGLE_MAPS_KEY.
 */
export function PremiumCityMap({ city, state }: { city: string; state?: string | null }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key || !city) return null;
  const label = state ? `${city}, ${state}` : city;
  return (
    <div className="pm-asidemap">
      <iframe
        title={`Map of ${label}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(label)}`}
        allowFullScreen
      />
      <div className="pm-asidemap-cap">Serving {label}</div>
    </div>
  );
}
