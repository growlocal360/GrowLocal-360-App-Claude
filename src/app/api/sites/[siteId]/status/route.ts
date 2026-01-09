import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SiteStatus } from '@/types/database';

// Valid status transitions
const VALID_TRANSITIONS: Record<SiteStatus, SiteStatus[]> = {
  building: [], // Cannot manually change while building
  active: ['paused'], // Can pause an active site
  paused: ['active'], // Can resume a paused site
  failed: ['building'], // Can retry a failed build (handled by retry-build endpoint)
  suspended: [], // Only admins can change suspended status
};

export async function PATCH(
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

  // Parse request body
  const body = await request.json();
  const newStatus = body.status as SiteStatus;

  if (!newStatus) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 });
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

  // Validate status transition
  const currentStatus = site.status as SiteStatus;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
        allowedTransitions,
      },
      { status: 400 }
    );
  }

  // Update site status
  const { error: updateError } = await supabase
    .from('sites')
    .update({
      status: newStatus,
      status_updated_at: new Date().toISOString(),
      status_message: newStatus === 'paused' ? 'Paused by user' : null,
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update site status:', updateError);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    previousStatus: currentStatus,
    newStatus,
  });
}

// GET - Get current site status
export async function GET(
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

  // Get site status
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, status, build_progress, status_message, status_updated_at')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  return NextResponse.json(site);
}
