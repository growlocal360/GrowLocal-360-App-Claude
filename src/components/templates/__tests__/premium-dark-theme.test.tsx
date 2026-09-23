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

  it('page background presets and custom colors set the surface tokens', () => {
    expect(premiumThemeStyle(baseSite)).not.toHaveProperty('--paper');
    const light = premiumThemeStyle({ ...baseSite, settings: { ...baseSite.settings, bg_scheme: 'light' } } as PublicRenderSite);
    expect(light).toMatchObject({ '--paper': '#ffffff', '--paper-2': '#f3f4f6', '--line': '#e5e7eb' });
    const custom = premiumThemeStyle({ ...baseSite, settings: { ...baseSite.settings, bg_scheme: 'custom', bg_color: '#f0f7ff', bg_alt_color: '#dbeafe' } } as PublicRenderSite);
    expect(custom).toMatchObject({ '--paper': '#f0f7ff', '--paper-2': '#dbeafe' });
    const badCustom = premiumThemeStyle({ ...baseSite, settings: { ...baseSite.settings, bg_scheme: 'custom', bg_color: 'blue' } } as PublicRenderSite);
    expect(badCustom).not.toHaveProperty('--paper');
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
