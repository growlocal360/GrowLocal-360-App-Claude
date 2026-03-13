import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import type { SiteStatus } from '@/types/database';

// Valid status transitions
const VALID_TRANSITIONS: Record<SiteStatus, SiteStatus[]> = {
  building: [], // Cannot manually change while building
  active: ['paused', 'archived'], // Can pause or archive an active site
  paused: ['active', 'archived'], // Can resume or archive a paused site
  failed: ['building', 'archived'], // Can retry a failed build or archive
  suspended: [], // Only admins can change suspended status
  archived: ['active'], // Can restore an archived site
};

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
  const caller = access.caller!;

  // Parse request body
  const body = await request.json();
  const newStatus = body.status as SiteStatus;

  if (!newStatus) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 });
  }

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, status')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Owner-only actions: pause and archive
  if (newStatus === 'paused' || newStatus === 'archived') {
    if (caller.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the account owner can pause or archive sites' },
        { status: 403 }
      );
    }
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
      status_message: newStatus === 'paused' ? 'Paused by user' : newStatus === 'archived' ? 'Archived by user' : null,
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

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
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
