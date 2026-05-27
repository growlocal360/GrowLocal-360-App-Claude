import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setActiveOrgId } from '@/lib/auth/active-org';

/**
 * POST /api/organizations
 * Self-service organization creation for any logged-in user.
 *
 * Lets a stranded (zero-profile) user — or an active team member who wants
 * their own separate business — create an organization they own, without
 * touching their membership in anyone else's team. The new org becomes their
 * active org (cookie) so they land in it.
 *
 * Mirrors the new-user branch of handle_new_user() (migration 023) but for an
 * already-authenticated user. Marks the org auto_created = false so the
 * invite-acceptance cleanup never sweeps it away.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedName = typeof body?.name === 'string' ? body.name.trim() : '';

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const orgName =
    requestedName ||
    fullName ||
    user.email?.split('@')[0] ||
    'My Business';

  // slug: lowercased, non-alphanumerics → hyphens, + random suffix for global uniqueness
  const baseSlug =
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'business';
  const slug = `${baseSlug}-${Math.random().toString(16).slice(2, 8)}`;

  const adminSupabase = createAdminClient();

  // Create the organization (deliberate → auto_created false)
  const { data: org, error: orgError } = await adminSupabase
    .from('organizations')
    .insert({ name: orgName, slug, auto_created: false })
    .select('id')
    .single();

  if (orgError || !org) {
    console.error('[organizations] Failed to create org:', orgError);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }

  // Create the owner profile for this user in the new org
  const { error: profileError } = await adminSupabase
    .from('profiles')
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: 'owner',
      full_name: fullName || null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) || null,
    });

  if (profileError) {
    console.error('[organizations] Failed to create owner profile:', profileError);
    // Roll back the org so we don't leave an ownerless org behind
    await adminSupabase.from('organizations').delete().eq('id', org.id);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }

  // Make the new org the active context so they land in it
  await setActiveOrgId(org.id);

  console.log('[organizations] Created org', { orgId: org.id, userId: user.id });

  return NextResponse.json({ success: true, organizationId: org.id }, { status: 201 });
}
