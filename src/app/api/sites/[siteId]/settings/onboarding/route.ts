import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

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
    triggerBuild,
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

  // Trigger content generation if requested (after onboarding completion or skip)
  if (triggerBuild) {
    // Only trigger if site hasn't already started building
    const { data: currentSite } = await adminSupabase
      .from('sites')
      .select('status')
      .eq('id', siteId)
      .single();

    if (currentSite && currentSite.status === 'building') {
      // Check if build_progress has any completed tasks — if so, build already started
      const { data: siteWithProgress } = await adminSupabase
        .from('sites')
        .select('build_progress')
        .eq('id', siteId)
        .single();

      const bp = siteWithProgress?.build_progress as { completed_tasks?: number } | null;
      if (!bp || !bp.completed_tasks || bp.completed_tasks === 0) {
        // Capture Google access token for review fetching
        const { data: { session } } = await supabase.auth.getSession();
        const googleAccessToken = session?.provider_token || null;

        await inngest.send({
          name: 'site/content.generate',
          data: { siteId, googleAccessToken },
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
