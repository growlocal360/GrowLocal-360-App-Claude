import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseSignedRequest } from '@/lib/social/meta';

/**
 * POST /api/social/meta/data-deletion
 * Meta's Data Deletion Request callback. We hold nothing about a Facebook user
 * except the Page tokens they granted, so deletion is immediate: every
 * connection from that user is removed and a confirmation code returned.
 * Configured in the Meta app under App settings > Basic > Data deletion.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const payload = parseSignedRequest(form?.get('signed_request')?.toString());
  if (!payload?.user_id) return NextResponse.json({ error: 'Bad signed_request' }, { status: 400 });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('social_connections')
    .delete()
    .in('platform', ['facebook', 'instagram'])
    .eq('metadata->>meta_user_id', payload.user_id)
    .select('id');

  const code = `fb-${payload.user_id}-${Date.now().toString(36)}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
  return NextResponse.json({
    url: `${appUrl}/api/social/meta/data-deletion/status?code=${encodeURIComponent(code)}&removed=${(rows || []).length}`,
    confirmation_code: code,
  });
}
