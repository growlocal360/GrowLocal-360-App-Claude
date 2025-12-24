'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import type { Site, Location } from '@/types/database';

interface SiteFooterProps {
  site: Site;
  primaryLocation: Location | null;
}

export function SiteFooter({ site, primaryLocation }: SiteFooterProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const email = site.settings?.email;
  const brandColor = site.settings?.brand_color || '#10b981';
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 py-12 text-gray-400">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Business Info */}
          <div>
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: brandColor }}
            >
              {site.name}
            </h3>
            {primaryLocation && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p>{primaryLocation.address_line1}</p>
                  <p>
                    {primaryLocation.city}, {primaryLocation.state}{' '}
                    {primaryLocation.zip_code}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Contact</h3>
            <div className="space-y-2 text-sm">
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
                <a href="#services" className="hover:text-white">
                  Services
                </a>
              </li>
              <li>
                <a href="#areas" className="hover:text-white">
                  Service Areas
                </a>
              </li>
              <li>
                <a href="#locations" className="hover:text-white">
                  Locations
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-gray-800 pt-8 text-center text-sm">
          <p>
            &copy; {currentYear} {site.name}. All rights reserved.
          </p>
          <p className="mt-2 text-xs text-gray-500">
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
