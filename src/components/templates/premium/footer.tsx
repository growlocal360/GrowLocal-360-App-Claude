'use client';

import Link from 'next/link';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface PremiumFooterProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas: PublicRenderAreaListing[];
  siteSlug?: string;
  locationSlug?: string;
}

export function PremiumFooter({ site, primaryLocation, serviceAreas, locationSlug }: PremiumFooterProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const email = site.settings?.email;
  const nameParts = site.name.split(' ');
  const year = 2026;

  return (
    <footer className="pm-footer">
      <div className="pm-wrap">
        <div className="pm-footgrid">
          <div>
            <div className="pm-footlogo">{nameParts[0]}<span>.</span> {nameParts.slice(1).join(' ')}</div>
            <p className="pm-footdesc">
              {(site.settings?.tagline as string) ||
                `Professional service${primaryLocation?.city ? ` in ${primaryLocation.city}` : ''} you can count on — done right the first time.`}
            </p>
          </div>

          <div className="pm-footcol">
            <h5>Company</h5>
            <Link href={paths.aboutPage(locationSlug)}>About Us</Link>
            <Link href={paths.workHub(locationSlug)}>Recent Work</Link>
            <Link href={paths.reviewsIndex(locationSlug)}>Reviews</Link>
            <Link href={paths.contactPage(locationSlug)}>Contact</Link>
          </div>

          <div className="pm-footcol">
            <h5>Explore</h5>
            <Link href={paths.servicesIndex(locationSlug)}>Services</Link>
            <Link href={paths.areasIndex(locationSlug)}>Service Areas</Link>
            <Link href={paths.faqPage(locationSlug)}>FAQ</Link>
            {site.has_brands && <Link href={paths.brandsIndex(locationSlug)}>Brands</Link>}
          </div>

          <div className="pm-footcol">
            <h5>Get in Touch</h5>
            {phone && <p style={{ marginBottom: 8 }}><b>{phone}</b></p>}
            {email && <p style={{ marginBottom: 8 }}>{String(email)}</p>}
            {(serviceAreas.length > 0) && (
              <p style={{ fontSize: 13.5, opacity: 0.85 }}>
                Serving {serviceAreas.slice(0, 3).map(a => a.name).join(', ')}{serviceAreas.length > 3 ? ' & more' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="pm-footbottom">
          <span>© {year} {site.name}. All rights reserved.</span>
          <span>Powered by <b style={{ color: 'var(--brand)' }}>GrowLocal 360</b></span>
        </div>
      </div>
    </footer>
  );
}
