import { describe, it, expect } from 'vitest';
import { lastWeekRange, digestHasNews, type WeeklyDigest } from './weekly';
import { normalizeSnapshot, diffSnapshots } from '@/lib/automation/profile-watch';

describe('weekly digest', () => {
  it('covers the seven days ending yesterday', () => {
    expect(lastWeekRange(new Date('2026-11-02T13:00:00Z'))).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
  it('a quiet week sends nothing', () => {
    const quiet: WeeklyDigest = {
      siteId: 's', siteName: 'S', start: 'a', end: 'b',
      google: { available: false, impressionsMaps: 0, impressionsSearch: 0, impressions: 0, calls: 0, websiteClicks: 0, directions: 0, conversations: 0, bookings: 0 },
      leads: 0, bookings: 0, newReviews: 0, newReviewAverage: null,
      activity: { repliesPosted: 0, requestsSent: 0, postsPublished: 0, photosAdded: 0, jobsPublished: 0 },
      pendingApprovals: 0, profileChanges: [], unansweredReviews: 0,
    };
    expect(digestHasNews(quiet)).toBe(false);
    expect(digestHasNews({ ...quiet, pendingApprovals: 2 })).toBe(true);
    expect(digestHasNews({ ...quiet, google: { ...quiet.google, available: true, calls: 3 } })).toBe(true);
  });
});

describe('profile watch', () => {
  const loc = {
    name: 'locations/1', title: 'Fix It', websiteUri: 'https://a.com',
    phoneNumbers: { primaryPhone: '(941) 555-0100' },
    storefrontAddress: { addressLines: ['1 Main St'], locality: 'Sarasota', administrativeArea: 'FL', postalCode: '34236', regionCode: 'US' },
    categories: { primaryCategory: { name: 'c', displayName: 'Appliance repair service' }, additionalCategories: [{ name: 'd', displayName: 'Refrigerator repair service' }] },
    regularHours: { periods: [{ openDay: 'TUESDAY', openTime: { hours: 8 }, closeDay: 'TUESDAY', closeTime: { hours: 17 } }, { openDay: 'MONDAY', openTime: { hours: 8 }, closeDay: 'MONDAY', closeTime: { hours: 17 } }] },
    openInfo: { status: 'OPEN' },
  };
  it('normalizes and sorts hours', () => {
    const snap = normalizeSnapshot(loc);
    expect(snap.hours).toEqual(['MONDAY 08:00-17:00', 'TUESDAY 08:00-17:00']);
    expect(snap.address).toBe('1 Main St, Sarasota, FL, 34236');
  });
  it('reports only what changed, in plain labels', () => {
    const before = normalizeSnapshot(loc);
    const after = normalizeSnapshot({ ...loc, phoneNumbers: { primaryPhone: '(941) 555-9999' }, openInfo: { status: 'CLOSED_TEMPORARILY' } });
    const changes = diffSnapshots(before, after);
    expect(changes.map((c) => c.label)).toEqual(['Phone number', 'Open status']);
    expect(changes[0]).toMatchObject({ before: '(941) 555-0100', after: '(941) 555-9999' });
    expect(diffSnapshots(before, before)).toEqual([]);
  });
});
