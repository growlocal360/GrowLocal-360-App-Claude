// Google Business Profile API Client
// Documentation: https://developers.google.com/my-business/reference/rest

export interface GBPAccount {
  name: string; // Format: accounts/{accountId}
  accountName: string;
  type: 'PERSONAL' | 'LOCATION_GROUP' | 'USER_GROUP' | 'ORGANIZATION';
  role: 'OWNER' | 'CO_OWNER' | 'MANAGER' | 'COMMUNITY_MANAGER';
  state: {
    status: 'UNVERIFIED' | 'VERIFIED' | 'VETTED_PARTNER';
  };
  accountNumber?: string;
}

export interface GBPLocation {
  name: string; // Format: locations/{locationId}
  title: string;
  storeCode?: string;
  storefrontAddress?: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
    regionCode: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  categories?: {
    primaryCategory?: {
      name: string;
      displayName: string;
    };
    additionalCategories?: {
      name: string;
      displayName: string;
    }[];
  };
  websiteUri?: string;
  regularHours?: {
    periods: {
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }[];
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
  };
  latlng?: {
    latitude: number;
    longitude: number;
  };
}

export interface GBPAccountsResponse {
  accounts: GBPAccount[];
  nextPageToken?: string;
}

export interface GBPLocationsResponse {
  locations: GBPLocation[];
  nextPageToken?: string;
}

export class GBPClient {
  private accessToken: string;
  private baseUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1';
  private businessInfoUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `GBP API error: ${response.status}`
      );
    }

    return response.json();
  }

  // Get all accounts the user has access to
  async getAccounts(): Promise<GBPAccount[]> {
    const response = await this.fetch<GBPAccountsResponse>(
      `${this.baseUrl}/accounts`
    );
    return response.accounts || [];
  }

  // Get locations for a specific account
  async getLocations(accountId: string): Promise<GBPLocation[]> {
    // Extract just the account ID if full path is provided
    const id = accountId.replace('accounts/', '');

    const response = await this.fetch<GBPLocationsResponse>(
      `${this.businessInfoUrl}/accounts/${id}/locations?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,metadata,latlng`
    );
    return response.locations || [];
  }

  // Get a single location's details
  async getLocation(locationName: string): Promise<GBPLocation> {
    return this.fetch<GBPLocation>(
      `${this.businessInfoUrl}/${locationName}?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,metadata,latlng`
    );
  }

  // Get all locations across all accounts
  async getAllLocations(): Promise<{ account: GBPAccount; locations: GBPLocation[] }[]> {
    const accounts = await this.getAccounts();
    const results: { account: GBPAccount; locations: GBPLocation[] }[] = [];

    for (const account of accounts) {
      try {
        const locations = await this.getLocations(account.name);
        results.push({ account, locations });
      } catch (error) {
        // Some accounts may not have location access
        console.error(`Error fetching locations for ${account.name}:`, error);
      }
    }

    return results;
  }
}

// Helper to convert GBP location to our app's format
export function gbpLocationToAppLocation(gbpLocation: GBPLocation) {
  const address = gbpLocation.storefrontAddress;

  return {
    name: gbpLocation.title,
    address: address?.addressLines?.join(', ') || '',
    city: address?.locality || '',
    state: address?.administrativeArea || '',
    zipCode: address?.postalCode || '',
    phone: gbpLocation.phoneNumbers?.primaryPhone || '',
    isPrimary: false,
    gbpPlaceId: gbpLocation.metadata?.placeId,
    gbpLocationId: gbpLocation.name,
    latitude: gbpLocation.latlng?.latitude,
    longitude: gbpLocation.latlng?.longitude,
    primaryCategory: gbpLocation.categories?.primaryCategory,
    additionalCategories: gbpLocation.categories?.additionalCategories || [],
  };
}
