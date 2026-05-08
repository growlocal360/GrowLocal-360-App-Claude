import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { encrypt } from '@/lib/integrations/crypto';
import * as hl from '@/lib/highlevel/client';

/**
 * GET — connection status for the HighLevel integration on this site.
 * Returns the location/blog name for display, NEVER the token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('integration_credentials')
    .select('id, metadata, created_at, updated_at')
    .eq('site_id', siteId)
    .eq('provider', 'highlevel')
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  const meta = (data.metadata || {}) as {
    location_id?: string;
    location_name?: string;
    blog_id?: string;
    blog_name?: string;
    url_prefix?: string;
    posts?: Record<string, string>;
  };

  return NextResponse.json({
    connected: true,
    locationId: meta.location_id || null,
    locationName: meta.location_name || null,
    blogId: meta.blog_id || null,
    blogName: meta.blog_name || null,
    urlPrefix: meta.url_prefix || 'work',
    postCount: Object.keys(meta.posts || {}).length,
    connectedAt: data.created_at,
  });
}

/**
 * POST — connect HighLevel by storing token + selected blog.
 *
 * Two-phase flow:
 *   Phase 1: client posts { token, locationId } → we verify, return list of blogs
 *   Phase 2: client posts { token, locationId, blogId, blogName } → we save
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error || !access.caller || !access.siteOrgId) {
    return NextResponse.json(
      { error: access.error || 'Unauthorized' },
      { status: access.status || 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const token: string = (body.token || '').trim();
  const locationId: string = (body.locationId || '').trim();
  const blogId: string | undefined = body.blogId?.trim();
  const blogName: string | undefined = body.blogName?.trim();

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  // Phase 1 — verify token + return blogs to choose from
  if (!blogId) {
    try {
      const location = await hl.verifyToken(token, locationId);
      const blogs = await hl.listBlogs(token, locationId);
      return NextResponse.json({
        verified: true,
        location,
        blogs,
      });
    } catch (err: any) {
      const status = err?.status === 401 || err?.status === 403 ? 401 : 400;
      return NextResponse.json(
        {
          error:
            err?.status === 401 || err?.status === 403
              ? 'Token rejected by HighLevel — check that the token is valid and has Blog scopes.'
              : err?.message || 'Could not verify HighLevel credentials.',
        },
        { status }
      );
    }
  }

  // Phase 2 — save the verified credentials
  try {
    const location = await hl.verifyToken(token, locationId);
    const admin = createAdminClient();

    // Upsert (one connection per site per provider)
    const encrypted = encrypt(token);
    const metadata = {
      location_id: locationId,
      location_name: location.name,
      blog_id: blogId,
      blog_name: blogName || null,
      url_prefix: 'work',
      posts: {} as Record<string, string>,
    };

    const { error } = await admin.from('integration_credentials').upsert(
      {
        site_id: siteId,
        organization_id: access.siteOrgId,
        provider: 'highlevel',
        access_token: encrypted,
        metadata,
      },
      { onConflict: 'site_id,provider' }
    );

    if (error) {
      console.error('Failed to save HL credentials:', error);
      return NextResponse.json(
        { error: 'Failed to save credentials.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      locationName: location.name,
      blogName: blogName || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Could not save HighLevel connection.' },
      { status: 400 }
    );
  }
}

/**
 * DELETE — disconnect HighLevel.
 *
 * Removes credentials. Existing HL blog posts are NOT deleted by this
 * action (they live on at the customer's HL site until they unpublish
 * each snap individually, or until they manually delete in HL).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('integration_credentials')
    .delete()
    .eq('site_id', siteId)
    .eq('provider', 'highlevel');

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
