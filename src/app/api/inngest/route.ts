import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateSiteContent } from '@/lib/inngest/functions/generate-site-content';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateSiteContent],
});
