'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { useSiteNav } from '@/components/templates/site-nav';

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
  const showAddress = site.settings?.show_address !== false && !!primaryLocation?.address_line1;
  const nav = useSiteNav();
  const nameParts = site.name.split(' ');
  // Footer sits on the dark background, so only the dark-background logo is used here.
  const darkLogoUrl = site.settings?.logo_dark_url;
  const year = 2026;

  return (
    <footer className="pm-footer">
      <div className="pm-wrap">
        <div className="pm-footgrid">
          <div>
            {darkLogoUrl ? (
              <Image src={darkLogoUrl} alt={site.name} width={280} height={72} className="pm-footlogo-img" />
            ) : (
              <div className="pm-footlogo">{nameParts[0]}<span>.</span> {nameParts.slice(1).join(' ')}</div>
            )}
            <p className="pm-footdesc">
              {(site.settings?.tagline as string) ||
                `Professional service${primaryLocation?.city ? ` in ${primaryLocation.city}` : ''} you can count on — done right the first time.`}
            </p>
          </div>

          {nav.services.length > 0 && (
            <div className="pm-footcol">
              <h5>Services</h5>
              {nav.services.slice(0, 9).map((s) => (
                s.href ? <Link key={s.name} href={s.href}>{s.name}</Link> : <span key={s.name} className="pm-foottext">{s.name}</span>
              ))}
            </div>
          )}

          {(nav.areas.length > 0 || serviceAreas.length > 0) && (
            <div className="pm-footcol">
              <h5>Service Areas</h5>
              {(nav.areas.length > 0 ? nav.areas : serviceAreas.map((a) => ({ name: a.name, href: null as string | null }))).slice(0, 9).map((a) => (
                a.href ? <Link key={a.name} href={a.href}>{a.name}</Link> : <span key={a.name} className="pm-foottext">{a.name}</span>
              ))}
              <Link href={paths.areasIndex(locationSlug)} className="pm-footmore">All service areas</Link>
            </div>
          )}

          <div className="pm-footcol">
            <h5>Pages</h5>
            <Link href={paths.locationHome(locationSlug)}>Home</Link>
            <Link href={paths.servicesIndex(locationSlug)}>Services</Link>
            <Link href={paths.areasIndex(locationSlug)}>Service Areas</Link>
            <Link href={paths.workHub(locationSlug)}>Recent Work</Link>
            <Link href={paths.reviewsIndex(locationSlug)}>Reviews</Link>
            <Link href={paths.aboutPage(locationSlug)}>About Us</Link>
            <Link href={paths.contactPage(locationSlug)}>Contact</Link>
            <Link href={paths.bookPage(locationSlug)}>Book Online</Link>
            {site.has_brands && <Link href={paths.brandsIndex(locationSlug)}>Brands</Link>}
            <Link href={paths.faqPage(locationSlug)}>FAQ</Link>
          </div>

          <div className="pm-footcol">
            <h5>Contact</h5>
            {phone && <p style={{ marginBottom: 8 }}><a href={`tel:${phone.replace(/\D/g, '')}`}><b>{phone}</b></a></p>}
            {email && <p style={{ marginBottom: 8 }}><a href={`mailto:${String(email)}`}>{String(email)}</a></p>}
            {showAddress ? (
              <p style={{ fontSize: 13.5, opacity: 0.85 }}>
                {primaryLocation!.address_line1}{primaryLocation!.address_line2 ? `, ${primaryLocation!.address_line2}` : ''}<br />
                {primaryLocation!.city}, {primaryLocation!.state} {primaryLocation!.zip_code}
              </p>
            ) : primaryLocation?.city ? (
              <p style={{ fontSize: 13.5, opacity: 0.85 }}>{primaryLocation.city}{primaryLocation.state ? `, ${primaryLocation.state}` : ''}</p>
            ) : null}
            {site.settings?.profiles?.length > 0 && (
              <div className="pm-footprofiles">
                {site.settings.profiles.map((p) => (
                  <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer me" title={p.label}>{p.short}</a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pm-footbottom">
          <span>© {year} {site.name}. All rights reserved.</span>
          <span className="pm-footlegal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="/sitemap.xml">Sitemap</a>
            <span>Powered by <b style={{ color: 'var(--brand)' }}>GrowLocal 360</b></span>
          </span>
        </div>
      </div>
    </footer>
  );
}
