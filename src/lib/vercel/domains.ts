/**
 * Vercel Domain Management API Client
 *
 * This module provides functions to manage domains via Vercel's API.
 * Used for adding custom domains to sites and verifying DNS configuration.
 *
 * Required environment variables:
 * - VERCEL_API_TOKEN: Personal access token from Vercel dashboard
 * - VERCEL_PROJECT_ID: Project ID from Vercel project settings
 * - VERCEL_TEAM_ID: (Optional) Team ID if using team account
 */

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelDomainConfig {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: {
    type: string;
    domain: string;
    value: string;
    reason: string;
  }[];
  configured?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

interface VercelDomainResponse {
  success: boolean;
  domain?: VercelDomainConfig;
  error?: string;
}

interface VercelDNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
}

interface DNSInstructions {
  configured: boolean;
  records: VercelDNSRecord[];
  verification?: {
    type: string;
    domain: string;
    value: string;
  };
}

function getVercelHeaders(): HeadersInit {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error('VERCEL_API_TOKEN is not configured');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function getProjectId(): string {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    throw new Error('VERCEL_PROJECT_ID is not configured');
  }
  return projectId;
}

function getTeamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

/**
 * Add a domain to the Vercel project
 */
export async function addDomainToVercel(domain: string): Promise<VercelDomainResponse> {
  try {
    const projectId = getProjectId();
    const teamParam = getTeamParam();

    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${projectId}/domains${teamParam}`,
      {
        method: 'POST',
        headers: getVercelHeaders(),
        body: JSON.stringify({ name: domain }),
      }
    );

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        error: 'Vercel API authentication failed. Check that VERCEL_API_TOKEN is valid.',
      };
    }

    if (!response.ok) {
      // Handle specific error cases
      if (data.error?.code === 'domain_already_in_use') {
        return {
          success: false,
          error: 'This domain is already in use by another project',
        };
      }
      if (data.error?.code === 'invalid_domain') {
        return {
          success: false,
          error: 'Invalid domain format',
        };
      }
      return {
        success: false,
        error: data.error?.message || 'Failed to add domain',
      };
    }

    return {
      success: true,
      domain: data,
    };
  } catch (error) {
    console.error('Error adding domain to Vercel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add domain',
    };
  }
}

/**
 * Remove a domain from the Vercel project
 */
export async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const projectId = getProjectId();
    const teamParam = getTeamParam();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${teamParam}`,
      {
        method: 'DELETE',
        headers: getVercelHeaders(),
      }
    );

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        error: 'Vercel API authentication failed. Check that VERCEL_API_TOKEN is valid.',
      };
    }

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error?.message || 'Failed to remove domain',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing domain from Vercel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove domain',
    };
  }
}

/**
 * Get domain configuration from Vercel
 */
