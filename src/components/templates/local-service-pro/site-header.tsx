'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';

interface SiteHeaderProps {
  site: Site;
  primaryLocation: Location | null;
}

export function SiteHeader({ site, primaryLocation }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const phone = site.settings?.phone || primaryLocation?.phone;
  const brandColor = site.settings?.brand_color || '#00d9c0';

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo / Business Name */}
        <Link href={`/sites/${site.slug}`} className="flex items-center gap-2">
          {site.settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.settings.logo_url}
              alt={site.name}
              className="h-10 w-auto"
            />
          ) : (
            <span className="text-xl font-bold text-gray-900">
              {site.name}
            </span>
          )}
        </Link>

        {/* Desktop: Phone + CTA */}
        <div className="hidden items-center gap-4 md:flex">
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <Phone className="h-4 w-4" />
              {phone}
            </a>
          )}
          <Button
            asChild
            style={{ backgroundColor: brandColor }}
            className="hover:opacity-90"
          >
            <a href="#contact">Get Free Estimate</a>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Phone className="h-4 w-4" />
                {phone}
              </a>
            )}
            <Button
              asChild
              style={{ backgroundColor: brandColor }}
              className="w-full hover:opacity-90"
            >
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>
                Get Free Estimate
              </a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
