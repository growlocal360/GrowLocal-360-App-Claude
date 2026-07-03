import { describe, it, expect } from 'vitest';
import { resolveNicheForm, allFields, APPLIANCE_FORM, GENERIC_FORM } from '../niche-forms';
import type { PublicRenderCategory } from '@/lib/sites/public-render-model';

function cat(display_name: string): PublicRenderCategory {
  return { id: display_name, is_primary: true, gbp_category: { display_name, name: display_name } };
}

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
    for (const cfg of [APPLIANCE_FORM, GENERIC_FORM]) {
      for (const f of allFields(cfg)) {
        if (f.reserved) expect(['name', 'phone', 'email', 'address']).toContain(f.name);
      }
    }
  });
});
