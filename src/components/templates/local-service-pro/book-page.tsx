'use client';

import { Phone } from 'lucide-react';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing, PublicRenderCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildWebPageSchema, buildBreadcrumbSchema, toBusinessInput, getSiteUrl } from '@/lib/schema';
import { SiteHeader, type NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { PageHero } from './page-hero';
import { UnifiedLeadForm } from './unified-lead-form';
import { AvailabilityBadge } from './availability-badge';
import { bookPageCopy } from '@/lib/sites/book-page-copy';

export interface BookPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  formCategories: PublicRenderCategory[];
  siteSlug: string;
  locationSlug?: string;
  schedulingActive: boolean;
  ctaStyle: 'booking' | 'estimate';
  showAvailabilityBadge: boolean;
  /** Primary service name for the heading, e.g. "Appliance Repair". */
  serviceName: string;
}

/**
 * /book — one job: get the visitor into the form. Availability count up top,
 * the full lead/booking form, and the phone number for people who would
 * rather call. Linked from GBP posts and usable as the profile's
 * "Appointment link".
 */
export function BookPage(props: BookPageProps) {
  const { site, primaryLocation, serviceAreas, categories, formCategories, siteSlug, locationSlug, schedulingActive, ctaStyle, showAvailabilityBadge } = props;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const phone = site.settings?.phone || primaryLocation?.phone;
  const { h1, lede } = bookPageCopy(props);

  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const pageSchema = buildWebPageSchema(h1, lede, siteUrl + paths.bookPage(locationSlug), 'WebPage', businessInput);
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: ctaStyle === 'booking' ? 'Book' : 'Free Estimate', url: paths.bookPage(locationSlug) },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[pageSchema, breadcrumb]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        <PageHero brandColor={brandColor} title={h1} subtitle={lede} compact />
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4">
            {schedulingActive && showAvailabilityBadge && (
              <div className="mb-6 flex justify-center">
                <AvailabilityBadge siteId={site.id} brandColor={brandColor} size="lg" />
              </div>
            )}
            <div id="pm-form" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="section" />
            </div>
            {phone && (
              <p className="mt-6 text-center text-gray-600">
                Rather talk to a person?{' '}
                <a href={`tel:${phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-900 hover:underline">
                  <Phone className="h-4 w-4" style={{ color: brandColor }} /> {phone}
                </a>
              </p>
            )}
          </div>
        </section>
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
