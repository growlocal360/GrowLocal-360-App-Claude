import { describe, it, expect } from 'vitest';
import { normalizeProfiles, profileLinks } from './profiles';
import { buildLocalBusinessSchema } from '@/lib/schema/builders';
import { toBusinessInput } from '@/lib/schema/helpers';

describe('business profiles → sameAs', () => {
  it('normalizes URLs, forces https, drops blanks and junk', () => {
    const p = normalizeProfiles({
      facebook: '  facebook.com/fixitorfree/ ',
      yelp: 'https://www.yelp.com/biz/fix-it-or-free',
      instagram: '',
      tiktok: 'not a url',
      bogus: 'https://example.com',
    });
    expect(p).toEqual({ facebook: 'https://facebook.com/fixitorfree', yelp: 'https://www.yelp.com/biz/fix-it-or-free' });
  });

  it('orders links by platform and only includes set ones', () => {
    const links = profileLinks({ yelp: 'https://yelp.com/biz/x', google_business: 'https://g.page/x' });
    expect(links.map((l) => l.key)).toEqual(['google_business', 'yelp']);
    expect(links[0].short).toBe('Google');
  });

  it('puts the profiles on LocalBusiness.sameAs', () => {
    const business = toBusinessInput(
      {
        name: 'Fix It or Free', slug: 'fix', domain: null, custom_domain: 'sarasotafloridaappliancerepair.com', custom_domain_verified: true,
        settings: { phone: '(941) 343-3733', profiles: { google_business: 'https://g.page/fix', facebook: 'https://facebook.com/fix' } },
      },
      null
    );
    const schema = buildLocalBusinessSchema(business, { streetAddress: '1 Main', city: 'Sarasota', state: 'FL', zipCode: '34236', country: 'US', latitude: null, longitude: null });
    expect(schema.sameAs).toEqual(['https://g.page/fix', 'https://facebook.com/fix']);
    expect(schema.url).toBe('https://sarasotafloridaappliancerepair.com');
  });

  it('omits sameAs when no profiles are set', () => {
    const business = toBusinessInput({ name: 'X', slug: 'x', domain: null, custom_domain: null, settings: {} }, null);
    const schema = buildLocalBusinessSchema(business, { streetAddress: '', city: 'A', state: 'FL', zipCode: '', country: 'US', latitude: null, longitude: null });
    expect(schema.sameAs).toBeUndefined();
  });
});
