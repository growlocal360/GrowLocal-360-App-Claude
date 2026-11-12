import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE, ASSET_BUCKET } from '@/lib/assets/types';
import { optimizeImage, imageSlug } from '@/lib/images/optimize';
import { avatarCompanyName } from '@/lib/images/site-context';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner')) {
    return NextResponse.json({ error: 'Only the owner can update member photos' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verify profile belongs to same org
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', profileId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('avatar') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPG, WEBP, SVG' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
  }

  // Resize to the avatar slot, WebP, EXIF stripped; named person-title-company.
  const [{ data: profileRow }, company] = await Promise.all([
    admin.from('profiles').select('title').eq('id', profileId).maybeSingle(),
    avatarCompanyName(admin, caller.organization_id, 'profile_site_assignments', 'profile_id', profileId),
  ]);
  const optimized = await optimizeImage(Buffer.from(await file.arrayBuffer()), { preset: 'avatar', contentType: file.type });
  const stem = profile.full_name
    ? imageSlug([profile.full_name, profileRow?.title, company])
    : `avatar-${profileId.substring(0, 8)}`;
  const filename = `${stem}.${optimized.ext}`;
  const storagePath = `avatars/${profileId}/${filename}`;

  // Delete existing avatar files
  const { data: existingFiles } = await admin.storage
    .from(ASSET_BUCKET)
    .list(`avatars/${profileId}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `avatars/${profileId}/${f.name}`);
    await admin.storage.from(ASSET_BUCKET).remove(filesToDelete);
  }

  // Upload
  const { error: uploadError } = await admin.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, optimized.buffer, {
      contentType: optimized.contentType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from(ASSET_BUCKET)
    .getPublicUrl(storagePath);

  // Update profile
  await admin
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', profileId);

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
