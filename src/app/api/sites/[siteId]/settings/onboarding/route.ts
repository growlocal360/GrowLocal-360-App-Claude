import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

// PATCH - Save onboarding fields (merges into site.settings without overwriting)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
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
