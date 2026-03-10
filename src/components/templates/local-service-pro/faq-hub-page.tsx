'use client';

import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Location, SitePage, ServiceAreaDB } from '@/types/database';
import type { FAQHubItem } from '@/lib/sites/get-faq-hub';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildWebPageSchema,
  getSiteUrl,
  toBusinessInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';

interface FAQHubPageProps {
  site: Site;
  primaryLocation: Location | null;
  pageContent: SitePage | null;
  faqItems: FAQHubItem[];
  topicGroups: string[];
  serviceAreas?: ServiceAreaDB[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
}

export function FAQHubPage({
  site,
  primaryLocation,
  pageContent,
  faqItems,
  topicGroups,
  serviceAreas,
  categories,
  siteSlug,
  locationSlug,
}: FAQHubPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';

  const h1 = pageContent?.h1 || `Frequently Asked Questions${city ? ` — ${site.name} in ${city}` : ''}`;
  const heroDescription = pageContent?.hero_description || `Find answers to common questions about our services${city ? ` in ${city} and surrounding areas` : ''}.`;

  // Schema.org — WebPage (NOT FAQPage, since this is a question index)
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const webPageSchema = buildWebPageSchema(
    h1,
    heroDescription,
    siteUrl + paths.faqPage(locationSlug),
    'WebPage',
    businessInput
  );

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[webPageSchema]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">{h1}</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">{heroDescription}</p>
          </div>
        </section>

        {/* Topic Navigation */}
        {topicGroups.length > 1 && (
          <section className="border-b bg-gray-50 py-6">
            <div className="mx-auto max-w-7xl px-4">
              <div className="flex flex-wrap gap-2">
                {topicGroups.map((group) => (
                  <a
                    key={group}
                    href={`#${topicGroupId(group)}`}
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:shadow-sm"
                  >
                    {group}
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ Groups */}
        {topicGroups.length > 0 ? (
          <section className="py-16">
            <div className="mx-auto max-w-4xl px-4">
              <div className="space-y-16">
                {topicGroups.map((group) => {
                  const groupItems = faqItems.filter(item => item.topicGroup === group);
                  if (groupItems.length === 0) return null;

                  return (
                    <div key={group} id={topicGroupId(group)} className="scroll-mt-24">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <HelpCircle className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{group}</h2>
                      </div>

                      <div className="mt-6 space-y-4">
                        {groupItems.map((item, i) => (
                          <Card key={i} className="transition-all hover:shadow-md">
                            <CardContent className="p-5">
                              <h3 className="font-semibold text-gray-900">{item.question}</h3>
                              <p className="mt-2 text-sm text-gray-600">{item.teaserAnswer}</p>
                              <Link
                                href={item.canonicalUrl}
                                className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
                                style={{ color: brandColor }}
                              >
                                Read full answer on {item.canonicalPageTitle}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16">
            <div className="mx-auto max-w-4xl px-4 text-center">
              <p className="text-gray-500">FAQ content is being generated. Check back soon.</p>
            </div>
          </section>
        )}

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}

/** Convert a topic group name to a valid HTML id for anchor links */
function topicGroupId(group: string): string {
  return group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
