'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderWorkItem,
  PublicRenderAreaListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { BeforeAfterSlider } from '@/components/templates/local-service-pro/before-after-slider';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconStar, PmIconShield, PmIconClock, PmIconPin } from './icons';

interface PremiumWorkDetailPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation;
  workItem: PublicRenderWorkItem;
  service?: { id: string; name: string; slug: string } | null;
  itemLocation?: { id: string; city: string; state: string; slug: string } | null;
  relatedItems: PublicRenderWorkItem[];
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumWorkDetailPage({
  site, primaryLocation, workItem, service, itemLocation, relatedItems, serviceAreas = [],
  siteSlug, locationSlug, formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumWorkDetailPageProps) {
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || primaryLocation?.phone;
  const cityFromItem = itemLocation?.city || workItem.address_city;
  const tech = workItem.technician;

  const images = workItem.images || [];
  // group before/after pairs by pairGroup; everything else is a plain gallery image
  const pairs = new Map<number, { before?: string; after?: string }>();
  const singles: typeof images = [];
  for (const img of images) {
    if ((img.role === 'before' || img.role === 'after') && typeof img.pairGroup === 'number') {
      const p = pairs.get(img.pairGroup) || {};
      if (img.role === 'before') p.before = img.url; else p.after = img.url;
      pairs.set(img.pairGroup, p);
    } else {
      singles.push(img);
    }
  }
  const completePairs = [...pairs.values()].filter(p => p.before && p.after);

  const h1 = workItem.h1 || workItem.title;
  const body = workItem.description || workItem.summary || '';

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Work', url: paths.workHub(locationSlug) },
    { name: workItem.title, url: paths.workDetail(workItem.slug, locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Work', href: paths.workHub(locationSlug) }, { label: workItem.title }]}
        eyebrow={service?.name || 'Recent Work'}
        title={h1}
        lede={[cityFromItem, fmtDate(workItem.performed_at)].filter(Boolean).join(' · ') || undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            {/* before/after sliders */}
            {completePairs.map((p, i) => (
              <div key={`pair-${i}`} style={{ borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                <BeforeAfterSlider beforeSrc={p.before!} afterSrc={p.after!} />
              </div>
            ))}
            {/* gallery */}
            {singles.length > 0 && (
              <div className="pm-work" style={{ marginTop: completePairs.length ? 20 : 0 }}>
                {singles.map((img, i) => (
                  <div key={i} className="pm-workcard" style={{ cursor: 'default' }}>
                    <img src={img.url} alt={img.alt || workItem.title} />
                  </div>
                ))}
              </div>
            )}
            {body && body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            {tech && (
              <div style={{ display: 'flex', gap: 13, alignItems: 'center', marginTop: 28, padding: 20, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--card)' }}>
                {tech.avatar_url ? <img className="pm-av" src={tech.avatar_url} alt={tech.name} style={{ width: 48, height: 48 }} /> : <span className="pm-av" style={{ width: 48, height: 48 }}>{tech.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>}
                <div><div style={{ fontWeight: 700 }}>{tech.name}</div>{tech.title && <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>{tech.title}</div>}</div>
              </div>
            )}
          </div>
          <aside>
            <div className="pm-aside" id="pm-form">
              <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
              <div className="pm-asidetrust">
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>Quality workmanship</div>
                <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Satisfaction guaranteed</div>
                <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {relatedItems.length > 0 && (
        <section className="pm-block pm-soft">
          <div className="pm-wrap">
            <div className="pm-sechead"><span className="pm-eyebrow">More Work</span><h2>Recent projects</h2></div>
            <div className="pm-work">
              {relatedItems.slice(0, 3).map(w => {
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
      )}

      <PremiumFinalCta heading="Want results like this?" sub={cityFromItem ? `Serving ${cityFromItem} & surrounding areas.` : undefined} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
