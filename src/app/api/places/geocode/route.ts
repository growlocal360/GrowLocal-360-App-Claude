import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, city, state } = body;

    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    // Build the address query
    const query = address
      ? `${address}, ${city}, ${state}`
      : `${city}, ${state}`;

    const encodedQuery = encodeURIComponent(query);
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${googleApiKey}`;

    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error('Geocoding API error');
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json(
        { error: 'Could not geocode address', status: data.status },
        { status: 404 }
      );
    }

    const location = data.results[0].geometry.location;

    return NextResponse.json({
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address,
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Geocoding failed' },
      { status: 500 }
    );
  }
}
