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

// Service area place info from GBP
export interface GBPServiceAreaPlace {
  placeName?: string;
  placeId?: string;
}

// Service area configuration from GBP
// Actual structure from Google: serviceArea.places.placeInfos[].placeName / .placeId
export interface GBPServiceArea {
  businessType?: 'CUSTOMER_LOCATION_ONLY' | 'CUSTOMER_AND_BUSINESS_LOCATION';
  places?: {
    placeInfos?: GBPServiceAreaPlace[];
  };
  regionCode?: string;
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
  // Service area data - cities/regions the business serves
  serviceArea?: GBPServiceArea;
}

export interface GBPReview {
  name: string; // Format: accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
  reviewId: string;
  reviewer: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GBPReviewsResponse {
  reviews?: GBPReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
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
  private reviewsUrl = 'https://mybusiness.googleapis.com/v4';

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

  // Get locations for a specific account (with pagination)
  async getLocations(accountId: string, pageToken?: string): Promise<GBPLocationsResponse> {
    // Extract just the account ID if full path is provided
    const id = accountId.replace('accounts/', '');

    // Include serviceArea in readMask to get the service areas defined in GBP
    let url = `${this.businessInfoUrl}/accounts/${id}/locations?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,metadata,latlng,serviceArea&pageSize=100`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await this.fetch<GBPLocationsResponse>(url);
    return response;
  }

  // Get ALL locations for a specific account (handles pagination automatically)
  async getAllLocationsForAccount(accountId: string): Promise<GBPLocation[]> {
    const allLocations: GBPLocation[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getLocations(accountId, pageToken);
      allLocations.push(...(response.locations || []));
      pageToken = response.nextPageToken;
    } while (pageToken);

    return allLocations;
  }

  // Get a single location's details
  async getLocation(locationName: string): Promise<GBPLocation> {
    return this.fetch<GBPLocation>(
      `${this.businessInfoUrl}/${locationName}?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,metadata,latlng`
    );
  }

  // Get reviews for a specific location
  async getReviews(
    accountName: string,
    locationName: string,
    pageSize = 50
  ): Promise<GBPReviewsResponse> {
    // accountName: "accounts/123", locationName: "locations/456"
    const url = `${this.reviewsUrl}/${accountName}/${locationName}/reviews?pageSize=${pageSize}&orderBy=updateTime desc`;
    return this.fetch<GBPReviewsResponse>(url);
  }

  // Get all locations across all accounts (fetches all pages)
  async getAllLocations(): Promise<{ account: GBPAccount; locations: GBPLocation[] }[]> {
    const accounts = await this.getAccounts();
    const results: { account: GBPAccount; locations: GBPLocation[] }[] = [];

    for (const account of accounts) {
      try {
        const locations = await this.getAllLocationsForAccount(account.name);
        results.push({ account, locations });
      } catch (error) {
        // Some accounts may not have location access
        console.error(`Error fetching locations for ${account.name}:`, error);
      }
    }

    return results;
  }
}

// Convert GBP star rating enum to numeric value
export function starRatingToNumber(rating: string): number {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[rating] || 5;
}

// Helper to convert GBP location to our app's format
export function gbpLocationToAppLocation(gbpLocation: GBPLocation) {
  const address = gbpLocation.storefrontAddress;

  // Extract service areas from GBP data
  // Structure from Google: serviceArea.places.placeInfos[].placeName / .placeId
  let serviceAreas: Array<{ name: string; placeId: string }> = [];

  const sa = gbpLocation.serviceArea;
  if (sa?.places?.placeInfos) {
    // The actual structure: places.placeInfos[] where each has placeName and placeId directly
    serviceAreas = (sa.places.placeInfos as Array<{ placeName?: string; placeId?: string }>).map((place) => ({
      name: place.placeName || '',
      placeId: place.placeId || '',
    })).filter((area) => area.name);
  }

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
    // Service areas from GBP
    serviceAreas,
  };
}
