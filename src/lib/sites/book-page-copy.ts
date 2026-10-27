// Headline, lede and meta for the /book page. Plain module so both the
// server route (metadata) and the client templates can use it.

/** Copy shared by both templates so the page says the same thing everywhere. */
export interface BookPageCopyInput {
  ctaStyle: 'booking' | 'estimate';
  serviceName: string;
  primaryLocation: { city?: string | null } | null;
  site: { name: string };
}

const SMALL = new Set(['and', 'or', 'of', 'the', 'for', 'to', 'in', 'a', 'an']);
/** "appliance repair service" → "Appliance Repair Service" (GBP categories arrive lowercase). */
export function titleCaseService(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function bookPageCopy(input: BookPageCopyInput) {
  const p = { ...input, serviceName: titleCaseService(input.serviceName) };
  const city = p.primaryLocation?.city || '';
  const booking = p.ctaStyle === 'booking';
  return {
    h1: booking ? `Book ${p.serviceName}${city ? ` in ${city}` : ''}` : `Get a Free ${p.serviceName} Estimate${city ? ` in ${city}` : ''}`,
    lede: booking
      ? 'Pick your service, tell us what is going on, and choose a time that works. We confirm by text or phone.'
      : 'Tell us what you need and where. We reply with a clear estimate, usually the same business day.',
    metaTitle: booking ? `Book ${p.serviceName}${city ? ` in ${city}` : ''} | ${p.site.name}` : `Free ${p.serviceName} Estimate${city ? ` in ${city}` : ''} | ${p.site.name}`,
    metaDescription: booking
      ? `Book ${p.serviceName.toLowerCase()} online with ${p.site.name}${city ? ` in ${city}` : ''}. See today's openings and reserve a time in under a minute.`
      : `Request a free ${p.serviceName.toLowerCase()} estimate from ${p.site.name}${city ? ` in ${city}` : ''}. Fast replies, no obligation.`,
  };
}

