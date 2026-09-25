import { describe, it, expect } from 'vitest';
import { hubCityFor, servedCommunitiesLabel, brandPlaceLabel } from '../hub-heading';

describe('hubCityFor (v5 rule 11 for brand-level hubs)', () => {
  it('is brand-level for a single-location site unless the home page is the Primary Market page', () => {
    expect(hubCityFor({ website_type: 'single_location', settings: {} }, 'Englewood')).toBeNull();
    expect(hubCityFor({ website_type: 'single_location', settings: { homepage_is_primary_market: false } }, 'Englewood')).toBeNull();
    expect(hubCityFor({ website_type: 'single_location', settings: { homepage_is_primary_market: true } }, 'Englewood')).toBe('Englewood');
  });
  it('is always brand-level for multi-location sites', () => {
    expect(hubCityFor({ website_type: 'multi_location', settings: { homepage_is_primary_market: true } }, 'Englewood')).toBeNull();
  });
  it('handles a missing city', () => {
    expect(hubCityFor({ website_type: 'single_location', settings: { homepage_is_primary_market: true } }, null)).toBeNull();
  });
});

describe('servedCommunitiesLabel', () => {
  it('lists up to three names and counts the rest', () => {
    expect(servedCommunitiesLabel([])).toBeNull();
    expect(servedCommunitiesLabel([{ name: 'Venice' }])).toBe('Venice');
    expect(servedCommunitiesLabel([{ name: 'Venice' }, { name: 'Sarasota' }])).toBe('Venice and Sarasota');
    expect(servedCommunitiesLabel([{ name: 'Venice' }, { name: 'Sarasota' }, { name: 'Bradenton' }, { name: 'Ruskin' }])).toBe('Venice, Sarasota, Bradenton and 1 more community');
    expect(servedCommunitiesLabel([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }])).toBe('A, B, C and 2 more communities');
  });
});

describe('brandPlaceLabel', () => {
  const base = { website_type: 'single_location', settings: { homepage_is_primary_market: false, service_region: null } };
  it('uses the shop city only when the home page is the Primary Market page', () => {
    expect(brandPlaceLabel({ ...base, settings: { ...base.settings, homepage_is_primary_market: true } }, 'Englewood')).toBe('Englewood');
  });
  it('falls back to the service region, then to nothing', () => {
    expect(brandPlaceLabel({ ...base, settings: { ...base.settings, service_region: 'Southwest Florida' } }, 'Englewood')).toBe('Southwest Florida');
    expect(brandPlaceLabel(base, 'Englewood')).toBeNull();
    expect(brandPlaceLabel({ ...base, settings: { ...base.settings, service_region: '   ' } }, 'Englewood')).toBeNull();
  });
});
