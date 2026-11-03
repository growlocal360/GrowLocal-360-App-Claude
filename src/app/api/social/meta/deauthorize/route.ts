import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseSignedRequest } from '@/lib/social/meta';

/**
 * POST /api/social/meta/deauthorize
 * Meta calls this (form field `signed_request`) when a user removes the app
 * from their Facebook settings. Their Page tokens stop working, so we switch
 * off every connection that user granted. Configured in the Meta app under
 * Facebook Login > Settings > Deauthorize callback URL.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const payload = parseSignedRequest(form?.get('signed_request')?.toString());
  if (!payload?.user_id) return NextResponse.json({ error: 'Bad signed_request' }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from('social_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('platform', ['facebook', 'instagram'])
    .eq('metadata->>meta_user_id', payload.user_id);
  return NextResponse.json({ ok: true });
}
