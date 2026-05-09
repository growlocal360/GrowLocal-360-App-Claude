import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveOrg } from '@/lib/auth/resolve-org';
import { generateWebhookSecret } from '@/lib/webhooks/sign';
import type { WebhookEndpoint, WebhookEndpointPublic } from '@/types/database';

interface WebhookEndpointWithSite extends WebhookEndpointPublic {
  site_name: string;
}

function toPublic(
  ep: WebhookEndpoint & {
    sites?: { name: string; settings?: { workspace_only?: boolean } | null } | null;
  }
): WebhookEndpointWithSite {
  const { sites, ...rest } = ep;
  const isWorkspace = !!sites?.settings?.workspace_only;
  const baseName = sites?.name || 'Unknown';
  return {
    ...rest,
    secret_preview: `${ep.secret.slice(0, 12)}…`,
    site_name: `${baseName} · ${isWorkspace ? 'Job Snaps' : 'Site'}`,
  };
}

// GET — list all webhook endpoints in the active org
export async function GET() {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('webhook_endpoints')
    .select('*, sites(name, settings)')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    endpoints: (data || []).map((ep) =>
      toPublic(ep as WebhookEndpoint & { sites?: { name: string; settings?: { workspace_only?: boolean } | null } | null })
    ),
  });
}

// POST — create endpoint
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await req.json().catch(() => ({}));
  const url = (body.url || '').trim();
  const siteId = body.siteId;
  const events = Array.isArray(body.events) && body.events.length > 0
    ? body.events
    : ['job_snap.published', 'job_snap.updated', 'job_snap.unpublished'];

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'url must be a valid http(s) URL' }, { status: 400 });
  }
  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the site belongs to the user's active org
  const { data: site } = await admin
    .from('sites')
    .select('id, organization_id')
    .eq('id', siteId)
    .single();

  if (!site || site.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: 'Site not found in active org' }, { status: 404 });
  }

  const secret = generateWebhookSecret();

  const { data, error } = await admin
    .from('webhook_endpoints')
    .insert({
      site_id: siteId,
      organization_id: ctx.organizationId,
      url,
      secret,
      events,
      is_active: true,
      created_by: ctx.profileId,
    })
    .select('*, sites(name, settings)')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create webhook endpoint' }, { status: 500 });
  }

  return NextResponse.json({
    endpoint: toPublic(data as WebhookEndpoint & { sites?: { name: string; settings?: { workspace_only?: boolean } | null } | null }),
    secret,
    warning: 'Store this signing secret now. It will never be shown again.',
  });
}

// PATCH — toggle is_active or update url/events
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update endpoint' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove endpoint
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete endpoint' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
