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

// Lookup site slug by custom domain
async function getSiteSlugByDomain(domain: string, request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
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

    const { data: site } = await supabase
      .from('sites')
      .select('slug')
      .eq('custom_domain', domain)
      .eq('custom_domain_verified', true)
      .eq('is_active', true)
      .single();

    return site?.slug || null;
  } catch {
    console.error('Error looking up site by domain:', domain);
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

  // Check for subdomain (bobshvac.growlocal360.com)
  const subdomain = getSubdomainFromHost(host);
  if (subdomain) {
    // Rewrite to /sites/[slug] route
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Check for custom domain (bobshvac.com)
  if (isCustomDomain(host)) {
    const hostname = host.split(':')[0];
    const slug = await getSiteSlugByDomain(hostname, request);

    if (slug) {
      // Rewrite to /sites/[slug] route
      const url = request.nextUrl.clone();
      url.pathname = `/sites/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    } else {
      // Domain not found or not verified - show error page
      const url = request.nextUrl.clone();
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
