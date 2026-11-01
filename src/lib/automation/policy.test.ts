import { describe, it, expect } from 'vitest';
import { isRecentEnough, shouldAutoPublishReply, isNegativeReview, sanitizeReply } from './policy';

describe('automation policy', () => {
  it('only drafts for recent reviews', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    expect(isRecentEnough('2026-10-20T00:00:00Z', now)).toBe(true);
    expect(isRecentEnough('2026-07-01T00:00:00Z', now)).toBe(false);
    expect(isRecentEnough(null, now)).toBe(false);
    expect(isRecentEnough('not a date', now)).toBe(false);
  });

  it('autopilot publishes 4-5 star replies only', () => {
    expect(shouldAutoPublishReply('autopilot', 5)).toBe(true);
    expect(shouldAutoPublishReply('autopilot', 4)).toBe(true);
    expect(shouldAutoPublishReply('autopilot', 3)).toBe(false);
    expect(shouldAutoPublishReply('autopilot', 1)).toBe(false);
    expect(shouldAutoPublishReply('approve', 5)).toBe(false);
  });

  it('flags 1-2 star reviews as negative', () => {
    expect(isNegativeReview(1)).toBe(true);
    expect(isNegativeReview(2)).toBe(true);
    expect(isNegativeReview(3)).toBe(false);
  });

  it('strips wrapping quotes and em dashes, caps length', () => {
    expect(sanitizeReply('"Thanks, Sam \u2014 glad it worked out."')).toBe('Thanks, Sam. glad it worked out.');
    expect(sanitizeReply('x'.repeat(1200)).length).toBe(1000);
  });
});
