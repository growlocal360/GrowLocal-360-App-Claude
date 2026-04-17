'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

export interface NavCategory {
  id: string;
  name: string;
  slug: string;
  isPrimary: boolean;
}

interface SiteHeaderProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  categories?: NavCategory[];
  siteSlug?: string;
  locationSlug?: string;
}

export function SiteHeader({ site, primaryLocation, locationSlug }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const phone = site.settings?.phone || primaryLocation?.phone;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;

  const home = paths.locationHome(locationSlug);
  const navLinks = [
    { label: 'Services', href: paths.servicesIndex(locationSlug) },
    { label: 'Service Areas', href: paths.areasIndex(locationSlug) },
    { label: 'Work', href: paths.workHub(locationSlug) },
    { label: 'FAQ', href: paths.faqPage(locationSlug) },
    { label: 'About', href: paths.aboutPage(locationSlug) },
    { label: 'Contact', href: paths.contactPage(locationSlug) },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo / Business Name */}
        <Link href={home} className="flex shrink-0 items-center gap-2">
          {site.settings?.logo_url ? (
            <Image
              src={site.settings.logo_url}
              alt={site.name}
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              priority
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
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 transition-colors duration-300 hover:text-gray-900"
            >
              <Phone className="h-4 w-4" />
              {phone}
            </a>
          )}
          <Button
            asChild
            style={{ backgroundColor: ctaColor }}
            className="rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
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
        <div className="border-t bg-white/95 px-4 py-4 backdrop-blur-md lg:hidden">
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
              style={{ backgroundColor: ctaColor }}
              className="w-full rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
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
