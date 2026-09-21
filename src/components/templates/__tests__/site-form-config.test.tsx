import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteFormConfigProvider, useCtaLabel } from '../site-form-config';
import { UnifiedLeadForm } from '../local-service-pro/unified-lead-form';
import type { PublicRenderCategory } from '@/lib/sites/public-render-model';

function Label({ ctaStyle }: { ctaStyle: 'booking' | 'estimate' }) {
  return <span>{useCtaLabel(ctaStyle)}</span>;
}

const categories = [
  { id: 'c1', is_primary: true, gbp_category: { display_name: 'Boat repair shop' } },
] as unknown as PublicRenderCategory[];

describe('site form config', () => {
  it('falls back to the cta_style default when no custom text is set', () => {
    expect(renderToStaticMarkup(<Label ctaStyle="booking" />)).toContain('Book Online');
    expect(renderToStaticMarkup(<Label ctaStyle="estimate" />)).toContain('Get Free Estimate');
    expect(
      renderToStaticMarkup(
        <SiteFormConfigProvider value={{ ctaText: '   ' }}>
          <Label ctaStyle="booking" />
        </SiteFormConfigProvider>
      )
    ).toContain('Book Online');
  });

  it('uses the custom CTA text everywhere the label hook is read', () => {
    const html = renderToStaticMarkup(
      <SiteFormConfigProvider value={{ ctaText: 'Request Service' }}>
        <Label ctaStyle="booking" />
      </SiteFormConfigProvider>
    );
    expect(html).toContain('Request Service');
    expect(html).not.toContain('Book Online');
  });

  it('lead form shows GBP categories by default', () => {
    const html = renderToStaticMarkup(
      <UnifiedLeadForm siteId="s1" accentColor="#00ef99" categories={categories} variant="hero" />
    );
    expect(html).toContain('Book Online');
    expect(html).toContain('In less than 30 seconds');
    expect(html).toContain('Boat repair shop');
  });

  it('lead form uses the custom heading, subheading, and dropdown options', () => {
    const html = renderToStaticMarkup(
      <SiteFormConfigProvider
        value={{
          ctaText: 'Request Service',
          formHeading: 'Get a Repair Quote',
          formSubheading: 'We reply the same day',
          formServiceOptions: ['Marine Engine Repair', 'Fiberglass Hull Repair', 'Other / Not sure'],
        }}
      >
        <UnifiedLeadForm siteId="s1" accentColor="#00ef99" categories={categories} variant="hero" />
      </SiteFormConfigProvider>
    );
    expect(html).toContain('Get a Repair Quote');
    expect(html).toContain('We reply the same day');
    expect(html).toContain('Marine Engine Repair');
    expect(html).toContain('Other / Not sure');
    expect(html).not.toContain('Boat repair shop');
    expect(html).not.toContain('In less than 30 seconds');
  });

  it('multi-niche sites show the custom heading on the branch selector step', () => {
    const dualNiche = [
      { id: 'c1', is_primary: true, gbp_category: { display_name: 'HVAC contractor' } },
      { id: 'c2', is_primary: false, gbp_category: { display_name: 'Appliance repair service' } },
    ] as unknown as PublicRenderCategory[];
    const html = renderToStaticMarkup(
      <SiteFormConfigProvider value={{ formHeading: 'Get a Repair Quote', formSubheading: 'We reply the same day' }}>
        <UnifiedLeadForm siteId="s1" accentColor="#00ef99" categories={dualNiche} variant="hero" />
      </SiteFormConfigProvider>
    );
    expect(html).toContain('Get a Repair Quote');
    expect(html).toContain('We reply the same day');
    expect(html).not.toContain('Book Online');
  });

  it('form heading falls back to the custom CTA text when no heading is set', () => {
    const html = renderToStaticMarkup(
      <SiteFormConfigProvider value={{ ctaText: 'Request Service' }}>
        <UnifiedLeadForm siteId="s1" accentColor="#00ef99" categories={categories} variant="hero" />
      </SiteFormConfigProvider>
    );
    expect(html).toContain('Request Service');
  });
});
