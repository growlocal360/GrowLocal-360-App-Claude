'use client';

import type { PublicRenderSite, PublicRenderLocation } from '@/lib/sites/public-render-model';
import { PmIconPhone, PmIconArrow } from './icons';

/**
 * Sticky bottom action bar shown on mobile only (hidden >= 940px, where the
 * desktop nav CTA takes over). Left: the site's CTA (label set in admin —
 * e.g. "Request Service" / "Book Online"). Right: Call Now (only if a phone exists).
 */
export function PremiumMobileBar({ site, primaryLocation, ctaLabel, ctaHref }: {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  ctaLabel: string;
  ctaHref: string;
}) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  return (
    <div className={`pm-mbar${phoneHref ? '' : ' pm-mbar--single'}`} role="navigation" aria-label="Quick actions">
      <a className="pm-mbar-btn pm-mbar-cta" href={ctaHref}>
        {ctaLabel} <PmIconArrow />
      </a>
      {phoneHref && (
        <a className="pm-mbar-btn pm-mbar-call" href={phoneHref} aria-label={`Call now ${phone}`}>
          <PmIconPhone style={{ width: 18, height: 18 }} /> Call Now
        </a>
      )}
    </div>
  );
}
