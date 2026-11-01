import { describe, it, expect } from 'vitest';
import { pickSource, trimSummary, isDue, gbpPostSettings, seasonFor, GBP_SUMMARY_MAX } from './gbp-posts';

describe('gbp post automation', () => {
  it('rotates sources and skips what is unavailable', () => {
    expect(pickSource(['service', 'work', 'review', 'tip'], [])).toBe('service');
    expect(pickSource(['service', 'work', 'review', 'tip'], ['service'])).toBe('work');
    expect(pickSource(['service', 'tip'], ['service'])).toBe('tip');
    expect(pickSource(['service', 'tip'], ['tip'])).toBe('service');
    expect(pickSource([], [])).toBeNull();
  });

  it('keeps summaries under the GBP limit, cutting at a sentence', () => {
    const long = ('This is a sentence about dryers. ').repeat(80);
    const out = trimSummary(long);
    expect(out.length).toBeLessThanOrEqual(GBP_SUMMARY_MAX);
    expect(out.endsWith('.')).toBe(true);
    expect(trimSummary('short — one')).toBe('short. one');
  });

  it('due logic allows a daily cron to keep a weekly cadence', () => {
    const now = new Date('2026-11-08T14:00:00Z');
    expect(isDue(null, 7, now)).toBe(true);
    expect(isDue('2026-11-01T14:30:00Z', 7, now)).toBe(true);  // 6d23.5h, within slack
    expect(isDue('2026-11-03T14:00:00Z', 7, now)).toBe(false);
  });

  it('settings default to weekly posts and a photo every 3 days', () => {
    expect(gbpPostSettings(null)).toEqual({ enabled: true, cadenceDays: 7, photoDrip: true, photoEveryDays: 3 });
    expect(gbpPostSettings({ automation: { gbp_posts: { enabled: false, cadence_days: 99, photo_every_days: 0 } } } as never))
      .toEqual({ enabled: false, cadenceDays: 30, photoDrip: true, photoEveryDays: 1 });
  });

  it('season by month', () => {
    expect(seasonFor(new Date('2026-01-15'))).toBe('winter');
    expect(seasonFor(new Date('2026-07-15'))).toBe('summer');
    expect(seasonFor(new Date('2026-10-15'))).toBe('fall');
  });
});
