import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  verifyDomainDNS,
  getDomainConfig,
  isVercelConfigured,
} from '@/lib/vercel/domains';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * POST /api/sites/[siteId]/domain/verify
 * Verify DNS configuration for a custom domain
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

    // Get site with organization check
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select(`
        id,
        custom_domain,
        custom_domain_verified,
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
      return NextResponse.json(
        { error: 'No custom domain configured' },
        { status: 400 }
      );
    }

    // If Vercel is not configured, we can't verify
    if (!isVercelConfigured()) {
      return NextResponse.json(
        { error: 'Domain verification is not available. Vercel API is not configured.' },
        { status: 503 }
      );
    }

    // Verify domain DNS with Vercel
    const verificationResult = await verifyDomainDNS(site.custom_domain);

    // Get updated domain config
    const configResult = await getDomainConfig(site.custom_domain);

    // Update site verification status
    if (verificationResult.verified && verificationResult.configured) {
      const { error: updateError } = await supabase
        .from('sites')
        .update({
          custom_domain_verified: true,
          vercel_domain_config: configResult.domain || null,
        })
        .eq('id', siteId);

      if (updateError) {
        console.error('Error updating verification status:', updateError);
      }

      return NextResponse.json({
        verified: true,
        configured: true,
        message: 'Domain verified successfully! Your site is now live at this domain.',
      });
    }

    // Not yet verified - provide helpful message
    let message = 'DNS is not configured correctly yet.';
    if (verificationResult.error) {
      message = verificationResult.error;
    } else if (!verificationResult.configured) {
      message = 'DNS records have not propagated yet. This can take up to 48 hours.';
    }

    return NextResponse.json({
      verified: false,
      configured: verificationResult.configured,
      message,
      vercelConfig: configResult.domain,
    });
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { error: 'Failed to verify domain' },
      { status: 500 }
    );
  }
}
