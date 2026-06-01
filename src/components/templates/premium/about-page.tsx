'use client';

import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderPageContent,
  PublicRenderAreaListing, PublicRenderTeamMember, PublicRenderServiceListing,
  PublicRenderWorkItem, PublicRenderReview, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconCheck, PmIconBolt, PmIconDollar, PmIconShield } from './icons';

interface PremiumAboutPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  pageContent: PublicRenderPageContent | null;
  serviceAreas?: PublicRenderAreaListing[];
  teamMembers?: PublicRenderTeamMember[];
  categories?: NavCategory[];
  services?: PublicRenderServiceListing[];
  workItems?: PublicRenderWorkItem[];
  reviews?: PublicRenderReview[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumAboutPage({
  site, primaryLocation, pageContent, serviceAreas = [], siteSlug, locationSlug,
  reviews, ctaStyle = 'booking',
}: PremiumAboutPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';
  const sections = pageContent?.sections || null;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const averageRating = site.settings?.google_average_rating as number | undefined;

  const h1 = pageContent?.h1 || `About ${site.name}`;
  const lede = pageContent?.hero_description || (cityState ? `Trusted local service in ${cityState}.` : 'Trusted local service you can count on.');

  const story = sections?.founder_story || (pageContent?.body_copy ? { heading: 'Our Story', paragraphs: [pageContent.body_copy] } : null);
  const mission = sections?.mission_values;
  const trust = sections?.trust_points;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'About', url: paths.aboutPage(locationSlug) },
  ]);

  const featuredReview = reviews?.find(r => r.comment);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />

      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'About' }]}
        title={h1}
        accent={site.name}
        lede={lede}
      />

      {/* stats */}
      <section className="pm-block" style={{ paddingBottom: 0 }}>
        <div className="pm-wrap">
          <div className="pm-stats">
            <Stat n={averageRating ? averageRating.toFixed(1) : '5.0'} u="★" l="Average Rating" />
            <Stat n={totalReviewCount ? `${totalReviewCount}` : '100'} u="+" l="Happy Customers" />
            <Stat n="100" u="%" l="Satisfaction" />
            <Stat n="1" u="yr" l="Service Warranty" />
          </div>
        </div>
      </section>

      {/* story split */}
      <section className="pm-block">
        <div className="pm-wrap pm-split">
          <div className="pm-prose">
            <span className="pm-eyebrow">Our Story</span>
            <h2 style={{ marginTop: 14 }}>{story?.heading || 'Built one honest job at a time'}</h2>
            {(story?.paragraphs || [lede]).map((p, i) => <p key={i}>{p}</p>)}
            {mission && (
              <>
                <h3>{mission.heading}</h3>
                {mission.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </>
            )}
          </div>
          <div className="pm-whyvisual">
            {featuredReview && (
              <div className="pm-badge">
                <div className="pm-q">&ldquo;{featuredReview.comment}&rdquo;</div>
                <div className="pm-a">— {featuredReview.author_name || 'Verified customer'}{cityState ? `, ${primaryLocation?.city}` : ''}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* values (dark) */}
      <section className="pm-block pm-dark">
        <div className="pm-wrap">
          <div className="pm-sechead pm-center">
            <span className="pm-eyebrow">{trust?.heading || 'Why Homeowners Choose Us'}</span>
            <h2>The team you’d recommend to a friend</h2>
          </div>
          <div className="pm-grid3">
            {(trust?.points?.slice(0, 3) || [
              { title: 'Fast & Reliable', description: 'Quick scheduling and on-time arrivals, every visit.' },
              { title: 'Upfront Pricing', description: 'You approve the price before any work begins.' },
              { title: 'Guaranteed Work', description: 'Backed by a full satisfaction warranty.' },
            ]).map((pt, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 28 }}>
                <span className="pm-icon" style={{ borderColor: 'color-mix(in srgb,var(--brand) 50%, transparent)', background: 'rgba(255,255,255,.05)' }}>
                  {[<PmIconBolt key="b" />, <PmIconDollar key="d" />, <PmIconShield key="s" />][i % 3]}
                </span>
                <h3 style={{ color: '#fff', fontSize: 21, margin: '18px 0 9px' }}>{pt.title}</h3>
                <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14.5 }}>{pt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PremiumFinalCta heading="Ready to work with the best?" sub={cityState ? `Join your ${primaryLocation?.city} neighbors who trust us.` : 'Join the neighbors who trust us.'} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function Stat({ n, u, l }: { n: string; u?: string; l: string }) {
  return <div className="pm-st"><div className="pm-n">{n}{u && <span className="pm-u">{u}</span>}</div><div className="pm-l">{l}</div></div>;
}
