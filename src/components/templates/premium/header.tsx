'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { PublicRenderSite, PublicRenderLocation } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

interface PremiumHeaderProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  siteSlug?: string;
  locationSlug?: string;
  ctaLabel: string;
}

export function PremiumHeader({ site, primaryLocation, locationSlug, ctaLabel }: PremiumHeaderProps) {
  const [open, setOpen] = useState(false);
  const phone = site.settings?.phone || primaryLocation?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;

  const links = [
    { label: 'Services', href: paths.servicesIndex(locationSlug) },
    { label: 'Service Areas', href: paths.areasIndex(locationSlug) },
    ...(site.has_brands ? [{ label: 'Brands', href: paths.brandsIndex(locationSlug) }] : []),
    { label: 'Work', href: paths.workHub(locationSlug) },
    { label: 'Reviews', href: paths.reviewsIndex(locationSlug) },
    { label: 'About', href: paths.aboutPage(locationSlug) },
    { label: 'Contact', href: paths.contactPage(locationSlug) },
  ];

  // Logo: use uploaded logo if present, else stylized business name with a brand dot
  const logoUrl = site.settings?.logo_url;
  const nameParts = site.name.split(' ');
  const logoNode = logoUrl ? (
    <Image src={logoUrl} alt={site.name} width={240} height={56} className="pm-logo-img" style={{ height: 44, width: 'auto', objectFit: 'contain' }} priority />
  ) : (
    <span className="pm-logo">{nameParts[0]}<span>.</span> {nameParts.slice(1).join(' ')}</span>
  );

  return (
    <header className="pm-header">
      <div className="pm-wrap pm-nav">
        <Link href={paths.locationHome(locationSlug)}>{logoNode}</Link>

        <nav className="pm-navlinks">
          {links.map(l => <Link key={l.label} href={l.href}>{l.label}</Link>)}
        </nav>

        <div className="pm-navcta">
          {phone && <a className="pm-phone" href={phoneHref}><span className="pm-dot" />{phone}</a>}
          <a className="pm-btn pm-btn-brand" href="#pm-form">{ctaLabel}</a>
        </div>

        <button className="pm-burger" aria-label="Toggle menu" onClick={() => setOpen(o => !o)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      </div>

      {open && (
        <div className="pm-mobnav">
          {links.map(l => <Link key={l.label} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
          {phone && <a href={phoneHref} onClick={() => setOpen(false)} style={{ fontWeight: 700, padding: '11px 14px' }}>{phone}</a>}
          <a className="pm-btn pm-btn-brand" href="#pm-form" onClick={() => setOpen(false)} style={{ marginTop: 6 }}>{ctaLabel}</a>
        </div>
      )}
    </header>
  );
}
