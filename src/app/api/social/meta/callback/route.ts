import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { encrypt } from '@/lib/integrations/crypto';
import { exchangeCode, listPages, metaUser, readState } from '@/lib/social/meta';

/**
 * GET /api/social/meta/callback?code=&state=
 * Facebook sends the owner back here. We swap the code for a long-lived user
 * token, list the Pages they manage, and store one connection per Page plus one
 * per linked Instagram Business account (Page token, encrypted). With exactly
 * one Page everything is switched on; with several, the owner picks on the
 * Automation page.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const state = readState(q.get('state'));
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
  const back = (path: string, params: Record<string, string>) => {
    const u = new URL(path, appUrl);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return NextResponse.redirect(u);
  };
  if (!state) return back('/dashboard', { social: 'error', reason: 'That Facebook sign-in link expired. Try again.' });
  const next = state.next;

  if (q.get('error')) {
    const reason = q.get('error_description') || q.get('error_reason') || 'Facebook sign-in was cancelled.';
    return back(next, { social: 'error', reason });
  }
  const code = q.get('code');
  if (!code) return back(next, { social: 'error', reason: 'Facebook did not return a sign-in code.' });

  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, state.siteId);
  if (access.error || !access.caller || access.caller.user_id !== state.userId) {
    return back(next, { social: 'error', reason: 'Sign in to GrowLocal first, then connect Facebook.' });
  }

  try {
    const { accessToken: userToken, expiresAt } = await exchangeCode(code);
    const [me, pages] = await Promise.all([metaUser(userToken), listPages(userToken)]);
    if (pages.length === 0) {
      return back(next, { social: 'error', reason: 'That Facebook account does not manage any Pages. Sign in with the account that owns the business Page.' });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin.from('social_connections').select('platform, account_id, is_active').eq('site_id', state.siteId).in('platform', ['facebook', 'instagram']);
    const wasActive = new Map((existing || []).map((r) => [`${r.platform}:${r.account_id}`, r.is_active as boolean]));
    const single = pages.length === 1;
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    for (const p of pages) {
      const base = { site_id: state.siteId, access_token: encrypt(p.accessToken), refresh_token: null, token_expires_at: null, connected_by: state.userId, updated_at: now };
      rows.push({
        ...base,
        platform: 'facebook',
        account_id: p.id,
        account_name: p.name,
        is_active: wasActive.get(`facebook:${p.id}`) ?? single,
        metadata: { picture: p.picture, meta_user_id: me.id, meta_user_name: me.name, user_token_expires_at: expiresAt, instagram_id: p.instagram?.id || null },
      });
      if (p.instagram) {
        rows.push({
          ...base,
          platform: 'instagram',
          account_id: p.instagram.id,
          account_name: p.instagram.username ? `@${p.instagram.username}` : `Instagram (${p.name})`,
          is_active: wasActive.get(`instagram:${p.instagram.id}`) ?? single,
          metadata: { picture: p.instagram.picture, meta_user_id: me.id, meta_user_name: me.name, user_token_expires_at: expiresAt, page_id: p.id, page_name: p.name },
        });
      }
    }
    const { error } = await admin.from('social_connections').upsert(rows, { onConflict: 'site_id,platform,account_id' });
    if (error) throw new Error(error.message);

    const ig = pages.filter((p) => p.instagram).length;
    return back(next, { social: 'connected', pages: String(pages.length), instagram: String(ig) });
  } catch (e) {
    console.error('[meta/callback]', e);
    return back(next, { social: 'error', reason: e instanceof Error ? e.message : 'Could not connect Facebook.' });
  }
}
