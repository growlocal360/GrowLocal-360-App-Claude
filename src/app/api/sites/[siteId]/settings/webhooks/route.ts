import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { generateWebhookSecret } from '@/lib/webhooks/sign';
import type { WebhookEndpoint, WebhookEndpointPublic } from '@/types/database';

function toPublic(ep: WebhookEndpoint): WebhookEndpointPublic {
  return {
    ...ep,
    secret_preview: `${ep.secret.slice(0, 12)}…`,
  };
}

// GET — list webhook endpoints for site
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
    .from('webhook_endpoints')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    endpoints: (data || []).map((ep) => toPublic(ep as WebhookEndpoint)),
  });
}

// POST — create a new endpoint. Returns FULL secret once.
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
  const url = (body.url || '').trim();
  const events = Array.isArray(body.events) && body.events.length > 0
    ? body.events
    : ['job_snap.published', 'job_snap.updated', 'job_snap.unpublished'];

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'url must be a valid http(s) URL' }, { status: 400 });
  }

  const secret = generateWebhookSecret();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('webhook_endpoints')
    .insert({
      site_id: siteId,
      organization_id: access.siteOrgId,
      url,
      secret,
      events,
      is_active: true,
      created_by: access.caller.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create webhook endpoint' }, { status: 500 });
  }

  return NextResponse.json({
    endpoint: toPublic(data as WebhookEndpoint),
    secret, // shown once for the customer to store on their server
    warning: 'Store this signing secret now. It will never be shown again.',
  });
}

// PATCH — update url, events, or is_active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json().catch(() => ({}));
  const { id, url, events, isActive } = body;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (url !== undefined) {
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: 'url must be valid' }, { status: 400 });
    }
    updateData.url = url;
  }
  if (events !== undefined) updateData.events = events;
  if (isActive !== undefined) updateData.is_active = isActive;

  const admin = createAdminClient();
  const { error } = await admin
    .from('webhook_endpoints')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update endpoint' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a webhook endpoint
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete endpoint' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
