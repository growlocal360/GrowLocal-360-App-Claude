import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { listSocialConnections, socialSettings } from '@/lib/social/fanout';
import { metaConfigured } from '@/lib/social/meta';

/**
 * GET   -> { configured, connections, settings, counts }
 * PATCH -> { settings?: { snaps?, gbpPosts? }, connection?: { id, active } | { id, remove: true } }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const [{ data: site }, connections, { data: posts }] = await Promise.all([
    admin.from('sites').select('settings').eq('id', siteId).single(),
    listSocialConnections(admin, siteId),
    admin.from('pending_actions').select('status').eq('site_id', siteId).eq('action_type', 'social_post'),
  ]);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const counts: Record<string, number> = {};
  for (const p of posts || []) counts[p.status] = (counts[p.status] || 0) + 1;
  return NextResponse.json({ configured: metaConfigured(), connections, settings: socialSettings(site.settings), counts });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as {
    settings?: { snaps?: boolean; gbpPosts?: boolean };
    connection?: { id: string; active?: boolean; remove?: boolean };
  };
  const admin = createAdminClient();

  if (body.connection?.id) {
    const { data: conn } = await admin.from('social_connections').select('id, platform, site_id').eq('id', body.connection.id).eq('site_id', siteId).maybeSingle();
    if (!conn || (conn.platform !== 'facebook' && conn.platform !== 'instagram')) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    if (body.connection.remove) {
      await admin.from('social_connections').delete().eq('id', conn.id);
    } else if (typeof body.connection.active === 'boolean') {
      await admin.from('social_connections').update({ is_active: body.connection.active, updated_at: new Date().toISOString() }).eq('id', conn.id);
    }
  }

  if (body.settings && typeof body.settings === 'object') {
    const { data: site } = await admin.from('sites').select('settings').eq('id', siteId).single();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    const settings = (site.settings || {}) as Record<string, unknown>;
    const automation = { ...((settings.automation as Record<string, unknown> | undefined) || {}) };
    const social = { ...((automation.social as Record<string, unknown> | undefined) || {}) };
    if (typeof body.settings.snaps === 'boolean') social.snaps = body.settings.snaps;
    if (typeof body.settings.gbpPosts === 'boolean') social.gbp_posts = body.settings.gbpPosts;
    automation.social = social;
    const { error } = await admin.from('sites').update({ settings: { ...settings, automation } }).eq('id', siteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
