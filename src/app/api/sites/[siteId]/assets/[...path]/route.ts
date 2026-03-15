import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/assets/types';

/**
 * Dashboard asset proxy — serves site assets for admin preview.
 * Request: GET /api/sites/{siteId}/assets/brand/logo.svg
 * Looks up the asset in the DB, fetches from Supabase storage.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; path: string[] }> }
) {
  const { siteId, path } = await params;
  const publicPath = `assets/${path.join('/')}`;

  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Look up the asset by site_id + public_path
  const { data: asset } = await adminSupabase
    .from('assets')
    .select('storage_path, content_type')
    .eq('site_id', siteId)
    .eq('public_path', publicPath)
    .single();

  if (asset) {
    const { data: fileData, error } = await adminSupabase.storage
      .from(ASSET_BUCKET)
      .download(asset.storage_path);

    if (!error && fileData) {
      const arrayBuffer = await fileData.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': asset.content_type,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  // Fallback: try legacy site-logos bucket
  if (path[0] === 'brand') {
    const filename = path.slice(1).join('/');
    const { data: legacyData } = await adminSupabase.storage
      .from('site-logos')
      .download(`sites/${siteId}/${filename}`);

    if (legacyData) {
      const arrayBuffer = await legacyData.arrayBuffer();
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      };
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  return new NextResponse('Not Found', { status: 404 });
}