export async function getDomainConfig(domain: string): Promise<VercelDomainResponse> {
  try {
    const projectId = getProjectId();
    const teamParam = getTeamParam();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${teamParam}`,
      {
        method: 'GET',
        headers: getVercelHeaders(),
      }
    );

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        error: 'Vercel API authentication failed. Check that VERCEL_API_TOKEN is valid.',
      };
    }

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error?.message || 'Domain not found',
      };
    }

    const data = await response.json();
    return {
      success: true,
      domain: data,
    };
  } catch (error) {
    console.error('Error getting domain config from Vercel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get domain config',
    };
  }
}

/**
 * Verify domain DNS configuration
 * Returns true if DNS is properly configured
 */
export async function verifyDomainDNS(domain: string): Promise<{
  verified: boolean;
  configured: boolean;
  error?: string;
}> {
  try {
    const projectId = getProjectId();
    const teamParam = getTeamParam();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}/verify${teamParam}`,
      {
        method: 'POST',
        headers: getVercelHeaders(),
      }
    );

    if (response.status === 401 || response.status === 403) {
      return {
        verified: false,
        configured: false,
        error: 'Vercel API authentication failed. Check that VERCEL_API_TOKEN is valid.',
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        verified: false,
        configured: false,
        error: data.error?.message || 'Verification failed',
      };
    }

    return {
      verified: data.verified ?? false,
      configured: data.configured ?? false,
    };
  } catch (error) {
    console.error('Error verifying domain DNS:', error);
    return {
      verified: false,
      configured: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Extract the apex (root) domain from any domain input.
 * e.g., "www.example.com" → "example.com", "example.com" → "example.com"
 */
export function getApexDomain(domain: string): string {
  const parts = domain.split('.');
  // For standard domains like "www.example.com" or "example.com"
  if (parts.length > 2 && parts[0] === 'www') {
    return parts.slice(1).join('.');
  }
  return domain;
}

/**
 * Add both root and www domains to the Vercel project.
 * The primary domain is whichever the user entered; the other redirects to it.
 */
export async function addDomainPairToVercel(primaryDomain: string): Promise<VercelDomainResponse> {
  const apex = getApexDomain(primaryDomain);
  const www = `www.${apex}`;
  const isWwwPrimary = primaryDomain.startsWith('www.');
  const secondaryDomain = isWwwPrimary ? apex : www;

  // Add primary domain first
  const primaryResult = await addDomainToVercel(primaryDomain);
  if (!primaryResult.success) return primaryResult;

  // Add secondary with redirect to primary
  const secondaryResult = await addDomainToVercelWithRedirect(secondaryDomain, primaryDomain);
  if (!secondaryResult.success) {
    console.warn(`Failed to add redirect domain (${secondaryDomain}):`, secondaryResult.error);
  }

  return primaryResult;
}

/**
 * Add a domain to Vercel with a redirect to another domain.
 */
async function addDomainToVercelWithRedirect(domain: string, redirectTo: string): Promise<VercelDomainResponse> {
  try {
    const projectId = getProjectId();
    const teamParam = getTeamParam();

    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${projectId}/domains${teamParam}`,
      {
        method: 'POST',
        headers: getVercelHeaders(),
        body: JSON.stringify({ name: domain, redirect: redirectTo, redirectStatusCode: 301 }),
      }
    );

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Vercel API authentication failed.' };
    }

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Failed to add redirect domain' };
    }

    return { success: true, domain: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add redirect domain' };
  }
}

/**
 * Remove both root and www domains from the Vercel project.
 */
export async function removeDomainPairFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  const apex = getApexDomain(domain);
  const www = `www.${apex}`;

  // Remove both — don't fail if one doesn't exist
  const [rootResult, wwwResult] = await Promise.all([
    removeDomainFromVercel(apex),
    removeDomainFromVercel(www),
  ]);

  if (!rootResult.success && !wwwResult.success) {
    return rootResult; // Return root error if both failed
  }

  return { success: true };
}

/**
 * Get DNS instructions for a domain.
 * Always returns both A record (root) and CNAME (www) so both resolve.
 */
export function getDNSInstructions(domain: string, domainConfig?: VercelDomainConfig): DNSInstructions {
  const records: VercelDNSRecord[] = [
    // A record for root domain (e.g., example.com)
    {
      type: 'A',
      name: '@',
      value: '76.76.21.21',
    },
    // CNAME for www subdomain (e.g., www.example.com)
    {
      type: 'CNAME',
      name: 'www',
      value: 'cname.vercel-dns.com',
    },
  ];

  // Add TXT verification record if needed
  const verification = domainConfig?.verification?.[0];

  return {
    configured: domainConfig?.configured ?? false,
    records,
    verification: verification
      ? {
          type: verification.type,
          domain: verification.domain,
          value: verification.value,
        }
      : undefined,
  };
}

/**
 * Check if Vercel API is configured
 */
export function isVercelConfigured(): boolean {
  return !!(
    process.env.VERCEL_API_TOKEN &&
    process.env.VERCEL_PROJECT_ID
  );
}
