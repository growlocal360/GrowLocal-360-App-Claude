import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

// Main app domains that should NOT be treated as site subdomains
const MAIN_APP_SUBDOMAINS = ['www', 'admin', 'app', 'api'];
const MAIN_APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';

// Check if this is a site subdomain request (e.g., bobshvac.growlocal360.com)
function getSubdomainFromHost(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Check if it's our main app domain
  if (!hostname.endsWith(MAIN_APP_DOMAIN)) {
    return null;
  }

  // Extract subdomain
  const subdomain = hostname.replace(`.${MAIN_APP_DOMAIN}`, '');

  // Ignore main app subdomains
  if (!subdomain || MAIN_APP_SUBDOMAINS.includes(subdomain) || subdomain === MAIN_APP_DOMAIN) {
    return null;
  }

  return subdomain;
}

// Check if this is a custom domain request (e.g., bobshvac.com)
function isCustomDomain(host: string): boolean {
  const hostname = host.split(':')[0];

  // It's a custom domain if it's not our main app domain or a subdomain of it
  return !hostname.endsWith(MAIN_APP_DOMAIN) &&
         !hostname.endsWith('.vercel.app') &&
         hostname !== 'localhost' &&
         !hostname.match(/^127\.\d+\.\d+\.\d+$/) &&
         !hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
}

// Site lookup result with status info
interface SiteLookupResult {
  slug: string;
  status: string;
  websiteType: string;
  locationSlugs: string[];
}

// Create a Supabase client for middleware use
function createMiddlewareClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op for read-only operation
        },
      },
    }
  );
}

// Fetch location slugs for a multi-location site
async function fetchLocationSlugs(supabase: ReturnType<typeof createMiddlewareClient>, siteId: string): Promise<string[]> {
  const { data: locations } = await supabase
    .from('locations')
    .select('slug')
    .eq('site_id', siteId);
  return (locations || []).map(l => l.slug);
}

// Lookup site by custom domain
async function getSiteByDomain(domain: string, request: NextRequest): Promise<SiteLookupResult | null> {
  try {
    const supabase = createMiddlewareClient(request);

    const { data: site } = await supabase
      .from('sites')
      .select('id, slug, status, website_type')
      .eq('custom_domain', domain)
      .eq('custom_domain_verified', true)
      .single();

    if (!site) return null;

    let locationSlugs: string[] = [];
    if (site.website_type === 'multi_location') {
      locationSlugs = await fetchLocationSlugs(supabase, site.id);
    }

    return { slug: site.slug, status: site.status, websiteType: site.website_type || 'single_location', locationSlugs };
  } catch {
    console.error('Error looking up site by domain:', domain);
    return null;
  }
}

// Lookup site by subdomain (slug)
async function getSiteBySlug(slug: string, request: NextRequest): Promise<SiteLookupResult | null> {
  try {
    const supabase = createMiddlewareClient(request);

    const { data: site } = await supabase
      .from('sites')
      .select('id, slug, status, website_type')
      .eq('slug', slug)
      .single();

    if (!site) return null;

    let locationSlugs: string[] = [];
    if (site.website_type === 'multi_location') {
      locationSlugs = await fetchLocationSlugs(supabase, site.id);
    }

    return { slug: site.slug, status: site.status, websiteType: site.website_type || 'single_location', locationSlugs };
  } catch {
    console.error('Error looking up site by slug:', slug);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Skip domain routing for static files, API routes, and internal paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/oauth2callback') ||
    pathname.startsWith('/sites/') || // Already routed
    pathname === '/favicon.ico' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    // For dashboard/login routes, still run auth middleware
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
      return await updateSession(request);
    }
    return NextResponse.next();
  }

  // Helper to handle site status routing
  const handleSiteRouting = (site: SiteLookupResult, url: URL): NextResponse => {
    // Check site status and route accordingly
    switch (site.status) {
      case 'paused':
        // Show maintenance page for paused sites
        url.pathname = `/sites/${site.slug}/maintenance`;
        return NextResponse.rewrite(url);

      case 'building':
        // Show coming soon page for sites being built
        url.pathname = `/sites/${site.slug}/coming-soon`;
        return NextResponse.rewrite(url);

      case 'suspended':
        // Show suspended page
        url.pathname = `/sites/${site.slug}/suspended`;
        return NextResponse.rewrite(url);

      case 'failed':
        // Show error page for failed builds
        url.pathname = `/sites/${site.slug}/build-error`;
        return NextResponse.rewrite(url);

      case 'active':
      default:
        // For multi-location sites, check if first path segment is a location slug
        if (site.websiteType === 'multi_location' && site.locationSlugs.length > 0) {
          const segments = pathname.split('/').filter(Boolean);
          const firstSegment = segments[0];

          if (firstSegment && site.locationSlugs.includes(firstSegment)) {
            // Rewrite /{locationSlug}/rest → /sites/{siteSlug}/locations/{locationSlug}/rest
            const rest = segments.slice(1).join('/');
            url.pathname = `/sites/${site.slug}/locations/${firstSegment}${rest ? `/${rest}` : ''}`;
            return NextResponse.rewrite(url);
          }
        }

        // Normal routing: single-location or non-location path
        url.pathname = `/sites/${site.slug}${pathname}`;
        return NextResponse.rewrite(url);
    }
  };

  // Check for subdomain (bobshvac.growlocal360.com)
  const subdomain = getSubdomainFromHost(host);
  if (subdomain) {
    const site = await getSiteBySlug(subdomain, request);
    const url = request.nextUrl.clone();

    if (site) {
      return handleSiteRouting(site, url);
    } else {
      // Subdomain not found
      url.pathname = '/domain-not-found';
      return NextResponse.rewrite(url);
    }
  }

  // Check for custom domain (bobshvac.com)
  if (isCustomDomain(host)) {
    const hostname = host.split(':')[0];
    const site = await getSiteByDomain(hostname, request);
    const url = request.nextUrl.clone();

    if (site) {
      return handleSiteRouting(site, url);
    } else {
      // Domain not found or not verified - show error page
      url.pathname = '/domain-not-found';
      return NextResponse.rewrite(url);
    }
  }

  // Default: run auth middleware for main app
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
