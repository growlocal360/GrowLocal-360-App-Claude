import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveOrg } from '@/lib/auth/resolve-org';
import { generateApiKey } from '@/lib/api-keys/keys';
import type { ApiKey, ApiKeyPublic } from '@/types/database';

interface ApiKeyWithSite extends ApiKeyPublic {
  site_name: string;
}

function toPublic(key: ApiKey & { sites?: { name: string } | null }): ApiKeyWithSite {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key_hash, sites, ...rest } = key;
  return {
    ...rest,
    site_name: sites?.name || 'Unknown',
  };
}

// GET — list ALL keys across the user's active org
export async function GET() {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('api_keys')
    .select('*, sites(name)')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    keys: (data || []).map((k) => toPublic(k as ApiKey & { sites?: { name: string } | null })),
  });
}

// POST — create a key. Requires siteId in body (UI defaults to user's only/first site).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name || '').trim();
  const siteId = body.siteId;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
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

  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  const { data, error } = await admin
    .from('api_keys')
    .insert({
      site_id: siteId,
      organization_id: ctx.organizationId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_by: ctx.profileId,
    })
    .select('*, sites(name)')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  return NextResponse.json({
    key: toPublic(data as ApiKey & { sites?: { name: string } | null }),
    fullKey,
    warning: 'Store this key now. It will never be shown again.',
  });
}

// DELETE — revoke a key
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
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
