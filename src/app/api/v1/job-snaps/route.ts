import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractApiKey, verifyApiKey } from '@/lib/api-keys/keys';
import { serializeJobSnapPublic } from '@/lib/api-keys/serialize-snap';
import type { JobSnapWithRelations } from '@/types/database';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
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

/**
 * GET /api/v1/job-snaps
 *
 * Public REST endpoint — auth via API key.
 * Returns published Job Snaps for the site that owns the key.
 *
 * Query params:
 *   limit  (default 20, max 100)
 *   offset (default 0)
 *   brand  (optional, exact match)
 *   service_type (optional, exact match)
 */
export async function GET(req: NextRequest) {
  const rawKey = extractApiKey(req.headers);
  if (!rawKey) {
    return jsonResponse(
      { error: 'Missing API key. Send via X-API-Key header or Authorization: Bearer <key>.' },
      { status: 401 }
    );
  }

  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) {
    return jsonResponse({ error: 'Invalid or revoked API key.' }, { status: 401 });
  }

  if (!apiKey.scopes.includes('jobsnaps:read')) {
    return jsonResponse({ error: 'API key lacks jobsnaps:read scope.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const brand = url.searchParams.get('brand');
  const serviceType = url.searchParams.get('service_type');

  const supabase = createAdminClient();
  let query = supabase
    .from('job_snaps')
    .select(
      '*, media:job_snap_media(*), technician:profiles!technician_id(id, full_name, title, avatar_url)',
      { count: 'exact' }
    )
    .eq('site_id', apiKey.site_id)
    .eq('is_published_to_website', true)
    .order('deployed_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (brand) query = query.eq('brand', brand);
  if (serviceType) query = query.eq('service_type', serviceType);

  const { data, count, error } = await query;

  if (error) {
    return jsonResponse({ error: 'Failed to fetch snaps.' }, { status: 500 });
  }

  const snaps = (data || []).map((s) => serializeJobSnapPublic(s as JobSnapWithRelations));

  return jsonResponse({
    data: snaps,
    pagination: {
      total: count ?? snaps.length,
      limit,
      offset,
      has_more: (count ?? 0) > offset + snaps.length,
    },
  });
}
