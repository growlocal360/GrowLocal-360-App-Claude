'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderPageContent, PublicRenderServiceListing, PublicRenderAreaListing, PublicRenderTeamMember, PublicRenderWorkItem } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildWebPageSchema,
  buildLocalBusinessSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';
import { BookingWidget } from './booking-widget';
import { EmbeddedMapSection } from './embedded-map-section';
import { TeamSection } from './team-section';
import { RecentWorkSection } from './about/recent-work-section';

interface ContactPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  pageContent: PublicRenderPageContent | null;
  services?: PublicRenderServiceListing[];
  serviceAreas?: PublicRenderAreaListing[];
  teamMembers?: PublicRenderTeamMember[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
  ctaStyle?: 'booking' | 'estimate';
  schedulingActive?: boolean;
}

export function ContactPage({ site, primaryLocation, pageContent, services, serviceAreas, teamMembers, categories, siteSlug, locationSlug, recentWorkItems, ctaStyle = 'booking', schedulingActive = false }: ContactPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || primaryLocation?.phone;
  const email = site.settings?.email;

  const h1 = pageContent?.h1 || `Contact ${site.name}`;
  const heroDescription = pageContent?.hero_description || '';
  const bodyCopy = pageContent?.body_copy || '';

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const contactPageSchema = buildWebPageSchema(
    h1,
    heroDescription || `Get in touch with ${site.name}`,
    siteUrl + paths.contactPage(locationSlug),
    'ContactPage',
    businessInput
  );
  const localBusinessSchema = primaryLocation
    ? buildLocalBusinessSchema(businessInput, toLocationInput(primaryLocation))
    : null;

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[contactPageSchema, localBusinessSchema]} />
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

        {/* Body + Contact Info */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-10 lg:grid-cols-2">
              {/* Left: body copy + contact info card */}
              <div>
                {bodyCopy && (
                  <div className="prose prose-lg mb-8 max-w-none text-gray-700">
                    {bodyCopy.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                )}

                <Card className="border-0 shadow-md">
                  <CardContent className="space-y-4 p-6">
                    <h3 className="text-lg font-semibold text-gray-900">Get In Touch</h3>
                    {primaryLocation && (
                      <div className="flex items-start gap-3 text-gray-700">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: brandColor }} />
                        <div>
                          <p>{primaryLocation.address_line1}</p>
                          <p>{primaryLocation.city}, {primaryLocation.state} {primaryLocation.zip_code}</p>
                        </div>
                      </div>
                    )}
                    {phone && (
                      <a href={`tel:${phone.replace(/\D/g, '')}`} className="flex items-center gap-3 text-gray-700 hover:text-gray-900">
                        <Phone className="h-5 w-5 shrink-0" style={{ color: brandColor }} />
                        <span>{phone}</span>
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="flex items-center gap-3 text-gray-700 hover:text-gray-900">
                        <Mail className="h-5 w-5 shrink-0" style={{ color: brandColor }} />
                        <span>{email}</span>
                      </a>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </section>

        <TeamSection teamMembers={teamMembers || []} brandColor={brandColor} />
        <RecentWorkSection workItems={recentWorkItems ?? []} brandColor={brandColor} siteSlug={siteSlug} locationSlug={locationSlug} />
        {schedulingActive ? (
          <BookingWidget siteId={site.id} brandColor={brandColor} services={services} ctaStyle={ctaStyle} />
        ) : (
          <LeadCaptureSection siteId={site.id} brandColor={brandColor} services={services} ctaStyle={ctaStyle} />
        )}
        <EmbeddedMapSection primaryLocation={primaryLocation} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
