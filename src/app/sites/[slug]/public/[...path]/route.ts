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

  // Avatars are not in the assets table — fetch directly from storage
  // Path: avatars/{profileId}/{filename}
  if (publicPath.startsWith('avatars/')) {
    const { data: avatarData, error: avatarError } = await adminSupabase.storage
      .from(ASSET_BUCKET)
      .download(publicPath);

    if (!avatarError && avatarData) {
      const arrayBuffer = await avatarData.arrayBuffer();
      const ext = publicPath.split('.').pop()?.toLowerCase() || '';
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
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
  }

  // Look up the asset by site_id + public_path
  const { data: asset } = await adminSupabase
    .from('assets')
    .select('storage_path, content_type')
    .eq('site_id', site.id)
    .eq('public_path', publicPath)
    .single();

  if (asset) {
    // Fetch the file from Supabase storage
    const { data: fileData, error } = await adminSupabase.storage
      .from(ASSET_BUCKET)
      .download(asset.storage_path);

    if (!error && fileData) {
      const arrayBuffer = await fileData.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': asset.content_type,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  // Fallback: try legacy site-logos bucket for old uploads
  if (publicPath.startsWith('assets/brand/')) {
    const filename = publicPath.replace('assets/brand/', '');
    const { data: legacyData } = await adminSupabase.storage
      .from('site-logos')
      .download(`sites/${site.id}/${filename}`);

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
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return new NextResponse('Not Found', { status: 404 });
}
