'use client';

import type {
  PublicRenderSite,
  PublicRenderLocation,
  PublicRenderPageContent,
  PublicRenderAreaListing,
  PublicRenderTeamMember,
  PublicRenderServiceListing,
  PublicRenderWorkItem,
  PublicRenderReview,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildAboutPageSchema,
  buildWebPageSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';
import { TeamSection } from './team-section';
import { FounderSection } from './about/founder-section';
import { MissionValuesSection } from './about/mission-values-section';
import { ServicesOverviewSection } from './about/services-overview-section';
import { ExperienceSection } from './about/experience-section';
import { LocalConnectionSection } from './about/local-connection-section';
import { RecentWorkSection } from './about/recent-work-section';
import { TrustSignalsSection } from './about/trust-signals-section';
import { AboutCTASection } from './about/about-cta-section';

interface AboutPageProps {
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
}

export function AboutPage({
  site,
  primaryLocation,
  pageContent,
  serviceAreas,
  teamMembers,
  categories,
  services,
  workItems,
  reviews,
  siteSlug,
  locationSlug,
}: AboutPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const phone = site.settings?.phone || primaryLocation?.phone;

  const h1 = pageContent?.h1 || `About ${site.name}`;
  const heroDescription = pageContent?.hero_description || '';
  const sections = pageContent?.sections;
  const hasNewSections = !!sections;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const aboutUrl = siteUrl + paths.aboutPage(locationSlug);

  // Build enhanced schema if we have location data, otherwise fallback
  const owner = teamMembers?.find((m) => m.role === 'owner');
  const employees = teamMembers?.filter((m) => m.role !== 'owner') || [];

  const schemaData = primaryLocation
    ? buildAboutPageSchema(
        businessInput,
        toLocationInput(primaryLocation),
        aboutUrl,
        owner
          ? { name: owner.full_name, jobTitle: owner.title, imageUrl: owner.avatar_url }
          : null,
        employees.map((e) => ({
          name: e.full_name,
          jobTitle: e.title,
          imageUrl: e.avatar_url,
        }))
      )
    : [
        buildWebPageSchema(
          h1,
          heroDescription || `Learn more about ${site.name}`,
          aboutUrl,
          'AboutPage',
          businessInput
        ),
      ];

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={schemaData} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">{h1}</h1>
            {heroDescription && (
              <p className="mt-4 text-lg text-white/90">{heroDescription}</p>
            )}
          </div>
        </section>

        {hasNewSections ? (
          <>
            {/* Enhanced EEAT layout */}
            <FounderSection sections={sections} teamMembers={teamMembers || []} brandColor={brandColor} />
            <MissionValuesSection sections={sections} brandColor={brandColor} />
            <ServicesOverviewSection
              services={services || []}
              categories={categories || []}
              brandColor={brandColor}
              siteSlug={siteSlug}
              locationSlug={locationSlug}
            />
            <ExperienceSection sections={sections} brandColor={brandColor} />
            <LocalConnectionSection sections={sections} serviceAreas={serviceAreas || []} brandColor={brandColor} />
            <TeamSection teamMembers={teamMembers || []} brandColor={brandColor} />
            <RecentWorkSection
              workItems={workItems || []}
              brandColor={brandColor}
              siteSlug={siteSlug}
              locationSlug={locationSlug}
            />
            <TrustSignalsSection
              sections={sections}
              reviews={reviews || []}
              brandColor={brandColor}
              averageRating={site.settings?.google_average_rating}
              totalReviews={site.settings?.google_total_reviews}
            />
            <AboutCTASection
              sections={sections}
              brandColor={brandColor}
              phone={phone}
              siteSlug={siteSlug}
              locationSlug={locationSlug}
            />
          </>
        ) : (
          <>
            {/* Legacy layout for sites that haven't regenerated */}
            {pageContent?.body_copy && (
              <section className="py-16">
                <div className="mx-auto max-w-3xl px-4">
                  <div className="prose prose-lg max-w-none text-gray-700">
                    {pageContent.body_copy.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {pageContent?.body_copy_2 && (
              <section className="bg-gray-50 py-16">
                <div className="mx-auto max-w-3xl px-4">
                  <div className="prose prose-lg max-w-none text-gray-700">
                    {pageContent.body_copy_2.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </section>
            )}
            <TeamSection teamMembers={teamMembers || []} brandColor={brandColor} />
            <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
          </>
        )}
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
