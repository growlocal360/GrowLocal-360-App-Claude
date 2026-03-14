import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { createAdminClient } from '@/lib/supabase/admin';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE, ASSET_BUCKET } from '@/lib/assets/types';
import { slugifyFilename } from '@/lib/assets/types';

// POST - Upload avatar image
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('avatar') as File | null;

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
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10MB' },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Build filename from user's name or ID
  const nameSlug = caller.full_name
    ? slugifyFilename(caller.full_name)
    : caller.id.substring(0, 8);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `avatar-${nameSlug}.${ext}`;

  // Store avatars in a global avatars folder (not site-specific)
  const storagePath = `avatars/${caller.id}/${filename}`;

  // Delete existing avatar files for this user
  const { data: existingFiles } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .list(`avatars/${caller.id}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(
      (f) => `avatars/${caller.id}/${f.name}`
    );
    await adminSupabase.storage.from(ASSET_BUCKET).remove(filesToDelete);
  }

  // Upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Failed to upload avatar:', uploadError);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = adminSupabase.storage
    .from(ASSET_BUCKET)
    .getPublicUrl(storagePath);

  // Update profile
  const { error: updateError } = await adminSupabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', caller.id);

  if (updateError) {
    console.error('Failed to update avatar_url:', updateError);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}

// DELETE - Remove avatar
export async function DELETE() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Delete avatar files from storage
  const { data: existingFiles } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .list(`avatars/${caller.id}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(
      (f) => `avatars/${caller.id}/${f.name}`
    );
    await adminSupabase.storage.from(ASSET_BUCKET).remove(filesToDelete);
  }

  // Clear avatar_url
  await adminSupabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', caller.id);

  return NextResponse.json({ success: true });
}
