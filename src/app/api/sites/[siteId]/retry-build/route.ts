import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';

export async function POST(
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
    .select('id, status, status_updated_at')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Allow retry for failed builds, active sites, or stuck building sites
  const allowedStatuses = ['failed', 'active', 'building'];
  if (!allowedStatuses.includes(site.status)) {
    return NextResponse.json(
      { error: 'Cannot regenerate content for this site status' },
      { status: 400 }
    );
  }

  // For 'building' status, check if it's been stuck for more than 5 minutes
  if (site.status === 'building') {
    const statusUpdatedAt = site.status_updated_at ? new Date(site.status_updated_at) : null;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (statusUpdatedAt && statusUpdatedAt > fiveMinutesAgo) {
      return NextResponse.json(
        { error: 'Build is still in progress. Please wait a few minutes.' },
        { status: 409 }
      );
    }
    // If stuck for more than 5 minutes, allow retry
  }

  // Count total tasks for progress tracking
  const [servicesResult, serviceAreasResult, categoriesResult] = await Promise.all([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('service_areas').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('site_categories').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
  ]);

  const servicesCount = servicesResult.count || 0;
  const serviceAreasCount = serviceAreasResult.count || 0;
  const categoriesCount = categoriesResult.count || 0;
  const corePages = 3; // home, about, contact

  const totalTasks = servicesCount + serviceAreasCount + categoriesCount + corePages;

  // For active sites, keep them live — only set 'building' for failed/stuck builds
  const keepLive = site.status === 'active';
  const updateData: Record<string, unknown> = {
    build_progress: {
      total_tasks: totalTasks,
      completed_tasks: 0,
      current_task: 'Regenerating content...',
      started_at: new Date().toISOString(),
    },
    status_message: null,
    status_updated_at: new Date().toISOString(),
  };
  if (!keepLive) {
    updateData.status = 'building';
  }

  const { error: updateError } = await supabase
    .from('sites')
    .update(updateData)
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to reset site status:', updateError);
    return NextResponse.json(
      { error: 'Failed to reset status' },
      { status: 500 }
    );
  }

  // Capture Google access token for review fetching (only available during user session)
  const { data: { session } } = await supabase.auth.getSession();
  const googleAccessToken = session?.provider_token || null;

  // Trigger Inngest content generation function
  await inngest.send({
    name: 'site/content.generate',
    data: {
      siteId,
      googleAccessToken,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Build retry started',
    totalTasks,
  });
}
