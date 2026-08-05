import { describe, it, expect } from 'vitest';
import {
  resolveNicheForm,
  resolveSiteNiches,
  resolveNichesFromNames,
  allFields,
  APPLIANCE_FORM,
  GENERIC_FORM,
  HVAC_FORM,
} from '../niche-forms';
import type { PublicRenderCategory } from '@/lib/sites/public-render-model';

function cat(display_name: string): PublicRenderCategory {
  return { id: display_name, is_primary: true, gbp_category: { display_name, name: display_name } };
}

// AM Refrigeration's real GBP categories, primary first.
const AM_CATEGORIES = [
  'AC repair service',
  'HVAC contractor',
  'Heating contractor',
  'Appliance repair service',
  'AC contractor',
  'Refrigerator repair service',
];

describe('resolveNicheForm', () => {
  it('matches the appliance form from a GBP category name', () => {
    expect(resolveNicheForm([cat('Appliance repair service')]).key).toBe('appliance');
  });

  it('matches the appliance form from core_industry when categories are silent', () => {
    expect(resolveNicheForm([cat('Repair service')], 'Appliance Repair').key).toBe('appliance');
  });

  it('is case-insensitive', () => {
    expect(resolveNicheForm([cat('APPLIANCE REPAIR')]).key).toBe('appliance');
  });

  it('falls back to the generic form for a non-matching niche', () => {
    expect(resolveNicheForm([cat('Plumber')]).key).toBe('generic');
  });

  it('falls back to generic with no categories and no core_industry', () => {
    expect(resolveNicheForm().key).toBe('generic');
    expect(resolveNicheForm([]).key).toBe('generic');
  });
});

describe('resolveSiteNiches — per-category classification', () => {
  it('splits a dual-niche site into HVAC + Appliance, primary first', () => {
    const niches = resolveSiteNiches(AM_CATEGORIES.map(cat));
    expect(niches.map((n) => n.key)).toEqual(['hvac', 'appliance']);
    expect(niches[0].topService).toBe('AC repair service');
    expect(niches[1].topService).toBe('Appliance repair service');
    // Each niche keeps only its own categories.
    expect(niches[0].categories).toContain('HVAC contractor');
    expect(niches[1].categories).toContain('Refrigerator repair service');
  });

  it('labels are the branch-selector display strings', () => {
    const niches = resolveSiteNiches(AM_CATEGORIES.map(cat));
    expect(niches.map((n) => n.label)).toEqual(['HVAC Services', 'Appliance Services']);
  });

  it('a single-niche site returns exactly one niche', () => {
    const niches = resolveSiteNiches([cat('Appliance repair service'), cat('Refrigerator repair service')]);
    expect(niches).toHaveLength(1);
    expect(niches[0].key).toBe('appliance');
  });

  it('unmatched categories fall under the generic niche', () => {
    const niches = resolveSiteNiches([cat('Plumber'), cat('Drain service')]);
    expect(niches).toHaveLength(1);
    expect(niches[0].key).toBe('generic');
  });

  it('resolveNicheForm delegates to the primary niche', () => {
    expect(resolveNicheForm(AM_CATEGORIES.map(cat)).key).toBe('hvac');
  });
});

describe('resolveNichesFromNames — planner (string-only)', () => {
  it('returns key + topService per distinct niche', () => {
    expect(resolveNichesFromNames(AM_CATEGORIES)).toEqual([
      { key: 'hvac', topService: 'AC repair service' },
      { key: 'appliance', topService: 'Appliance repair service' },
    ]);
  });

  it('single-niche site → one entry', () => {
    expect(resolveNichesFromNames(['Appliance repair service'])).toEqual([
      { key: 'appliance', topService: 'Appliance repair service' },
    ]);
  });
});

describe('form config invariants', () => {
  it('appliance primary field maps to service_type and the flow ends on contact', () => {
    const fields = allFields(APPLIANCE_FORM);
    expect(fields.find(f => f.mapsTo === 'service_type')?.name).toBe('appliance');
    // Contact (name/phone) must be the final fields step (contact-last).
    const fieldSteps = APPLIANCE_FORM.steps.filter(s => s !== '__schedule__');
    const last = fieldSteps[fieldSteps.length - 1];
    expect(typeof last === 'object' && last.fields.some(f => f.name === 'phone')).toBe(true);
  });

  it('generic keeps the service select + message mapping', () => {
    const fields = allFields(GENERIC_FORM);
    expect(fields.find(f => f.mapsTo === 'service_type')?.optionsFrom).toBe('categories');
    expect(fields.find(f => f.mapsTo === 'message')?.name).toBe('message');
  });

  it('every reserved field name is one of name/phone/email/address', () => {
    for (const cfg of [APPLIANCE_FORM, GENERIC_FORM, HVAC_FORM]) {
      for (const f of allFields(cfg)) {
        if (f.reserved) expect(['name', 'phone', 'email', 'address']).toContain(f.name);
      }
    }
  });

  it('hvac starts with a Type-of-Service card step and ends on contact', () => {
    const first = HVAC_FORM.steps[0];
    expect(typeof first === 'object' && first.fields[0].type).toBe('cards');
    expect(allFields(HVAC_FORM).find((f) => f.mapsTo === 'service_type')?.name).toBe('service_type');
    const fieldSteps = HVAC_FORM.steps.filter((s) => s !== '__schedule__');
    const last = fieldSteps[fieldSteps.length - 1];
    expect(typeof last === 'object' && last.fields.some((f) => f.name === 'phone')).toBe(true);
  });
});
