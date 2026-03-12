// Google Search Console API Client
// Documentation: https://developers.google.com/webmaster-tools/v1/api_reference_index

export interface GSCSite {
  siteUrl: string;
  permissionLevel:
    | 'siteOwner'
    | 'siteFullUser'
    | 'siteRestrictedUser'
    | 'siteUnverifiedUser';
}

export interface GSCSearchAnalyticsRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: ('query' | 'page' | 'country' | 'device')[];
  rowLimit?: number; // max 25000, default 1000
  startRow?: number;
  dimensionFilterGroups?: {
    filters: {
      dimension: string;
      operator: 'equals' | 'contains' | 'notContains';
      expression: string;
    }[];
  }[];
}

export interface GSCSearchAnalyticsRow {
  keys: string[]; // values for each dimension in order
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCSitesResponse {
  siteEntry?: GSCSite[];
}

interface GSCSearchAnalyticsResponse {
  rows?: GSCSearchAnalyticsRow[];
  responseAggregationType?: string;
}

export class GSCClient {
  private accessToken: string;
  private baseUrl = 'https://searchconsole.googleapis.com/webmasters/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetchGet<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `GSC API error: ${response.status}`
      );
    }

    return response.json();
  }

  private async fetchPost<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `GSC API error: ${response.status}`
      );
    }

    return response.json();
  }

  // List all Search Console properties the user has access to
  async listSites(): Promise<GSCSite[]> {
    const response = await this.fetchGet<GSCSitesResponse>(
      `${this.baseUrl}/sites`
    );
    return response.siteEntry || [];
  }

  // Query search analytics data for a specific property
  async querySearchAnalytics(
    siteUrl: string,
    request: GSCSearchAnalyticsRequest
  ): Promise<GSCSearchAnalyticsRow[]> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const response = await this.fetchPost<GSCSearchAnalyticsResponse>(
      `${this.baseUrl}/sites/${encodedSiteUrl}/searchAnalytics/query`,
      request
    );
    return response.rows || [];
  }
}
