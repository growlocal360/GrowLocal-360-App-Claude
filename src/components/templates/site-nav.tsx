'use client';

import { createContext, useContext } from 'react';

/**
 * Site-wide navigation data for footers: the services (with their real page
 * URLs) and the service areas (linked only when the city has its own page).
 * Loaded once by the public site layout so every page's footer can list them
 * without each route threading services through props.
 */
export interface SiteNavLink { name: string; href: string | null }
export interface SiteNav {
  services: SiteNavLink[];
  areas: SiteNavLink[];
  /** Public origin of the site (https://custom-domain or https://slug.app-domain), no trailing slash. */
  siteUrl: string;
}

const SiteNavContext = createContext<SiteNav>({ services: [], areas: [], siteUrl: '' });

export function SiteNavProvider({ value, children }: { value: SiteNav; children: React.ReactNode }) {
  return <SiteNavContext.Provider value={value}>{children}</SiteNavContext.Provider>;
}

export function useSiteNav(): SiteNav {
  return useContext(SiteNavContext);
}
