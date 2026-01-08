import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  addDomainToVercel,
  removeDomainFromVercel,
  getDomainConfig,
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

    // Verify user owns this site
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get site with organization check
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select(`
        id,
        slug,
        custom_domain,
        custom_domain_verified,
        vercel_domain_config,
        organization:organizations!inner(
          id,
          organization_members!inner(user_id)
        )
      `)
      .eq('id', siteId)
      .eq('organization.organization_members.user_id', user.id)
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
      dnsInstructions = getDNSInstructions(
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

    // Verify user owns this site
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Normalize domain (lowercase, trim)
    const normalizedDomain = domain.toLowerCase().trim();

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Verify user owns this site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select(`
        id,
        slug,
        custom_domain,
        organization:organizations!inner(
          id,
          organization_members!inner(user_id)
        )
      `)
      .eq('id', siteId)
      .eq('organization.organization_members.user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check if domain is already in use by another site
    const { data: existingSite } = await supabase
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

    // Add domain to Vercel if configured
    let vercelConfig = null;
    if (isVercelConfigured()) {
      const vercelResult = await addDomainToVercel(normalizedDomain);
      if (!vercelResult.success) {
        return NextResponse.json(
          { error: vercelResult.error || 'Failed to add domain to Vercel' },
          { status: 400 }
        );
      }
      vercelConfig = vercelResult.domain;
    }

    // Update site with custom domain
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        custom_domain: normalizedDomain,
        custom_domain_verified: false,
        vercel_domain_config: vercelConfig,
      })
      .eq('id', siteId);

    if (updateError) {
      // Rollback Vercel domain if database update fails
      if (isVercelConfigured()) {
        await removeDomainFromVercel(normalizedDomain);
      }
      throw updateError;
    }

    // Get DNS instructions
    const dnsInstructions = getDNSInstructions(normalizedDomain, vercelConfig ?? undefined);

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

    // Verify user owns this site
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get site with organization check
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select(`
        id,
        custom_domain,
        organization:organizations!inner(
          id,
          organization_members!inner(user_id)
        )
      `)
      .eq('id', siteId)
      .eq('organization.organization_members.user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (!site.custom_domain) {
      return NextResponse.json({ error: 'No custom domain to remove' }, { status: 400 });
    }

    // Remove domain from Vercel if configured
    if (isVercelConfigured()) {
      const vercelResult = await removeDomainFromVercel(site.custom_domain);
      if (!vercelResult.success) {
        console.warn('Failed to remove domain from Vercel:', vercelResult.error);
        // Continue anyway - we'll remove from database
      }
    }

    // Update site to remove custom domain
    const { error: updateError } = await supabase
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
