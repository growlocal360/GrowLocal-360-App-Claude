'use client';

import { createContext, useContext } from 'react';

/**
 * Per-site overrides for the CTA button label and the lead form, provided once
 * by the public site layout so every template component can read them without
 * prop threading. Every field is optional; empty means "use the default".
 */
export interface SiteFormConfig {
  ctaText?: string | null;
  formHeading?: string | null;
  formSubheading?: string | null;
  formServiceOptions?: string[] | null;
}

const SiteFormConfigContext = createContext<SiteFormConfig>({});

export function SiteFormConfigProvider({
  value,
  children,
}: {
  value: SiteFormConfig;
  children: React.ReactNode;
}) {
  return <SiteFormConfigContext.Provider value={value}>{children}</SiteFormConfigContext.Provider>;
}

export function useSiteFormConfig(): SiteFormConfig {
  return useContext(SiteFormConfigContext);
}

export function defaultCtaLabel(ctaStyle: 'booking' | 'estimate' = 'booking'): string {
  return ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate';
}

/** CTA button label: the site's custom text, else the cta_style default. */
export function useCtaLabel(ctaStyle: 'booking' | 'estimate' = 'booking'): string {
  const { ctaText } = useSiteFormConfig();
  return ctaText?.trim() || defaultCtaLabel(ctaStyle);
}
