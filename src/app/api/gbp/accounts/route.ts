import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GBPClient } from '@/lib/google/gbp-client';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the provider token (Google access token)
    const providerToken = session.provider_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: 'No Google connection found. Please reconnect your Google account.' },
        { status: 400 }
      );
    }

    // Fetch GBP accounts
    const gbpClient = new GBPClient(providerToken);
    const accounts = await gbpClient.getAccounts();

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching GBP accounts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
