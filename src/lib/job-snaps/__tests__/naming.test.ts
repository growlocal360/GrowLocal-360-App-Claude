import { describe, it, expect } from 'vitest';
import { generatePublicLocationLabel, generateJobSnapH1 } from '../naming';

describe('generatePublicLocationLabel — neighborhood/city de-dup', () => {
  it('drops the neighborhood when it equals the city (case-insensitive)', () => {
    expect(generatePublicLocationLabel({ neighborhood: 'Vineyard', city: 'Vineyard', state_abbr: 'UT' }))
      .toBe('Vineyard, UT');
    expect(generatePublicLocationLabel({ neighborhood: 'lake charles', city: 'Lake Charles', state_abbr: 'LA' }))
      .toBe('Lake Charles, LA');
  });

  it('keeps a genuinely distinct neighborhood', () => {
    expect(generatePublicLocationLabel({ neighborhood: 'Graywood', city: 'Lake Charles', state_abbr: 'LA' }))
      .toBe('Graywood, Lake Charles, LA');
  });

  it('falls back to city, state when no neighborhood', () => {
    expect(generatePublicLocationLabel({ city: 'Cleveland', state_abbr: 'OH' })).toBe('Cleveland, OH');
  });
});

describe('generateJobSnapH1 — neighborhood/city de-dup', () => {
  const base = { brand: 'Samsung', equipment_type: 'Washing Machine', service_type: 'Appliance Repair', primary_problem: 'Water Leak Diagnosis', state_abbr: 'UT' };

  it('does not repeat the city as a neighborhood', () => {
    expect(generateJobSnapH1({ ...base, city: 'Vineyard', neighborhood: 'Vineyard' }))
      .toBe('Samsung Washing Machine Water Leak Diagnosis in Vineyard, UT');
  });

  it('includes a distinct neighborhood', () => {
    expect(generateJobSnapH1({ ...base, city: 'Lake Charles', neighborhood: 'Graywood' }))
      .toBe('Samsung Washing Machine Water Leak Diagnosis in Graywood, Lake Charles, UT');
  });
});
