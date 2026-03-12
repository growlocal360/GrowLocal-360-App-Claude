import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// PATCH - Save onboarding fields (merges into site.settings without overwriting)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organization = site.organization as any;
  const profiles = organization?.profiles || [];
  const hasAccess = Array.isArray(profiles)
    ? profiles.some((p: { user_id: string }) => p.user_id === user.id)
    : false;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    businessDescription,
    credentials,
    targetAudience,
    pointOfView,
    toneValues,
    localDetails,
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    ...(businessDescription !== undefined && { business_description: businessDescription }),
    ...(credentials !== undefined && { credentials }),
    ...(targetAudience !== undefined && { target_audience: targetAudience }),
    ...(pointOfView !== undefined && { point_of_view: pointOfView }),
    ...(toneValues !== undefined && { tone_values: toneValues }),
    ...(localDetails !== undefined && { local_details: localDetails }),
    onboarding_completed: true,
  };

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('sites')
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to save onboarding data:', updateError);
    return NextResponse.json(
      { error: 'Failed to save onboarding data' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
