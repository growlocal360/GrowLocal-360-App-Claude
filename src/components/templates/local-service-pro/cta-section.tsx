'use client';

import { Phone, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';

interface CTASectionProps {
  site: Site;
  primaryLocation: Location | null;
}

export function CTASection({ site, primaryLocation }: CTASectionProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const email = site.settings?.email;
  const brandColor = site.settings?.brand_color || '#10b981';

  return (
    <section
      id="contact"
      className="py-20"
      style={{ backgroundColor: brandColor }}
    >
      <div className="mx-auto max-w-7xl px-4 text-center text-white">
        <h2 className="text-3xl font-bold md:text-4xl">
          Ready to Get Started?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
          Contact us today for a free estimate. We&apos;re here to help with all
          your {site.settings?.core_industry?.toLowerCase() || 'service'} needs.
        </p>

        {/* Contact options */}
        <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
          {phone && (
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="min-w-[200px] text-lg"
            >
              <a href={`tel:${phone.replace(/\D/g, '')}`}>
                <Phone className="mr-2 h-5 w-5" />
                {phone}
              </a>
            </Button>
          )}
          {email && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-[200px] border-white text-lg text-white hover:bg-white hover:text-gray-900"
            >
              <a href={`mailto:${email}`}>
                <Mail className="mr-2 h-5 w-5" />
                Email Us
              </a>
            </Button>
          )}
        </div>

        {/* Hours hint */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm opacity-75">
          <Clock className="h-4 w-4" />
          <span>Available 7 days a week</span>
        </div>
      </div>
    </section>
  );
}
