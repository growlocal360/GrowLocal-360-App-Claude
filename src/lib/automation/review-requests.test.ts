import { describe, it, expect } from 'vitest';
import { buildReviewRequestMessages, firstNameOf, reviewLinkFor, reviewRequestSettings } from './review-requests';

describe('review requests', () => {
  it('builds the Google write-review link from a Place ID', () => {
    expect(reviewLinkFor('ChIJabc/123')).toBe('https://search.google.com/local/writereview?placeid=ChIJabc%2F123');
  });

  it('uses the first name and names the business in the text', () => {
    const { sms, emailSubject } = buildReviewRequestMessages({ businessName: 'Fix It or Free', customerName: 'Maria Lopez', reviewUrl: 'https://g.co/r' });
    expect(sms.startsWith('Hi Maria, ')).toBe(true);
    expect(sms).toContain('Fix It or Free');
    expect(sms).toContain('https://g.co/r');
    expect(sms.length).toBeLessThan(220);
    expect(emailSubject).toContain('Fix It or Free');
  });

  it('follow-up is a different, shorter nudge', () => {
    const first = buildReviewRequestMessages({ businessName: 'B', customerName: 'Sam', reviewUrl: 'u' }).sms;
    const second = buildReviewRequestMessages({ businessName: 'B', customerName: 'Sam', reviewUrl: 'u', followUp: true }).sms;
    expect(second).not.toBe(first);
    expect(second).toContain('nudge');
  });

  it('firstNameOf falls back sensibly', () => {
    expect(firstNameOf('J Smith')).toBe('J Smith');
    expect(firstNameOf('  Dustin   Bates ')).toBe('Dustin');
  });

  it('settings default on, 2h delay, follow-up after 3 days', () => {
    expect(reviewRequestSettings(null)).toEqual({ enabled: true, delayHours: 2, followUp: true, followUpDays: 3 });
    expect(reviewRequestSettings({ automation: { review_requests: { enabled: false, delay_hours: 24, follow_up: false, follow_up_days: 0 } } } as never))
      .toEqual({ enabled: false, delayHours: 24, followUp: false, followUpDays: 1 });
  });
});
