import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateSiteContent } from '@/lib/inngest/functions/generate-site-content';
import {
  handleBookingCreated,
  handleBookingApproved,
  handleBookingDeclined,
  sendReminders,
  dailyScheduleDigest,
} from '@/lib/inngest/functions/booking-notifications';
import { publishAvailability } from '@/lib/inngest/functions/publish-availability';
import { dispatchWebhook, deliverWebhook } from '@/lib/inngest/functions/deliver-webhook';
import { deliverHighLevel } from '@/lib/inngest/functions/deliver-highlevel';
import { handleLeadCreated } from '@/lib/inngest/functions/lead-notifications';
import { ensureSiteBuild } from '@/lib/inngest/functions/ensure-site-build';
import { reviewAutomation } from '@/lib/inngest/functions/review-automation';
import { appointmentCompletedReviewRequest, reviewRequestFollowUps } from '@/lib/inngest/functions/review-requests';
import { gbpAutomationDaily, gbpAutomationRequested } from '@/lib/inngest/functions/gbp-automation';
import { monthlyReports, monthlyReportRequested } from '@/lib/inngest/functions/monthly-report';
import { weeklyDigest, profileWatchNightly } from '@/lib/inngest/functions/digest-and-watch';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateSiteContent,
    handleBookingCreated,
    handleBookingApproved,
    handleBookingDeclined,
    sendReminders,
    dailyScheduleDigest,
    publishAvailability,
    dispatchWebhook,
    deliverWebhook,
    deliverHighLevel,
    handleLeadCreated,
    ensureSiteBuild,
    reviewAutomation,
    appointmentCompletedReviewRequest,
    reviewRequestFollowUps,
    gbpAutomationDaily,
    gbpAutomationRequested,
    monthlyReports,
    monthlyReportRequested,
    weeklyDigest,
    profileWatchNightly,
  ],
});
