import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerProfile, hasRole } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE, ASSET_BUCKET } from '@/lib/assets/types';
import { slugifyFilename } from '@/lib/assets/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const { staffId } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(caller, 'owner', 'admin')) {
    return NextResponse.json({ error: 'Only owners and admins can upload staff photos' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verify staff belongs to same org
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, full_name')
    .eq('id', staffId)
    .eq('organization_id', caller.organization_id)
    .single();

  if (!staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
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

  const nameSlug = slugifyFilename(staff.full_name);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `avatar-${nameSlug}.${ext}`;
  const storagePath = `avatars/staff/${staffId}/${filename}`;

  // Delete existing avatar files
  const { data: existingFiles } = await admin.storage
    .from(ASSET_BUCKET)
    .list(`avatars/staff/${staffId}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `avatars/staff/${staffId}/${f.name}`);
    await admin.storage.from(ASSET_BUCKET).remove(filesToDelete);
  }

  // Upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from(ASSET_BUCKET)
    .getPublicUrl(storagePath);

  // Update staff member
  await admin
    .from('staff_members')
    .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', staffId);

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
