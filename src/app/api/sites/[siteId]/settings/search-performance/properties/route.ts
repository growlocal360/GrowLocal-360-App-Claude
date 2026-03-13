import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { GSCClient } from '@/lib/google/gsc-client';

// GET - List available Google Search Console properties
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Get the provider token from the session
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;

  if (!providerToken) {
    return NextResponse.json(
      { error: 'No Google token available. Please re-authenticate with Google.' },
      { status: 401 }
    );
  }

  try {
    const gscClient = new GSCClient(providerToken);
    const sites = await gscClient.listSites();

    return NextResponse.json({
      properties: sites.map((s) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      })),
    });
  } catch (error) {
    console.error('Failed to list GSC properties:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch properties';

    if (message.includes('403') || message.includes('401')) {
      return NextResponse.json(
        { error: 'Google token expired or lacks Search Console permission. Please re-authenticate.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
