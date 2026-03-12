import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GSCClient } from '@/lib/google/gsc-client';

// GET - List available Google Search Console properties
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify site access
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
