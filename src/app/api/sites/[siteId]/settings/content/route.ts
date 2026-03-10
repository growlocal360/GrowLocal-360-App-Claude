import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Fetch content generation settings
export async function GET(
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;

  return NextResponse.json({
    toneValues: settings.tone_values || [],
    pointOfView: settings.point_of_view || '',
    wordsToUse: settings.words_to_use || '',
    wordsToAvoid: settings.words_to_avoid || '',
    targetAudience: settings.target_audience || '',
    writingSamples: settings.writing_samples || '',
    onboardingNotes: settings.onboarding_notes || '',
    specificRequests: settings.specific_requests || '',
  });
}

// PATCH - Update content generation settings
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
    toneValues,
    pointOfView,
    wordsToUse,
    wordsToAvoid,
    targetAudience,
    writingSamples,
    onboardingNotes,
    specificRequests,
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;
  const updatedSettings = {
    ...currentSettings,
    ...(toneValues !== undefined && { tone_values: toneValues }),
    ...(pointOfView !== undefined && { point_of_view: pointOfView }),
    ...(wordsToUse !== undefined && { words_to_use: wordsToUse }),
    ...(wordsToAvoid !== undefined && { words_to_avoid: wordsToAvoid }),
    ...(targetAudience !== undefined && { target_audience: targetAudience }),
    ...(writingSamples !== undefined && { writing_samples: writingSamples }),
    ...(onboardingNotes !== undefined && { onboarding_notes: onboardingNotes }),
    ...(specificRequests !== undefined && { specific_requests: specificRequests }),
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
    console.error('Failed to update content settings:', updateError);
    return NextResponse.json(
      { error: 'Failed to update content settings' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
