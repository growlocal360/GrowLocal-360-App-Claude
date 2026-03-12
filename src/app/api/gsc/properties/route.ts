import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GSCClient } from '@/lib/google/gsc-client';

// GET - Fetch GSC properties for the authenticated user (no siteId needed)
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    console.error('Failed to fetch GSC properties:', error);
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
