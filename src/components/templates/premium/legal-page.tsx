'use client';

import * as paths from '@/lib/routing/paths';
import type { LegalPageProps } from '@/components/templates/local-service-pro/legal-page';
import { PremiumShell, PremiumPageHero } from './shell';

export function PremiumLegalPage({ site, primaryLocation, serviceAreas, siteSlug, locationSlug, h1, body, updatedAt }: LegalPageProps) {
  return (
    <PremiumShell formOnPage={false} site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug}>
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: h1 }]}
        title={h1}
        lede={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap">
          <div className="pm-prose" style={{ maxWidth: 760 }}>
            {body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>
    </PremiumShell>
  );
}
