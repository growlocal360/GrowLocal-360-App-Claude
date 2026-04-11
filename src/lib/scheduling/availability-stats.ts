/**
 * Availability stats that feed back into site content.
 * These power trust signals like "Same-day service available 94% of days".
 */

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Calculate the percentage of days in the last N days
 * where same-day spots were available.
 */
export async function getSameDayAvailabilityRate(
  siteId: string,
  lookbackDays = 30
): Promise<number> {
  const supabase = createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get availability posts that had spots > 0
  const { data: posts } = await supabase
    .from('availability_posts')
    .select('posted_date, spots_available')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .gte('posted_date', startDateStr);

  if (!posts || posts.length === 0) return 0;

  // Count unique days that had availability
  const daysWithAvailability = new Set(
    posts.filter(p => p.spots_available > 0).map(p => p.posted_date)
  );

  // Total unique days we posted
  const totalDays = new Set(posts.map(p => p.posted_date)).size;

  if (totalDays === 0) return 0;
  return Math.round((daysWithAvailability.size / totalDays) * 100);
}

/**
 * Get total completed bookings for a site.
 * Social proof counter for the public site.
 */
export async function getTotalBookingsCompleted(siteId: string): Promise<number> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'completed');

  return count || 0;
}

/**
 * Get average spots available per day over the last N days.
 * Useful for content like "We typically have X openings per day".
 */
export async function getAverageDailySpots(
  siteId: string,
  lookbackDays = 30
): Promise<number> {
  const supabase = createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get the first post of each day (morning count = most accurate)
  const { data: posts } = await supabase
    .from('availability_posts')
    .select('posted_date, spots_available')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .gte('posted_date', startDateStr)
    .order('created_at', { ascending: true });

  if (!posts || posts.length === 0) return 0;

  // Group by date, take the first (morning) post per day
  const dailySpots = new Map<string, number>();
  for (const post of posts) {
    if (!dailySpots.has(post.posted_date)) {
      dailySpots.set(post.posted_date, post.spots_available);
    }
  }

  const total = Array.from(dailySpots.values()).reduce((sum, v) => sum + v, 0);
  return Math.round(total / dailySpots.size);
}
