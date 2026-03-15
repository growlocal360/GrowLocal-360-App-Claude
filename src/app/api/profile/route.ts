import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Return current user's profile
export async function GET() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, title, role, show_on_site, display_order')
    .eq('id', caller.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

// PATCH - Update profile fields (full_name, bio, title)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrgId();
  const caller = await getCallerProfile(supabase, activeOrgId);

  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { full_name, bio, title, show_on_site, display_order } = body;

  const updates: Record<string, string | boolean | number | null> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (bio !== undefined) updates.bio = bio;
  if (title !== undefined) updates.title = title;
  if (show_on_site !== undefined) updates.show_on_site = show_on_site;
  if (display_order !== undefined) updates.display_order = display_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .update(updates)
    .eq('id', caller.id)
    .select('id, full_name, avatar_url, bio, title, role, show_on_site, display_order')
    .single();

  if (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
