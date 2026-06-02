'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderNeighborhoodDetail,
  PublicRenderNeighborhoodListing, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconCheck, PmIconPin } from './icons';

interface PremiumNeighborhoodPageSingleProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    neighborhood: PublicRenderNeighborhoodDetail;
    allNeighborhoods: PublicRenderNeighborhoodListing[];
  };
  siteSlug: string;
  categories?: NavCategory[];
  recentWorkItems?: PublicRenderWorkItem[];
}

export function PremiumNeighborhoodPageSingleLocation({ data, siteSlug }: PremiumNeighborhoodPageSingleProps) {
  const { site, location, neighborhood, allNeighborhoods } = data;
  const phone = site.settings?.phone || location?.phone;
  const features = neighborhood.local_features;
  const faqs = neighborhood.faqs || [];
  const h1 = neighborhood.h1 || `Service in ${neighborhood.name}`;
  const body = neighborhood.body_copy || neighborhood.description || `${site.name} proudly serves the ${neighborhood.name} neighborhood.`;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome() },
    { name: neighborhood.name, url: paths.neighborhoodPage(neighborhood.slug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} siteSlug={siteSlug} ctaStyle="booking">
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome() }, { label: neighborhood.name }]}
        eyebrow="Neighborhood"
        title={h1}
        accent={neighborhood.name}
      />
      <section className="pm-block">
        <div className="pm-wrap" style={{ maxWidth: 900 }}>
          <div className="pm-prose">
            {body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            {features?.why_choose_us && features.why_choose_us.length > 0 && (
              <>
                <h2>Why {neighborhood.name} chooses us</h2>
                <ul>{features.why_choose_us.map((w, i) => <li key={i}><span className="pm-chk"><PmIconCheck /></span><div>{w}</div></li>)}</ul>
              </>
            )}
            {features?.landmarks && features.landmarks.length > 0 && (
              <>
                <h3>Local landmarks we serve near</h3>
                <ul>{features.landmarks.map((l, i) => <li key={i}><span className="pm-chk"><PmIconPin /></span><div><b>{l.name}</b>{l.description ? ` — ${l.description}` : ''}</div></li>)}</ul>
              </>
            )}
            {faqs.length > 0 && (
              <div className="pm-faq" style={{ marginTop: 40 }}>
                {faqs.map((f, i) => (
                  <details key={i} open={i === 0}><summary>{f.question}<span className="pm-plus"><PlusIcon /></span></summary><div className="pm-ans">{f.answer}</div></details>
                ))}
              </div>
            )}
            {allNeighborhoods.length > 1 && (
              <>
                <h3>Other neighborhoods we serve</h3>
                <div className="pm-areas" style={{ marginTop: 12 }}>
                  {allNeighborhoods.filter(n => n.id !== neighborhood.id).map(n => (
                    <Link key={n.id} className="pm-chip" href={paths.neighborhoodPage(n.slug)}><span className="pm-pin"><PmIconPin /></span>{n.name}</Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      <PremiumFinalCta heading={`Serving ${neighborhood.name}`} sub={`Book your appointment with ${site.name} today.`} ctaStyle="booking" phone={phone} />
    </PremiumShell>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
