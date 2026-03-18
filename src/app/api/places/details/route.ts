import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json(
      { error: 'placeId is required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key not configured' },
      { status: 500 }
    );
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,geometry,formatted_address&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      throw new Error(`Google API status: ${data.status}`);
    }

    const result = data.result;
    const components = (result.address_components || []) as {
      long_name: string;
      short_name: string;
      types: string[];
    }[];

    const get = (type: string) =>
      components.find((c) => c.types.includes(type));

    const streetNumber = get('street_number')?.long_name || '';
    const route = get('route')?.long_name || '';
    const city =
      get('locality')?.long_name ||
      get('sublocality')?.long_name ||
      get('administrative_area_level_2')?.long_name ||
      '';
    const state = get('administrative_area_level_1')?.long_name || '';
    const zip = get('postal_code')?.long_name || '';

    const address =
      [streetNumber, route].filter(Boolean).join(' ') ||
      result.formatted_address ||
      '';

    const lat = result.geometry?.location?.lat ?? null;
    const lng = result.geometry?.location?.lng ?? null;

    return NextResponse.json({ address, city, state, zip, lat, lng });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}
