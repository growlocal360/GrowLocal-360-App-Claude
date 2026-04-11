import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { GBPClient } from '@/lib/google/gbp-client';
import { generateAvailabilityPost } from '@/lib/scheduling/availability-publisher';
import { getAvailableSlots } from '@/lib/scheduling/availability';
import type {
  SchedulingConfig,
  StaffSchedule,
  StaffTimeBlock,
  StaffServiceArea,
  Appointment,
  DateOverride,
} from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retrieves a Google token from social_connections, refreshing if expired.
 * Duplicated from generate-site-content.ts for module independence.
 */
async function getStoredGoogleToken(
  supabase: SupabaseClient,
  siteId: string
): Promise<string | null> {
  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('site_id', siteId)
    .eq('platform', 'google_business')
    .eq('is_active', true)
    .single();

  if (!connection) return null;

  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at).getTime();
    const bufferMs = 5 * 60 * 1000;
    if (expiresAt - bufferMs > Date.now()) {
      return connection.access_token;
    }
  }

  if (connection.refresh_token) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) return null;
      const { access_token, expires_in } = await res.json();

      await supabase
        .from('social_connections')
        .update({
          access_token,
          token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('site_id', siteId)
        .eq('platform', 'google_business');

      return access_token;
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================================
// Cron: Publish availability to GBP
// Runs every 30 minutes, checks if any site needs a post at this time
// ============================================================
export const publishAvailability = inngest.createFunction(
  { id: 'scheduling-publish-availability', name: 'Publish Availability to GBP' },
  { cron: '*/30 * * * *' }, // Every 30 minutes — checks configured publish times
  async ({ step }) => {
    const supabase = createAdminClient();
    const now = new Date();

    // Get all active configs with auto-publish enabled
    const { data: configs } = await step.run('fetch-configs', async () => {
      return supabase
        .from('scheduling_configs')
        .select('*, site:sites(id, name, slug, settings, custom_domain)')
        .eq('is_active', true)
        .eq('auto_publish_availability', true);
    });

    if (!configs || configs.length === 0) return;

    for (const config of configs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const siteData = config.site as any;
      if (!siteData) continue;

      const typedConfig = config as unknown as SchedulingConfig;
      const siteTimezone = config.timezone || 'America/New_York';

      // Get current time in the site's local timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: siteTimezone,
        hour: '2-digit', minute: '2-digit', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short',
      });
      const parts = Object.fromEntries(
        formatter.formatToParts(now).map(p => [p.type, p.value])
      );
      const localHour = parts.hour;
      const localMinute = parseInt(parts.minute, 10);
      const roundedMinute = localMinute < 15 ? '00' : localMinute < 45 ? '30' : '00';
      const localTime = `${localHour}:${roundedMinute}`;
      const todayStr = `${parts.year}-${parts.month}-${parts.day}`;

      const weekdayMap: Record<string, string> = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' };
      const todayDay = weekdayMap[parts.weekday] || 'mon';
      const todayDayFull = new Intl.DateTimeFormat('en-US', { timeZone: siteTimezone, weekday: 'long' }).format(now);

      // Check if today is a publish day
      const publishDays = (config.publish_days || []) as string[];
      if (!publishDays.includes(todayDay)) continue;

      // Check if current local time matches a configured publish time
      const publishTimes = (config.publish_times || []) as string[];
      const shouldPublishNow = publishTimes.some(time => time === localTime);

      // Check if we already posted today
      const { data: existingPost } = await supabase
        .from('availability_posts')
        .select('id')
        .eq('site_id', siteData.id)
        .eq('posted_date', todayStr)
        .eq('status', 'published')
        .limit(publishTimes.length);

      const postsToday = existingPost?.length || 0;

      if (!shouldPublishNow || postsToday >= publishTimes.length) continue;

      // Calculate availability
      const siteId = siteData.id;

      const availData = await step.run(`calc-availability-${siteId}`, async () => {
        const { data: staffAssignments } = await supabase
          .from('staff_site_assignments')
          .select('staff_member_id')
          .eq('site_id', siteId);

        const allStaffIds = (staffAssignments || []).map(a => a.staff_member_id);
        if (allStaffIds.length === 0) return null;

        const [
          { data: staffSchedules },
          { data: staffBlocks },
          { data: staffAreas },
          { data: overrides },
          { data: appointments },
        ] = await Promise.all([
          supabase.from('staff_schedules').select('*').eq('scheduling_config_id', config.id).in('staff_member_id', allStaffIds),
          supabase.from('staff_time_blocks').select('*').in('staff_member_id', allStaffIds).eq('block_date', todayStr),
          supabase.from('staff_service_areas').select('*').eq('site_id', siteId),
          supabase.from('date_overrides').select('*').eq('scheduling_config_id', config.id),
          supabase.from('appointments').select('*').eq('site_id', siteId).eq('scheduled_date', todayStr).not('status', 'in', '("cancelled","no_show")'),
        ]);

        const summary = getAvailableSlots(
          typedConfig,
          (staffSchedules || []) as StaffSchedule[],
          (staffBlocks || []) as StaffTimeBlock[],
          (staffAreas || []) as StaffServiceArea[],
          (appointments || []) as Appointment[],
          todayStr,
          (overrides || []) as DateOverride[],
          allStaffIds,
        );

        return { spotsRemaining: summary.spotsRemaining };
      });

      if (!availData) continue;

      // Get GBP location info
      const gbpData = await step.run(`get-gbp-info-${siteId}`, async () => {
        const { data: location } = await supabase
          .from('locations')
          .select('gbp_account_id, gbp_location_id, city')
          .eq('site_id', siteId)
          .eq('is_primary', true)
          .single();

        if (!location?.gbp_account_id || !location?.gbp_location_id) return null;

        const token = await getStoredGoogleToken(supabase, siteId);
        if (!token) return null;

        return {
          accountName: location.gbp_account_id.startsWith('accounts/')
            ? location.gbp_account_id
            : `accounts/${location.gbp_account_id}`,
          locationName: location.gbp_location_id.startsWith('locations/')
            ? location.gbp_location_id
            : `locations/${location.gbp_location_id}`,
          city: location.city || '',
          token,
        };
      });

      if (!gbpData) {
        // Log as failed — no GBP connection
        await step.run(`log-failed-${siteId}`, async () => {
          await supabase.from('availability_posts').insert({
            site_id: siteId,
            platform: 'google_business',
            post_content: 'Failed: No GBP connection',
            spots_available: availData.spotsRemaining,
            posted_date: todayStr,
            status: 'failed',
            error_message: 'No GBP connection or expired token',
          });
        });
        continue;
      }

      // Generate the post content
      const settings = siteData.settings as Record<string, string> || {};
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
      const siteUrl = siteData.custom_domain
        ? `https://${siteData.custom_domain}`
        : `https://${siteData.slug}.${appDomain}`;
      const serviceName = settings.core_industry || 'service';
      const phone = settings.phone || '';

      const postContent = generateAvailabilityPost({
        spotsAvailable: availData.spotsRemaining,
        serviceName,
        city: gbpData.city,
        phone,
        siteUrl,
        dayName: todayDayFull,
      });

      // Publish to GBP
      const result = await step.run(`publish-gbp-${siteId}`, async () => {
        try {
          const gbpClient = new GBPClient(gbpData.token);
          const post = await gbpClient.createLocalPost(
            gbpData.accountName,
            gbpData.locationName,
            {
              languageCode: 'en',
              summary: postContent,
              callToAction: {
                actionType: 'BOOK',
                url: `${siteUrl}/contact`,
              },
            }
          );
          return { success: true as const, postId: post.name };
        } catch (error) {
          return { success: false as const, error: String(error) };
        }
      });

      // Log the result
      await step.run(`log-result-${siteId}`, async () => {
        await supabase.from('availability_posts').insert({
          site_id: siteId,
          platform: 'google_business',
          post_content: postContent,
          spots_available: availData.spotsRemaining,
          posted_date: todayStr,
          external_post_id: result.success ? result.postId : null,
          status: result.success ? 'published' : 'failed',
          error_message: result.success ? null : result.error,
        });
      });
    }
  }
);
