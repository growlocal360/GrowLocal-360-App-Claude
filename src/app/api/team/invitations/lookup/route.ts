import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Public lookup of invitation by token (no auth required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: invitation, error } = await adminSupabase
    .from('invitations')
    .select(
      'id, email, role, expires_at, organization:organizations(name), inviter:profiles!invited_by(full_name)'
    )
    .eq('token', token)
    .is('accepted_at', null)
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
  }

  return NextResponse.json({ invitation });
}
