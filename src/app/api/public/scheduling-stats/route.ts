import { NextRequest, NextResponse } from 'next/server';
import { getSameDayAvailabilityRate, getTotalBookingsCompleted, getAverageDailySpots } from '@/lib/scheduling/availability-stats';

/**
 * GET /api/public/scheduling-stats?siteId=xxx
 * Returns scheduling trust signals for the public site.
 * Only returns data when there's meaningful history.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const [sameDayRate, totalBookings, avgDailySpots] = await Promise.all([
    getSameDayAvailabilityRate(siteId),
    getTotalBookingsCompleted(siteId),
    getAverageDailySpots(siteId),
  ]);

  return NextResponse.json({
    sameDayRate,       // e.g. 94 (percent)
    totalBookings,     // e.g. 127
    avgDailySpots,     // e.g. 5
  });
}
