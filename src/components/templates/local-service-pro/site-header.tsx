'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Phone, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';

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
}

export function SiteHeader({ site, primaryLocation, categories, siteSlug }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const phone = site.settings?.phone || primaryLocation?.phone;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const slug = siteSlug || site.slug;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setServicesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasMultipleCategories = categories && categories.length > 1;

  const navLinks = [
    { label: 'Service Areas', href: `/sites/${slug}#service-areas` },
    { label: 'About', href: `/sites/${slug}/about` },
    { label: 'Jobs', href: `/sites/${slug}/jobs` },
    { label: 'Contact', href: `/sites/${slug}/contact` },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo / Business Name */}
        <Link href={`/sites/${slug}`} className="flex shrink-0 items-center gap-2">
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
          {/* Services - dropdown if multiple categories, simple link if one */}
          {hasMultipleCategories ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Services
                <ChevronDown className={`h-4 w-4 transition-transform ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {servicesDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-white py-1 shadow-lg">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={cat.isPrimary ? `/sites/${slug}` : `/sites/${slug}/${cat.slug}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setServicesDropdownOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/sites/${slug}#services`}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Services
            </Link>
          )}

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
            {/* Services section */}
            {hasMultipleCategories ? (
              <>
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Services
                </p>
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={cat.isPrimary ? `/sites/${slug}` : `/sites/${slug}/${cat.slug}`}
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}
                <hr className="my-2" />
              </>
            ) : (
              <Link
                href={`/sites/${slug}#services`}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </Link>
            )}

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
