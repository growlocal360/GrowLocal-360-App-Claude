import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current site and verify ownership
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*, organization:organizations!inner(profiles!inner(user_id))')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Verify user has access to this site's organization
  const hasAccess = site.organization?.profiles?.some(
    (p: { user_id: string }) => p.user_id === user.id
  );

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  // Reset site status to building
  const { error: updateError } = await supabase
    .from('sites')
    .update({
      status: 'building',
      build_progress: {
        total_tasks: totalTasks,
        completed_tasks: 0,
        current_task: 'Restarting content generation...',
        started_at: new Date().toISOString(),
      },
      status_message: null,
      status_updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to reset site status:', updateError);
    return NextResponse.json(
      { error: 'Failed to reset status' },
      { status: 500 }
    );
  }

  // Trigger background content generation
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/sites/${siteId}/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch((err) => {
      console.error('Failed to trigger content generation:', err);
    });
  } catch {
    console.error('Failed to trigger content generation');
  }

  return NextResponse.json({
    success: true,
    message: 'Build retry started',
    totalTasks,
  });
}
