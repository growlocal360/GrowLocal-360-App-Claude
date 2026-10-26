import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { revalidateSite } from '@/lib/sites/revalidate';
import {
  verifyDomainDNS,
  getDomainConfig,
  isVercelConfigured,
  getCertificateStatus,
  requestCertificate,
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

    const access = await verifySiteAccess(supabase, siteId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const adminSupabase = createAdminClient();

    // Fetch site data (no org join needed — access already verified)
    const { data: site, error: siteError } = await adminSupabase
      .from('sites')
      .select('id, custom_domain, custom_domain_verified')
      .eq('id', siteId)
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
      const { error: updateError } = await adminSupabase
        .from('sites')
        .update({
          custom_domain_verified: true,
          vercel_domain_config: configResult.domain || null,
        })
        .eq('id', siteId);

      if (updateError) {
        console.error('Error updating verification status:', updateError);
      }

      // Revalidate so canonical/schema URLs flip from subdomain → custom domain
      await revalidateSite(siteId);

      // DNS + ownership are not the whole story: HTTPS only works once Vercel
      // has issued a certificate, and that step can silently never happen.
      // If it hasn't, ask for it now (the owner clicked Verify / the page is polling).
      let cert = await getCertificateStatus(site.custom_domain);
      let certError: string | undefined = cert.error;
      if (!cert.issued) {
        const req = await requestCertificate(site.custom_domain);
        if (!req.success) certError = req.error;
        cert = await getCertificateStatus(site.custom_domain);
      }

      return NextResponse.json({
        verified: true,
        configured: true,
        httpsReady: cert.issued,
        message: cert.issued
          ? 'Domain verified successfully! Your site is now live at this domain.'
          : `DNS is verified. Waiting on the HTTPS certificate (usually a few minutes)${certError ? `: ${certError}` : '.'}`,
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
