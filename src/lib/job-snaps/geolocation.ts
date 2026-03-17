/**
 * Browser geolocation and reverse geocoding utilities for job snaps.
 */

export interface DevicePosition {
  lat: number;
  lng: number;
}

export interface ReverseGeocodedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Requests the device's current position via the Geolocation API.
 * Returns a promise that resolves with lat/lng or rejects with a user-friendly error message.
 */
export function getDevicePosition(): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please enter address manually.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location unavailable. Please enter address manually.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            break;
          default:
            reject(new Error('Failed to get location. Please enter address manually.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Reverse geocodes lat/lng to a structured address using the Google Maps Geocoding API.
 * Falls back to a coordinate-based placeholder if the API is unavailable or fails.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodedAddress> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  if (!apiKey) {
    return {
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      city: '',
      state: '',
      zip: '',
    };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return {
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city: '',
        state: '',
        zip: '',
      };
    }

    // Parse the first result's address components
    const result = data.results[0];
    const components = result.address_components as {
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

    const address = [streetNumber, route].filter(Boolean).join(' ') || result.formatted_address || '';

    return { address, city, state, zip };
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return {
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      city: '',
      state: '',
      zip: '',
    };
  }
}
