'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation,
  PublicRenderNeighborhoodListing, PublicRenderAreaListing, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconPin, PmIconArrow } from './icons';

interface PremiumLocationPageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    allLocations: PublicRenderLocation[];
    neighborhoods: PublicRenderNeighborhoodListing[];
    serviceAreas: PublicRenderAreaListing[];
  };
  siteSlug: string;
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
}

export function PremiumLocationPage({ data, siteSlug, locationSlug, recentWorkItems = [] }: PremiumLocationPageProps) {
  const { site, location, neighborhoods, serviceAreas } = data;
  const phone = site.settings?.phone || location?.phone;
  const cityState = location?.city ? `${location.city}${location.state ? `, ${location.state}` : ''}` : '';
  const locSlug = locationSlug || location.slug;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome() },
    { name: location.city, url: paths.locationHome(locSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locSlug} ctaStyle="booking">
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome() }, { label: location.city }]}
        eyebrow="Location"
        title={`${site.name} in ${cityState || location.city}`}
        accent={location.city || undefined}
        lede={`Local service you can count on in ${cityState || location.city} and the surrounding area.`}
      />
      <section className="pm-block">
        <div className="pm-wrap">
          <div className="pm-grid3" style={{ marginBottom: 8 }}>
            <Link className="pm-card" href={paths.servicesIndex(locSlug)}><span className="pm-icon"><PmIconArrow /></span><h3>Our Services</h3><p>See everything we offer in {location.city || 'your area'}.</p><span className="pm-more">View services <PmIconArrow /></span></Link>
            <Link className="pm-card" href={paths.workHub(locSlug)}><span className="pm-icon"><PmIconArrow /></span><h3>Recent Work</h3><p>Browse projects completed nearby.</p><span className="pm-more">View work <PmIconArrow /></span></Link>
            <Link className="pm-card" href={paths.contactPage(locSlug)}><span className="pm-icon"><PmIconArrow /></span><h3>Contact</h3><p>Get in touch to book your appointment.</p><span className="pm-more">Contact us <PmIconArrow /></span></Link>
          </div>

          {neighborhoods.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <div className="pm-sechead"><span className="pm-eyebrow">Neighborhoods</span><h2>Neighborhoods we serve in {location.city}</h2></div>
              <div className="pm-areas">
                {neighborhoods.map(n => (
                  <Link key={n.id} className="pm-chip" href={paths.neighborhoodPage(n.slug, locSlug)}><span className="pm-pin"><PmIconPin /></span>{n.name}</Link>
                ))}
              </div>
            </div>
          )}

          {serviceAreas.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <div className="pm-sechead"><span className="pm-eyebrow">Service Areas</span><h2>Cities we serve</h2></div>
              <div className="pm-areas">
                {serviceAreas.map(a => (
                  <Link key={a.id} className="pm-chip" href={paths.areaPage(a.slug, locSlug)}><span className="pm-pin"><PmIconPin /></span>{a.state ? `${a.name}, ${a.state}` : a.name}</Link>
                ))}
              </div>
            </div>
          )}

          {recentWorkItems.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <div className="pm-sechead"><span className="pm-eyebrow">Recent Work</span><h2>Recent projects in {location.city}</h2></div>
              <div className="pm-work">
                {recentWorkItems.slice(0, 3).map(w => {
                  const img = w.images?.[0]?.url;
                  return (
                    <Link key={w.id} className="pm-workcard" href={paths.workDetail(w.slug, locSlug)}>
                      {img ? <img src={img} alt={w.images?.[0]?.alt || w.title} /> : <span className="pm-imgph" />}
                      {w.service?.name && <span className="pm-tag">{w.service.name}</span>}
                      <span className="pm-ov"><span className="pm-ovt">{w.title}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
      <PremiumFinalCta heading={`Serving ${cityState || location.city}`} sub={`Book your appointment with ${site.name} today.`} ctaStyle="booking" phone={phone} />
    </PremiumShell>
  );
}
