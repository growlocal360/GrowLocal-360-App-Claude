import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import {
  addDomainPairToVercel,
  removeDomainPairFromVercel,
  getDNSInstructions,
  isVercelConfigured,
} from '@/lib/vercel/domains';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/domain
 * Get current domain configuration for a site
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { siteId } = await params;
    const supabase = await createClient();

    const access = await verifySiteAccess(supabase, siteId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const adminSupabase = createAdminClient();

    // Fetch site data (no org join needed — access already verified)
    const { data: site, error: siteError } = await adminSupabase
      .from('sites')
      .select('id, slug, custom_domain, custom_domain_verified, vercel_domain_config')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get subdomain (always available)
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
    const subdomain = `${site.slug}.${appDomain}`;

    // Get DNS instructions if custom domain is set
    let dnsInstructions = null;
    if (site.custom_domain) {
      dnsInstructions = await getDNSInstructions(
        site.custom_domain,
        site.vercel_domain_config as Parameters<typeof getDNSInstructions>[1]
      );
    }

    return NextResponse.json({
      subdomain,
      customDomain: site.custom_domain,
      customDomainVerified: site.custom_domain_verified,
      dnsInstructions,
      vercelConfigured: isVercelConfigured(),
    });
  } catch (error) {
    console.error('Error getting domain config:', error);
    return NextResponse.json(
      { error: 'Failed to get domain configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites/[siteId]/domain
 * Add a custom domain to a site
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { siteId } = await params;
    const supabase = await createClient();

    const access = await verifySiteAccess(supabase, siteId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const adminSupabase = createAdminClient();

    // Parse request body
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Normalize domain (lowercase, trim) — store exactly what user typed
    const normalizedDomain = domain.toLowerCase().trim();

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Check if domain is already in use by another site
    const { data: existingSite } = await adminSupabase
      .from('sites')
      .select('id')
      .eq('custom_domain', normalizedDomain)
      .neq('id', siteId)
      .single();

    if (existingSite) {
      return NextResponse.json(
        { error: 'This domain is already in use by another site' },
        { status: 400 }
      );
    }

    // Vercel must be configured to add custom domains
    if (!isVercelConfigured()) {
      return NextResponse.json(
        { error: 'Custom domains are not available. Vercel API is not configured.' },
        { status: 503 }
      );
    }

    // Add both root + www domains to Vercel
    const vercelResult = await addDomainPairToVercel(normalizedDomain);
    if (!vercelResult.success) {
      return NextResponse.json(
        { error: vercelResult.error || 'Failed to add domain to Vercel' },
        { status: 400 }
      );
    }
    const vercelConfig = vercelResult.domain;

    // Update site with custom domain
    const { error: updateError } = await adminSupabase
      .from('sites')
      .update({
        custom_domain: normalizedDomain,
        custom_domain_verified: false,
        vercel_domain_config: vercelConfig,
      })
      .eq('id', siteId);

    if (updateError) {
      // Rollback Vercel domains if database update fails
      if (isVercelConfigured()) {
        await removeDomainPairFromVercel(normalizedDomain);
      }
      throw updateError;
    }

    // Get DNS instructions
    const dnsInstructions = await getDNSInstructions(normalizedDomain, vercelConfig ?? undefined);

    return NextResponse.json({
      success: true,
      customDomain: normalizedDomain,
      dnsInstructions,
    });
  } catch (error) {
    console.error('Error adding custom domain:', error);
    return NextResponse.json(
      { error: 'Failed to add custom domain' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sites/[siteId]/domain
 * Remove custom domain from a site
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { siteId } = await params;
    const supabase = await createClient();

    const access = await verifySiteAccess(supabase, siteId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const adminSupabase = createAdminClient();

    // Fetch site data (no org join needed — access already verified)
    const { data: site, error: siteError } = await adminSupabase
      .from('sites')
      .select('id, custom_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (!site.custom_domain) {
      return NextResponse.json({ error: 'No custom domain to remove' }, { status: 400 });
    }

    // Remove both root + www domains from Vercel if configured
    if (isVercelConfigured()) {
      const vercelResult = await removeDomainPairFromVercel(site.custom_domain);
      if (!vercelResult.success) {
        console.warn('Failed to remove domains from Vercel:', vercelResult.error);
        // Continue anyway - we'll remove from database
      }
    }

    // Update site to remove custom domain
    const { error: updateError } = await adminSupabase
      .from('sites')
      .update({
        custom_domain: null,
        custom_domain_verified: false,
        vercel_domain_config: null,
      })
      .eq('id', siteId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing custom domain:', error);
    return NextResponse.json(
      { error: 'Failed to remove custom domain' },
      { status: 500 }
    );
  }
}
