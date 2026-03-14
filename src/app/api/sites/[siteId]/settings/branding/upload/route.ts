import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { uploadAsset } from '@/lib/assets/upload';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/assets/types';
import { revalidateSite } from '@/lib/sites/revalidate';

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

  // Parse the multipart form data
  const formData = await request.formData();
  const file = formData.get('logo') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPG, WEBP, SVG' },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10MB' },
      { status: 400 }
    );
  }

  try {
    // Upload via the asset system — preserves original filename for brand assets
    const result = await uploadAsset({
      siteId,
      assetType: 'brand_asset',
      file,
      preserveFilename: true,
    });

    // Return the clean public path for storage in site settings
    const publicUrl = `/public/${result.publicPath}`;

    // Revalidate public site pages so logo changes appear immediately
    await revalidateSite(siteId);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (err) {
    console.error('Failed to upload logo:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload logo' },
      { status: 500 }
    );
  }
}
