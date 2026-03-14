import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/assets/types';

/**
 * Public asset proxy — serves clean URLs for site assets.
 * Request: GET /sites/{slug}/public/assets/brand/logo.svg
 * Looks up the asset in the DB, fetches from Supabase storage,
 * returns with long cache headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path } = await params;
  const publicPath = path.join('/');

  const adminSupabase = createAdminClient();

  // Look up the site by slug
  const { data: sites } = await adminSupabase
    .from('sites')
    .select('id')
    .eq('slug', slug)
    .limit(1);

  const site = sites?.[0];
  if (!site) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Look up the asset by site_id + public_path
  const { data: asset } = await adminSupabase
    .from('assets')
    .select('storage_path, content_type')
    .eq('site_id', site.id)
    .eq('public_path', publicPath)
    .single();

  if (!asset) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Fetch the file from Supabase storage
  const { data: fileData, error } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .download(asset.storage_path);

  if (error || !fileData) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const arrayBuffer = await fileData.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': asset.content_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
