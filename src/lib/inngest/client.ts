import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'growlocal-360',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
