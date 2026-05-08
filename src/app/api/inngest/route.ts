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
  ],
});
