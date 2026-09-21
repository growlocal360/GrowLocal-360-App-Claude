import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { uploadAsset } from '@/lib/assets/upload';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/assets/types';

// Upload the featured-person headshot. Returns a clean /public/assets/... path
// the caller then saves via PATCH /settings/about-person.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPG, WEBP, SVG' },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
  }

  try {
    const result = await uploadAsset({ siteId, assetType: 'site_asset', file });
    return NextResponse.json({ success: true, url: `/public/${result.publicPath}` });
  } catch (err) {
    console.error('Failed to upload featured-person photo:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
