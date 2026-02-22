import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ provider: null });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('get_auth_provider', {
      email_input: email,
    });

    if (error) {
      console.error('check-provider error:', error.message);
      return NextResponse.json({ provider: null });
    }

    // data is the provider string (e.g., 'google') or null
    return NextResponse.json({ provider: data || null });
  } catch (err) {
    console.error('check-provider unexpected error:', err);
    return NextResponse.json({ provider: null });
  }
}
