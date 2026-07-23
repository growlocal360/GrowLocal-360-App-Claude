import { describe, it, expect } from 'vitest';
import { generateSetupPrompt, type SetupPromptFramework } from '../setup-prompts';

const base = {
  apiBase: 'https://app.growlocal360.com',
  apiKey: 'test_key',
  webhookUrl: 'https://example.com/api/jobsnaps-webhook',
  webhookSecret: 'whsec_test',
  businessName: 'The Appliance Guys',
  databaseChoice: 'supabase' as const,
};

describe('setup prompts — related-pages routing', () => {
  it.each(['nextjs', 'astro', 'wordpress'] as SetupPromptFramework[])(
    '%s prompt instructs surfacing snaps on existing service/city/brand pages',
    (framework) => {
      const out = generateSetupPrompt({ ...base, framework });
      expect(out).toContain('Surface snaps on my EXISTING pages');
      expect(out).toContain('Service pages');
      expect(out).toContain('City / location pages');
      expect(out).toContain('Brand pages');
      // still keeps the original /work/ instructions
      expect(out.toLowerCase()).toContain('/work');
    }
  );

  it('api prompt includes faceting guidance', () => {
    const out = generateSetupPrompt({ ...base, framework: 'api' });
    expect(out).toContain('Faceting snaps onto existing pages');
    expect(out).toContain('service pages');
  });
});
