import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import type { GenerationScope } from '@/types/database';

const VALID_SCOPE_TYPES = ['full', 'core-pages', 'services', 'categories', 'service-areas', 'brands', 'neighborhoods', 'reviews'] as const;

/**
 * POST /api/sites/[siteId]/generate
 * Triggers selective content generation for specific entities.
 * Body: { scope: GenerationScope }
 */
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

  // Parse and validate scope
  let body: { scope?: GenerationScope };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const scope = body.scope;
  if (!scope || !VALID_SCOPE_TYPES.includes(scope.type as typeof VALID_SCOPE_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid or missing scope.type' }, { status: 400 });
  }

  // Validate that referenced IDs belong to this site
  const validationError = await validateScope(supabase, siteId, scope);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Check site status
  const { data: site } = await supabase
    .from('sites')
    .select('id, status, build_progress')
    .eq('id', siteId)
    .single();

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.status !== 'active' && site.status !== 'failed') {
    return NextResponse.json(
      { error: 'Site must be active or failed to generate content' },
      { status: 400 }
    );
  }

  // Reject if a build is already in progress (prevent duplicate events)
  if (site.build_progress) {
    const { current_task, started_at } = site.build_progress;
    if (current_task !== 'Complete' && current_task !== 'Failed' && started_at) {
      const startedAtMs = new Date(started_at).getTime();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (startedAtMs > fiveMinutesAgo) {
        return NextResponse.json(
          { error: 'A build is already in progress. Please wait for it to complete.' },
          { status: 409 }
        );
      }
    }
  }

  // Calculate total tasks for this scope
  const totalTasks = calculateScopeTasks(scope);

  // Update build progress (don't change site status — keep it active)
  await supabase
    .from('sites')
    .update({
      build_progress: {
        total_tasks: totalTasks,
        completed_tasks: 0,
        current_task: `Generating ${scope.type}...`,
        started_at: new Date().toISOString(),
        scope_type: scope.type,
      },
      status_updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  // Capture Google access token
  const { data: { session } } = await supabase.auth.getSession();
  const googleAccessToken = session?.provider_token || null;

  // Send Inngest event with scope
  await inngest.send({
    name: 'site/content.generate',
    data: {
      siteId,
      googleAccessToken,
      scope,
    },
  });

  return NextResponse.json({
    success: true,
    totalTasks,
    scope: scope.type,
  });
}

function calculateScopeTasks(scope: GenerationScope): number {
  switch (scope.type) {
    case 'full':
      return 0; // Full builds use retry-build route instead
    case 'core-pages':
      return (scope.pages || ['home', 'about', 'contact']).length;
    case 'services':
      return scope.serviceIds.length;
    case 'categories':
      return scope.categoryIds.length;
    case 'service-areas':
      return scope.serviceAreaIds.length;
    case 'brands':
      return scope.brandIds.length;
    case 'neighborhoods':
      return scope.neighborhoodIds.length;
    case 'reviews':
      return 1;
    default:
      return 0;
  }
}

async function validateScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  scope: GenerationScope
): Promise<string | null> {
  switch (scope.type) {
    case 'services': {
      if (!scope.serviceIds?.length) return 'serviceIds required';
      const { count } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('id', scope.serviceIds);
      if (count !== scope.serviceIds.length) return 'Some serviceIds do not belong to this site';
      break;
    }
    case 'categories': {
      if (!scope.categoryIds?.length) return 'categoryIds required';
      const { count } = await supabase
        .from('site_categories')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('id', scope.categoryIds);
      if (count !== scope.categoryIds.length) return 'Some categoryIds do not belong to this site';
      break;
    }
    case 'service-areas': {
      if (!scope.serviceAreaIds?.length) return 'serviceAreaIds required';
      const { count } = await supabase
        .from('service_areas')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('id', scope.serviceAreaIds);
      if (count !== scope.serviceAreaIds.length) return 'Some serviceAreaIds do not belong to this site';
      break;
    }
    case 'brands': {
      if (!scope.brandIds?.length) return 'brandIds required';
      const { count } = await supabase
        .from('site_brands')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('id', scope.brandIds);
      if (count !== scope.brandIds.length) return 'Some brandIds do not belong to this site';
      break;
    }
    case 'neighborhoods': {
      if (!scope.neighborhoodIds?.length) return 'neighborhoodIds required';
      const { count } = await supabase
        .from('neighborhoods')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('id', scope.neighborhoodIds);
      if (count !== scope.neighborhoodIds.length) return 'Some neighborhoodIds do not belong to this site';
      break;
    }
    // core-pages, reviews, full don't need ID validation
  }
  return null;
}
