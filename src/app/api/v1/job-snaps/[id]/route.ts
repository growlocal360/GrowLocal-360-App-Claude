import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractApiKey, verifyApiKey } from '@/lib/api-keys/keys';
import { serializeJobSnapPublic } from '@/lib/api-keys/serialize-snap';
import type { JobSnapWithRelations } from '@/types/database';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers || {}) },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawKey = extractApiKey(req.headers);
  if (!rawKey) return jsonResponse({ error: 'Missing API key.' }, { status: 401 });

  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) return jsonResponse({ error: 'Invalid API key.' }, { status: 401 });
  if (!apiKey.scopes.includes('jobsnaps:read')) {
    return jsonResponse({ error: 'API key lacks jobsnaps:read scope.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('job_snaps')
    .select('*, media:job_snap_media(*), technician:profiles!technician_id(id, full_name, title, avatar_url), attachments:job_snap_attachments(target_type, target_id)')
    .eq('id', id)
    .eq('site_id', apiKey.site_id)
    .eq('is_published_to_website', true)
    .maybeSingle();

  if (error) return jsonResponse({ error: 'Failed to fetch snap.' }, { status: 500 });
  if (!data) return jsonResponse({ error: 'Snap not found.' }, { status: 404 });

  return jsonResponse({ data: serializeJobSnapPublic(data as JobSnapWithRelations) });
}
