import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { generateApiKey } from '@/lib/api-keys/keys';
import type { ApiKey, ApiKeyPublic } from '@/types/database';

function toPublic(key: ApiKey): ApiKeyPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key_hash, ...rest } = key;
  return rest;
}

// GET — list all keys for the site (never returns full key value)
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
    .from('api_keys')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    keys: (data || []).map((k) => toPublic(k as ApiKey)),
  });
}

// POST — create a new key. Returns the FULL key once (never shown again).
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
  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { fullKey, keyPrefix, keyHash } = generateApiKey();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('api_keys')
    .insert({
      site_id: siteId,
      organization_id: access.siteOrgId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_by: access.caller.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  return NextResponse.json({
    key: toPublic(data as ApiKey),
    fullKey, // shown once
    warning: 'Store this key now. It will never be shown again.',
  });
}

// DELETE — revoke a key
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
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
