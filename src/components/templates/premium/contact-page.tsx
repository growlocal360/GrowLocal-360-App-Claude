'use client';

import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderPageContent,
  PublicRenderServiceListing, PublicRenderCategory, PublicRenderAreaListing,
  PublicRenderTeamMember, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero } from './shell';
import { PmIconPhone, PmIconClock, PmIconPin } from './icons';

interface PremiumContactPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  pageContent: PublicRenderPageContent | null;
  services?: PublicRenderServiceListing[];
  formCategories?: PublicRenderCategory[];
  serviceAreas?: PublicRenderAreaListing[];
  teamMembers?: PublicRenderTeamMember[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
  ctaStyle?: 'booking' | 'estimate';
  schedulingActive?: boolean;
}

const EmailIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>;

export function PremiumContactPage({
  site, primaryLocation, pageContent, formCategories, serviceAreas = [],
  siteSlug, locationSlug, ctaStyle = 'booking', schedulingActive = false,
}: PremiumContactPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const phone = site.settings?.phone || primaryLocation?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  const email = site.settings?.email as string | undefined;
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';

  const h1 = pageContent?.h1 || 'Contact Us';
  const lede = pageContent?.hero_description || `Call, book online, or send a message — we respond fast${cityState ? ` across ${primaryLocation?.city}` : ''}.`;

  const areaNames = serviceAreas.slice(0, 4).map(a => a.name).join(', ');

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Contact', url: paths.contactPage(locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />

      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Contact' }]}
        title={h1}
        lede={lede}
      />

      <section className="pm-block">
        <div className="pm-wrap pm-contactgrid">
          {/* form */}
          <div className="pm-contactcard" id="pm-form">
            <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="section" />
          </div>

          {/* info */}
          <div className="pm-cinfo">
            {phoneHref && (
              <a className="pm-cirow" href={phoneHref}>
                <span className="pm-icon sm"><PmIconPhone /></span>
                <div><div className="pm-lbl">Call or text</div><div className="pm-val">{phone}</div></div>
              </a>
            )}
            {email && (
              <a className="pm-cirow" href={`mailto:${email}`}>
                <span className="pm-icon sm"><EmailIcon /></span>
                <div><div className="pm-lbl">Email</div><div className="pm-val sm">{email}</div></div>
              </a>
            )}
            {(cityState || areaNames) && (
              <div className="pm-cirow">
                <span className="pm-icon sm"><PmIconPin /></span>
                <div><div className="pm-lbl">Service area</div><div className="pm-val sm">{areaNames || cityState}</div></div>
              </div>
            )}
            <div className="pm-cirow" style={{ display: 'block' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 6 }}>
                <span className="pm-icon sm"><PmIconClock /></span>
                <div className="pm-lbl">Hours</div>
              </div>
              <div className="pm-hours">
                <div className="pm-h"><span className="pm-d">Monday – Friday</span><span className="pm-open">Open</span></div>
                <div className="pm-h"><span className="pm-d">Saturday</span><span className="pm-open">Open</span></div>
                <div className="pm-h"><span className="pm-d">Sunday</span><span style={{ color: 'var(--muted)' }}>By appointment</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PremiumShell>
  );
}
