'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Phone, MapPin } from 'lucide-react';
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

  const navLinks = [
    { href: '#services', label: 'Services' },
    { href: '#areas', label: 'Service Areas' },
    { href: '#locations', label: 'Locations' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top bar with contact info */}
      {(phone || primaryLocation) && (
        <div className="bg-gray-900 px-4 py-2 text-sm text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              {primaryLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {primaryLocation.city}, {primaryLocation.state}
                </span>
              )}
            </div>
            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-1 font-medium hover:text-[#00d9c0]"
              >
                <Phone className="h-3 w-3" />
                {phone}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main navigation */}
      <nav className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Business Name */}
          <Link href={`/sites/${site.slug}`} className="flex items-center gap-2">
            {site.settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.settings.logo_url}
                alt={site.name}
                className="h-10 w-auto"
              />
            ) : (
              <span
                className="text-xl font-bold"
                style={{ color: brandColor }}
              >
                {site.name}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </a>
            ))}
            {phone && (
              <Button
                asChild
                style={{ backgroundColor: brandColor }}
                className="hover:opacity-90"
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </a>
              </Button>
            )}
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
          <div className="mt-4 border-t pt-4 md:hidden">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              {phone && (
                <Button
                  asChild
                  style={{ backgroundColor: brandColor }}
                  className="w-full hover:opacity-90"
                >
                  <a href={`tel:${phone.replace(/\D/g, '')}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call Now
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
