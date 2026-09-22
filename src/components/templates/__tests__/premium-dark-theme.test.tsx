import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { premiumThemeStyle } from '../premium/shell';
import { PremiumFooter } from '../premium/footer';
import type { PublicRenderSite } from '@/lib/sites/public-render-model';

const baseSite = {
  id: 's1', name: 'Florida Marine Outfitters', has_brands: false,
  settings: { brand_color: '#00ef99', logo_url: '/public/assets/light.png', logo_dark_url: null, dark_color: null },
} as unknown as PublicRenderSite;

describe('premium dark theme', () => {
  it('only sets --dark when a valid dark_color is saved', () => {
    expect(premiumThemeStyle(baseSite)).toEqual({ '--brand': '#00ef99', '--brand-ink': '#0a0a0b' });
    const dark = premiumThemeStyle({ ...baseSite, settings: { ...baseSite.settings, dark_color: '#1a2b3c' } } as PublicRenderSite);
    expect(dark).toMatchObject({ '--dark': '#1a2b3c', '--dark-ink': '#ffffff' });
    const bad = premiumThemeStyle({ ...baseSite, settings: { ...baseSite.settings, dark_color: 'red' } } as PublicRenderSite);
    expect(bad).not.toHaveProperty('--dark');
  });

  it('footer shows the business name when there is no dark logo', () => {
    const html = renderToStaticMarkup(<PremiumFooter site={baseSite} primaryLocation={null} serviceAreas={[]} />);
    expect(html).toContain('pm-footlogo');
    expect(html).not.toContain('<img');
  });

  it('footer shows the dark-background logo when one is set (never the light logo)', () => {
    const site = { ...baseSite, settings: { ...baseSite.settings, logo_dark_url: '/public/assets/dark.png' } } as PublicRenderSite;
    const html = renderToStaticMarkup(<PremiumFooter site={site} primaryLocation={null} serviceAreas={[]} />);
    expect(html).toContain('dark.png');
    expect(html).not.toContain('light.png');
    expect(html).not.toContain('class="pm-footlogo"');
  });
});
