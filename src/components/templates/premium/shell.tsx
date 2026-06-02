'use client';

/**
 * Shared premium-template chrome for inner pages: the .tpl-premium wrapper
 * (with brand-color vars), header, footer, a breadcrumb page-hero, and a
 * reusable final-CTA band. Keeps every inner page consistent + DRY.
 */
import Link from 'next/link';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing, PublicRenderWorkItem } from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { PremiumHeader } from './header';
import { PremiumFooter } from './footer';
import { PmIconPhone, PmIconArrow } from './icons';

/** Readable ink color (#0a0a0b or #fff) for text/icons on a brand fill. */
export function readableInk(hex: string): string {
  const c = (hex || '').replace('#', '');
  if (c.length < 6) return '#0a0a0b';
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0a0a0b' : '#ffffff';
}

export function ctaLabelFor(ctaStyle: 'booking' | 'estimate') {
  return ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate';
}

interface ShellProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  ctaStyle?: 'booking' | 'estimate';
  children: React.ReactNode;
}

/** Wraps inner-page content with the premium chrome + brand color vars. */
export function PremiumShell({ site, primaryLocation, serviceAreas = [], siteSlug, locationSlug, ctaStyle = 'booking', children }: ShellProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const brandInk = readableInk(brandColor);
  return (
    <div className="tpl-premium" style={{ ['--brand' as string]: brandColor, ['--brand-ink' as string]: brandInk }}>
      <PremiumHeader site={site} primaryLocation={primaryLocation} siteSlug={siteSlug} locationSlug={locationSlug} ctaLabel={ctaLabelFor(ctaStyle)} />
      <main>{children}</main>
      <PremiumFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}

interface Crumb { label: string; href?: string }

/** Breadcrumb + headline page hero used at the top of inner pages. */
export function PremiumPageHero({ crumbs, eyebrow, title, accent, lede }: { crumbs: Crumb[]; eyebrow?: string; title: string; accent?: string; lede?: string }) {
  const parts = splitAccent(title, accent || '');
  return (
    <section className="pm-page-hero">
      <div className="pm-wrap">
        <nav className="pm-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 9, alignItems: 'center' }}>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <span className="pm-sep">/</span>}
            </span>
          ))}
        </nav>
        {eyebrow && <span className="pm-eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</span>}
        <h1>{parts.accent ? <>{parts.before}<span className="pm-accent">{parts.accent}</span>{parts.after}</> : title}</h1>
        {lede && <p className="pm-lede" style={{ marginTop: 16, marginBottom: 0 }}>{lede}</p>}
      </div>
    </section>
  );
}

/** Reusable dark final-CTA band. */
export function PremiumFinalCta({ heading, sub, ctaStyle = 'booking', phone }: { heading: string; sub?: string; ctaStyle?: 'booking' | 'estimate'; phone?: string | null }) {
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  return (
    <div className="pm-wrap pm-finalwrap" style={{ paddingTop: 88 }}>
      <div className="pm-final">
        <h2>{heading}</h2>
        {sub && <p>{sub}</p>}
        <div className="pm-row">
          <a className="pm-btn pm-btn-brand pm-btn-lg" href="#pm-form">{ctaLabelFor(ctaStyle)} <PmIconArrow /></a>
          {phoneHref && <a className="pm-btn pm-btn-ghost pm-btn-lg" href={phoneHref}><PmIconPhone style={{ width: 18, height: 18 }} /> {phone}</a>}
        </div>
      </div>
    </div>
  );
}

/**
 * Premium "Recent Work" band — renders attached/recent job snaps as a full-width
 * gallery grid. Shared by service, brand, service-area, and category pages so a
 * published snap surfaces on every page it's attached to (matching local-service-pro).
 * Renders nothing when there are no items.
 */
export function PremiumRecentWork({ items, locationSlug, title = 'Recent work' }: { items?: PublicRenderWorkItem[]; locationSlug?: string; title?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="pm-block pm-soft">
      <div className="pm-wrap">
        <div className="pm-sechead"><span className="pm-eyebrow">Recent Work</span><h2>{title}</h2></div>
        <div className="pm-work">
          {items.slice(0, 6).map((w) => {
            const img = w.images?.[0]?.url;
            return (
              <Link key={w.id} className="pm-workcard" href={paths.workDetail(w.slug, locationSlug)}>
                {img ? <img src={img} alt={w.images?.[0]?.alt || w.title} /> : <span className="pm-imgph" />}
                {w.service?.name && <span className="pm-tag">{w.service.name}</span>}
                <span className="pm-ov"><span className="pm-ovt">{w.title}</span></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function splitAccent(title: string, accent: string): { before: string; accent: string; after: string } {
  if (!accent) return { before: title, accent: '', after: '' };
  const idx = title.toLowerCase().indexOf(accent.toLowerCase());
  if (idx === -1) return { before: title, accent: '', after: '' };
  return { before: title.slice(0, idx), accent: title.slice(idx, idx + accent.length), after: title.slice(idx + accent.length) };
}
