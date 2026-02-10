'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';
import * as paths from '@/lib/routing/paths';

export interface NavCategory {
  name: string;
  slug: string;
  isPrimary: boolean;
}

interface SiteHeaderProps {
  site: Site;
  primaryLocation: Location | null;
  categories?: NavCategory[];
  siteSlug?: string;
  locationSlug?: string;
}

export function SiteHeader({ site, primaryLocation, locationSlug }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const phone = site.settings?.phone || primaryLocation?.phone;
  const brandColor = site.settings?.brand_color || '#00d9c0';

  const home = paths.locationHome(locationSlug);
  const navLinks = [
    { label: 'Services', href: paths.servicesIndex(locationSlug) },
    { label: 'Service Areas', href: paths.areasIndex(locationSlug) },
    { label: 'About', href: paths.aboutPage(locationSlug) },
    { label: 'Jobs', href: paths.jobsPage(locationSlug) },
    { label: 'Contact', href: paths.contactPage(locationSlug) },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo / Business Name */}
        <Link href={home} className="flex shrink-0 items-center gap-2">
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

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop: Phone + CTA */}
        <div className="hidden items-center gap-4 lg:flex">
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
          className="lg:hidden"
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
        <div className="border-t px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <hr className="my-2" />

            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700"
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
