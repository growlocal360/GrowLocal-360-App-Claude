import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { metaAuthUrl, metaConfigured, signState } from '@/lib/social/meta';

/**
 * GET /api/sites/[siteId]/social/meta/start?next=/dashboard/...
 * Sends the signed-in owner to Facebook Login. The callback saves every Page
 * they manage (and each Page's Instagram account) for this site.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error || !access.caller) return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.status || 401 });
  if (!metaConfigured()) return NextResponse.json({ error: 'Facebook is not set up on this server (META_APP_ID / META_APP_SECRET).' }, { status: 503 });

  const next = req.nextUrl.searchParams.get('next') || `/dashboard/sites/${siteId}/automation`;
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : `/dashboard/sites/${siteId}/automation`;
  const state = signState({ siteId, userId: access.caller.user_id, next: safeNext, ts: Date.now() });
  return NextResponse.redirect(metaAuthUrl(state));
}
