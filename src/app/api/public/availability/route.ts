import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getAvailableSlots,
  getAvailabilityRange,
  aggregateSlotsForPublic,
} from '@/lib/scheduling/availability';
import type {
  SchedulingConfig,
  StaffSchedule,
  StaffTimeBlock,
  StaffServiceArea,
  Appointment,
  DateOverride,
} from '@/types/database';

/**
 * GET /api/public/availability
 * Public endpoint — returns available slots for a given date or date range
 * Query params: siteId, date (single day), days (range from date), zip, city
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const date = searchParams.get('date');
  const days = searchParams.get('days');
  const zip = searchParams.get('zip');
  const city = searchParams.get('city');

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // Get scheduling config
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .single();

    if (!config) {
      return NextResponse.json({
        active: false,
        message: 'Scheduling not enabled for this site',
      });
    }

    const typedConfig = config as SchedulingConfig;

    // Get all staff assigned to this site
    const { data: staffAssignments } = await supabase
      .from('staff_site_assignments')
      .select('staff_member_id')
      .eq('site_id', siteId);

    const allStaffIds = (staffAssignments || []).map(a => a.staff_member_id);

    if (allStaffIds.length === 0) {
      return NextResponse.json({
        active: true,
        spotsRemaining: 0,
        availableSlots: [],
        message: 'No staff configured',
      });
    }

    // Fetch all scheduling data in parallel
    const [
      { data: staffSchedules },
      { data: staffBlocks },
      { data: staffAreas },
      { data: overrides },
    ] = await Promise.all([
      supabase
        .from('staff_schedules')
        .select('*')
        .eq('scheduling_config_id', typedConfig.id)
        .in('staff_member_id', allStaffIds),
      supabase
        .from('staff_time_blocks')
        .select('*')
        .in('staff_member_id', allStaffIds),
      supabase
        .from('staff_service_areas')
        .select('*')
        .eq('site_id', siteId),
      supabase
        .from('date_overrides')
        .select('*')
        .eq('scheduling_config_id', typedConfig.id),
    ]);

    const options = {
      city: city || undefined,
      zipCode: zip || undefined,
    };

    // Range query (for calendar widget)
    if (days && date) {
      const numDays = Math.min(parseInt(days, 10) || 14, 60);

      // Get appointments for the date range
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + numDays);
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('site_id', siteId)
        .gte('scheduled_date', date)
        .lte('scheduled_date', endDateStr)
        .not('status', 'in', '("cancelled","no_show")');

      const range = getAvailabilityRange(
        typedConfig,
        (staffSchedules || []) as StaffSchedule[],
        (staffBlocks || []) as StaffTimeBlock[],
        (staffAreas || []) as StaffServiceArea[],
        (appointments || []) as Appointment[],
        date,
        numDays,
        (overrides || []) as DateOverride[],
        allStaffIds,
        options
      );

      return NextResponse.json({
        active: true,
        range: range.map(day => ({
          date: day.date,
          spotsRemaining: day.spotsRemaining,
          isBlocked: day.isBlocked,
          slots: aggregateSlotsForPublic(day.availableSlots),
        })),
      });
    }

    // Single day query
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('site_id', siteId)
      .eq('scheduled_date', targetDate)
      .not('status', 'in', '("cancelled","no_show")');

    const summary = getAvailableSlots(
      typedConfig,
      (staffSchedules || []) as StaffSchedule[],
      (staffBlocks || []) as StaffTimeBlock[],
      (staffAreas || []) as StaffServiceArea[],
      (appointments || []) as Appointment[],
      targetDate,
      (overrides || []) as DateOverride[],
      allStaffIds,
      options
    );

    return NextResponse.json({
      active: true,
      date: targetDate,
      spotsRemaining: summary.spotsRemaining,
      totalCapacity: summary.totalCapacity,
      isBlocked: summary.isBlocked,
      slots: aggregateSlotsForPublic(summary.availableSlots),
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
