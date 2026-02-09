'use client';

import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location, ServiceAreaDB } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';

interface JobsPageProps {
  site: Site;
  primaryLocation: Location | null;
  serviceAreas?: ServiceAreaDB[];
  categories?: NavCategory[];
  siteSlug: string;
}

export function JobsPage({ site, primaryLocation, serviceAreas, categories, siteSlug }: JobsPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const industry = site.settings?.core_industry || 'our industry';

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Career Opportunities at {site.name}
            </h1>
            <p className="mt-4 text-lg text-white/90">
              Join our team of {industry.toLowerCase()} professionals
              {primaryLocation ? ` in ${primaryLocation.city}, ${primaryLocation.state}` : ''}.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Briefcase className="mx-auto mb-6 h-16 w-16 text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900">
              We&apos;re Always Looking for Great People
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              {site.name} is always looking for talented, dedicated professionals to join our growing team.
              We offer competitive pay, a supportive work environment, and opportunities to grow your career
              in {industry.toLowerCase()}.
            </p>
            <p className="mt-4 text-gray-600">
              Check back soon for open positions, or reach out to us directly if you&apos;re interested in joining our team.
            </p>
            <div className="mt-8">
              <Button
                asChild
                size="lg"
                style={{ backgroundColor: brandColor }}
                className="hover:opacity-90"
              >
                <a href="/contact">Contact Us About Opportunities</a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} />
    </div>
  );
}
