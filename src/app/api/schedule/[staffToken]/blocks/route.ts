import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ staffToken: string }>;
}

/**
 * POST /api/schedule/[staffToken]/blocks
 * Staff self-service: add a personal time block
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { staffToken } = await params;

  try {
    const supabase = createAdminClient();

    // Verify staff member
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id')
      .eq('schedule_token', staffToken)
      .eq('is_active', true)
      .single();

    if (!staffMember) {
      return NextResponse.json({ error: 'Invalid schedule link' }, { status: 404 });
    }

    const body = await request.json();
    const { block_date, start_time, end_time, reason } = body;

    if (!block_date) {
      return NextResponse.json({ error: 'block_date is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('staff_time_blocks')
      .insert({
        staff_member_id: staffMember.id,
        block_date,
        start_time: start_time || null,
        end_time: end_time || null,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create block:', error);
      return NextResponse.json({ error: 'Failed to create block' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/schedule/[staffToken]/blocks?blockId=xxx
 * Staff self-service: remove a personal time block
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { staffToken } = await params;
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('blockId');

  if (!blockId) {
    return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id')
      .eq('schedule_token', staffToken)
      .eq('is_active', true)
      .single();

    if (!staffMember) {
      return NextResponse.json({ error: 'Invalid schedule link' }, { status: 404 });
    }

    const { error } = await supabase
      .from('staff_time_blocks')
      .delete()
      .eq('id', blockId)
      .eq('staff_member_id', staffMember.id);

    if (error) {
      console.error('Failed to delete block:', error);
      return NextResponse.json({ error: 'Failed to delete block' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
