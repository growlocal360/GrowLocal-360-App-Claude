'use client';

import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import type { Site, Location, ServiceAreaDB } from '@/types/database';
import * as paths from '@/lib/routing/paths';

interface SiteFooterProps {
  site: Site;
  primaryLocation: Location | null;
  serviceAreas?: ServiceAreaDB[];
  siteSlug?: string;
  locationSlug?: string;
}

export function SiteFooter({ site, primaryLocation, serviceAreas, siteSlug, locationSlug }: SiteFooterProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const email = site.settings?.email;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const currentYear = new Date().getFullYear();
  const slug = siteSlug || site.slug;

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Contact Info */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Contact Info
            </h3>
            <div className="space-y-3 text-sm">
              {primaryLocation && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>{primaryLocation.address_line1}</p>
                    <p>
                      {primaryLocation.city}, {primaryLocation.state}{' '}
                      {primaryLocation.zip_code}
                    </p>
                  </div>
                </div>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/\D/g, '')}`}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Phone className="h-4 w-4" />
                  {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                  {email}
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={paths.locationHome(locationSlug)} className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href={paths.aboutPage(locationSlug)} className="hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href={paths.servicesIndex(locationSlug)} className="hover:text-white">
                  Services
                </Link>
              </li>
              <li>
                <Link href={paths.areasIndex(locationSlug)} className="hover:text-white">
                  Service Areas
                </Link>
              </li>
              <li>
                <Link href={paths.workHub(locationSlug)} className="hover:text-white">
                  Work
                </Link>
              </li>
              <li>
                <Link href={paths.jobsPage(locationSlug)} className="hover:text-white">
                  Jobs
                </Link>
              </li>
              <li>
                <Link href={paths.contactPage(locationSlug)} className="hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Service Areas */}
          {serviceAreas && serviceAreas.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">
                Service Areas
              </h3>
              <ul className="space-y-2 text-sm">
                {serviceAreas.slice(0, 8).map((area) => (
                  <li key={area.id}>
                    <Link
                      href={paths.areaPage(area.slug, locationSlug)}
                      className="hover:text-white"
                    >
                      {area.name}{area.state ? `, ${area.state}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm">
          <p>&copy; {currentYear} {site.name}. All rights reserved.</p>
          <p className="mt-1 text-xs text-gray-500">
            Powered by{' '}
            <a
              href="/"
              className="hover:text-white"
              style={{ color: brandColor }}
            >
              GrowLocal 360
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
