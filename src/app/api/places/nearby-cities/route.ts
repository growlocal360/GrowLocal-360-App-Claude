import { NextResponse } from 'next/server';

interface NearbyCity {
  id: string;
  name: string;
  state: string;
  placeId: string;
  population?: number;
  distanceMiles: number;
  latitude: number;
  longitude: number;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize city name for comparison - strips common prefixes/suffixes
function normalizeCity(name: string): string {
  let normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  // Remove common prefixes
  normalized = normalized.replace(/^(city of |town of |village of )/i, '');
  // Remove common suffixes
  normalized = normalized.replace(/( city| town| village| cdp| beach| springs| park| gardens| shores| heights| hills| point| key| island| isles)$/i, '');
  return normalized.trim();
}

// Check if two city names are essentially the same
function citiesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeCity(name1);
  const n2 = normalizeCity(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other (handles "Sarasota" vs "Sarasota Springs")
  if (n1.includes(n2) || n2.includes(n1)) {
    // Only match if the difference is small (avoid "North" matching "North Port")
    const lenDiff = Math.abs(n1.length - n2.length);
    if (lenDiff <= 3) return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locations, radiusMiles = 25, excludeCities = [] } = body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json(
        { error: 'At least one location with coordinates is required' },
        { status: 400 }
      );
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Store exclude cities for comparison (keep original for matching)
    const excludeCityList = excludeCities.map((c: string) => c.trim());

    // Find cities near each location
    const allCities: NearbyCity[] = [];
    const seenPlaceIds = new Set<string>();
    const seenCityNames = new Set<string>();

    for (const location of locations) {
      if (!location.latitude || !location.longitude) continue;

      const radiusMeters = Math.round(radiusMiles * 1609.34);

      // Search for multiple place types to get more comprehensive results
      // locality = cities, sublocality = neighborhoods/districts,
      // administrative_area_level_3 = townships/villages in some regions
      const placeTypes = ['locality', 'sublocality', 'neighborhood'];

      // Do multiple text searches to find more results
      const textSearchQueries = [
        `cities near ${location.city}, ${location.state}`,
        `towns near ${location.city}, ${location.state}`,
        `neighborhoods near ${location.city}, ${location.state}`,
        `communities near ${location.city}, ${location.state}`,
        // Search for specific types common in Florida
        `beach towns near ${location.city}, ${location.state}`,
        `${location.state} towns within ${radiusMiles} miles of ${location.city}`,
      ];

      // Nearby search for each place type
      for (const placeType of placeTypes) {
        try {
          const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radiusMeters}&type=${placeType}&key=${googleApiKey}`;

          const response = await fetch(searchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') continue;

          for (const place of data.results || []) {
            await processPlace(place, location, locations, excludeCityList, seenPlaceIds, seenCityNames, allCities, radiusMiles);
          }
        } catch (err) {
          console.error(`Error searching ${placeType}:`, err);
        }
      }

      // Text search for more results
      for (const query of textSearchQueries) {
        try {
          const encodedQuery = encodeURIComponent(query);
          const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&location=${location.latitude},${location.longitude}&radius=${radiusMeters}&key=${googleApiKey}`;

          const response = await fetch(textSearchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') continue;

          for (const place of data.results || []) {
            // Text search returns various types, filter to cities/towns
            const types = place.types || [];
            if (types.includes('locality') ||
                types.includes('sublocality') ||
                types.includes('neighborhood') ||
                types.includes('administrative_area_level_3')) {
              await processPlace(place, location, locations, excludeCityList, seenPlaceIds, seenCityNames, allCities, radiusMiles);
            }
          }
        } catch (err) {
          console.error(`Error with text search:`, err);
        }
      }

      // Additional targeted searches for common place types that might be missed
      // These are direct geocode searches for place patterns common in Florida
      const targetedSearches = [
        `${location.city} Key, ${location.state}`,
        `${location.city} Beach, ${location.state}`,
        `North ${location.city}, ${location.state}`,
        `South ${location.city}, ${location.state}`,
        `${location.city} Springs, ${location.state}`,
      ];

      for (const searchQuery of targetedSearches) {
        try {
          const encodedQuery = encodeURIComponent(searchQuery);
          const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${googleApiKey}`;

          const response = await fetch(searchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.status !== 'OK') continue;

          for (const place of (data.results || []).slice(0, 3)) {
            const types = place.types || [];
            if (types.includes('locality') ||
                types.includes('sublocality') ||
                types.includes('neighborhood') ||
                types.includes('administrative_area_level_3') ||
                types.includes('colloquial_area') ||
                types.includes('natural_feature')) {
              await processPlace(place, location, locations, excludeCityList, seenPlaceIds, seenCityNames, allCities, radiusMiles);
            }
          }
        } catch (err) {
          // Ignore errors
        }
      }
    }

    // Sort by distance and limit
    const sortedCities = allCities
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 100); // Increased limit

    return NextResponse.json({ cities: sortedCities });
  } catch (error) {
    console.error('Error fetching nearby cities:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch nearby cities' },
      { status: 500 }
    );
  }
}

async function processPlace(
  place: Record<string, unknown>,
  currentLocation: { latitude: number; longitude: number; city?: string },
  allLocations: { latitude?: number; longitude?: number }[],
  excludeCityList: string[],
  seenPlaceIds: Set<string>,
  seenCityNames: Set<string>,
  allCities: NearbyCity[],
  radiusMiles: number
) {
  const placeId = place.place_id as string;
  if (!placeId || seenPlaceIds.has(placeId)) return;

  const cityName = place.name as string;
  if (!cityName) return;

  const normalizedName = normalizeCity(cityName);

  // Skip if we've seen this city name (after normalization)
  if (seenCityNames.has(normalizedName)) return;

  // Skip if this city matches any excluded city (GBP locations)
  for (const excludeCity of excludeCityList) {
    if (citiesMatch(cityName, excludeCity)) {
      console.log(`Excluding ${cityName} - matches GBP location ${excludeCity}`);
      return;
    }
  }

  const geometry = place.geometry as { location?: { lat: number; lng: number } } | undefined;
  const placeLat = geometry?.location?.lat;
  const placeLng = geometry?.location?.lng;

  if (!placeLat || !placeLng) return;

  // Find the closest GBP location to this city
  let minDistance = Infinity;
  for (const loc of allLocations) {
    if (loc.latitude && loc.longitude) {
      const dist = calculateDistance(
        loc.latitude,
        loc.longitude,
        placeLat,
        placeLng
      );
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
  }

  // Skip if too close (same city) or too far
  if (minDistance < 1) return;
  if (minDistance > radiusMiles) return;

  // Extract state from formatted_address or vicinity
  let state = '';
  const formattedAddress = place.formatted_address as string | undefined;
  const vicinity = place.vicinity as string | undefined;

  if (formattedAddress) {
    // Try to extract state from formatted address like "City, FL, USA"
    const match = formattedAddress.match(/,\s*([A-Z]{2})\s*(?:\d{5})?(?:,|$)/);
    if (match) {
      state = match[1];
    }
  } else if (vicinity) {
    const parts = vicinity.split(', ');
    if (parts.length > 1) {
      state = parts[parts.length - 1];
    }
  }

  seenPlaceIds.add(placeId);
  seenCityNames.add(normalizedName);

  allCities.push({
    id: placeId,
    name: cityName,
    state: state,
    placeId: placeId,
    distanceMiles: Math.round(minDistance * 10) / 10,
    latitude: placeLat,
    longitude: placeLng,
  });
}
