import { NextResponse } from 'next/server';

interface NeighborhoodSuggestion {
  id: string;
  name: string;
  placeId: string;
  latitude: number;
  longitude: number;
  locationId: string; // Which GBP location this belongs to
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locations } = body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json(
        { error: 'At least one location is required' },
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

    const allNeighborhoods: NeighborhoodSuggestion[] = [];
    const seenPlaceIds = new Set<string>();

    for (const location of locations) {
      if (!location.latitude || !location.longitude || !location.city) continue;

      const locationId = location.id || `loc-${location.city}`;
      const { city, state, latitude, longitude } = location;

      // Search strategies for finding neighborhoods within a city
      const searchQueries = [
        `neighborhoods in ${city}, ${state}`,
        `${city} neighborhoods ${state}`,
        `areas in ${city}, ${state}`,
        `districts in ${city}, ${state}`,
        `${city} subdivisions ${state}`,
        // Common neighborhood patterns
        `historic district ${city}, ${state}`,
        `downtown ${city}, ${state}`,
        `old town ${city}, ${state}`,
      ];

      // Also do a nearby search for neighborhoods/sublocalities
      const radiusMeters = 16093; // ~10 miles - neighborhoods should be close

      // Nearby search for sublocalities and neighborhoods
      try {
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusMeters}&type=sublocality&key=${googleApiKey}`;

        const response = await fetch(nearbyUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'OK' && data.results) {
            for (const place of data.results) {
              const types = place.types || [];
              // Exclude if it's a locality (town/city) - we only want neighborhoods
              if (!types.includes('locality')) {
                processNeighborhood(place, locationId, city, seenPlaceIds, allNeighborhoods);
              }
            }
          }
        }
      } catch (err) {
        console.error('Nearby search error:', err);
      }

      // Text searches for more results
      for (const query of searchQueries) {
        try {
          const encodedQuery = encodeURIComponent(query);
          const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&location=${latitude},${longitude}&radius=${radiusMeters}&key=${googleApiKey}`;

          const response = await fetch(textSearchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.status !== 'OK') continue;

          for (const place of data.results || []) {
            const types = place.types || [];
            // Filter to ONLY neighborhood-like results
            // IMPORTANT: Do NOT include 'locality' - those are towns/cities (like Westlake), not neighborhoods
            // Neighborhoods are: neighborhood, sublocality, sublocality_level_1, colloquial_area
            if (
              types.includes('neighborhood') ||
              types.includes('sublocality') ||
              types.includes('sublocality_level_1') ||
              types.includes('colloquial_area')
            ) {
              // Additional check: exclude if it's also marked as a locality (town/city)
              if (!types.includes('locality')) {
                processNeighborhood(place, locationId, city, seenPlaceIds, allNeighborhoods);
              }
            }
          }
        } catch (err) {
          console.error('Text search error:', err);
        }
      }

      // Autocomplete search for neighborhoods (often finds more specific results)
      try {
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(city + ' ')}&types=(regions)&location=${latitude},${longitude}&radius=${radiusMeters}&strictbounds=true&key=${googleApiKey}`;

        const response = await fetch(autocompleteUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'OK' && data.predictions) {
            for (const prediction of data.predictions.slice(0, 10)) {
              // Get place details for each prediction
              const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=name,geometry,types,place_id&key=${googleApiKey}`;

              try {
                const detailsResponse = await fetch(detailsUrl);
                if (detailsResponse.ok) {
                  const detailsData = await detailsResponse.json();
                  if (detailsData.status === 'OK' && detailsData.result) {
                    const place = detailsData.result;
                    const types = place.types || [];
                    if (
                      types.includes('neighborhood') ||
                      types.includes('sublocality') ||
                      types.includes('sublocality_level_1')
                    ) {
                      processNeighborhoodFromDetails(place, locationId, city, seenPlaceIds, allNeighborhoods);
                    }
                  }
                }
              } catch {
                // Ignore individual detail failures
              }
            }
          }
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }

    // Sort alphabetically and dedupe by name similarity
    const sortedNeighborhoods = allNeighborhoods
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ neighborhoods: sortedNeighborhoods });
  } catch (error) {
    console.error('Error fetching neighborhoods:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch neighborhoods' },
      { status: 500 }
    );
  }
}

function isSameAsCity(name: string, city: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  return normalize(name) === normalize(city);
}

function processNeighborhood(
  place: Record<string, unknown>,
  locationId: string,
  parentCity: string,
  seenPlaceIds: Set<string>,
  allNeighborhoods: NeighborhoodSuggestion[]
) {
  const placeId = place.place_id as string;
  if (!placeId || seenPlaceIds.has(placeId)) return;

  const name = place.name as string;
  if (!name || isSameAsCity(name, parentCity)) return;

  const geometry = place.geometry as { location?: { lat: number; lng: number } } | undefined;
  const lat = geometry?.location?.lat;
  const lng = geometry?.location?.lng;

  if (!lat || !lng) return;

  seenPlaceIds.add(placeId);

  allNeighborhoods.push({
    id: placeId,
    name: name,
    placeId: placeId,
    latitude: lat,
    longitude: lng,
    locationId: locationId,
  });
}

function processNeighborhoodFromDetails(
  place: Record<string, unknown>,
  locationId: string,
  parentCity: string,
  seenPlaceIds: Set<string>,
  allNeighborhoods: NeighborhoodSuggestion[]
) {
  const placeId = place.place_id as string;
  if (!placeId || seenPlaceIds.has(placeId)) return;

  const name = place.name as string;
  if (!name || isSameAsCity(name, parentCity)) return;

  const geometry = place.geometry as { location?: { lat: number; lng: number } } | undefined;
  const lat = geometry?.location?.lat;
  const lng = geometry?.location?.lng;

  if (!lat || !lng) return;

  seenPlaceIds.add(placeId);

  allNeighborhoods.push({
    id: placeId,
    name: name,
    placeId: placeId,
    latitude: lat,
    longitude: lng,
    locationId: locationId,
  });
}
