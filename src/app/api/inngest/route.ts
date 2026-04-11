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
  ],
});
