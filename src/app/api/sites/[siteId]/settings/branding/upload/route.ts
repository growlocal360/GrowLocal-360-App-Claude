import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get site and verify ownership
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Verify user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse the multipart form data
  const formData = await request.formData();
  const file = formData.get('logo') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPG, WEBP' },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5MB' },
      { status: 400 }
    );
  }

  // Generate file path
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `logo.${fileExt}`;
  const filePath = `sites/${siteId}/${fileName}`;

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check if there's an existing logo to delete
  const { data: existingFiles } = await supabase.storage
    .from('site-logos')
    .list(`sites/${siteId}`);

  if (existingFiles && existingFiles.length > 0) {
    // Delete existing logo files
    const filesToDelete = existingFiles.map((f) => `sites/${siteId}/${f.name}`);
    await supabase.storage.from('site-logos').remove(filesToDelete);
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('site-logos')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Failed to upload logo:', uploadError);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('site-logos')
    .getPublicUrl(filePath);

  return NextResponse.json({
    success: true,
    url: urlData.publicUrl,
  });
}
