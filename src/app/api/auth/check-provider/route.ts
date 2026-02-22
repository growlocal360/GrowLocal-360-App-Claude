import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ provider: null });
    }

    const supabase = createAdminClient();

    // List users and find the one matching the email
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error || !data?.users) {
      return NextResponse.json({ provider: null });
    }

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      // Don't reveal whether email exists — return null for non-existent too
      return NextResponse.json({ provider: null });
    }

    const hasGoogle = user.identities?.some(
      (identity) => identity.provider === 'google'
    );

    return NextResponse.json({ provider: hasGoogle ? 'google' : null });
  } catch {
    return NextResponse.json({ provider: null });
  }
}
