/**
 * Off-site profiles for a business (Google Business Profile, Facebook, Yelp…).
 * One list drives the settings form, the LocalBusiness `sameAs` array, the
 * footer links and llms.txt, so the entity signals stay consistent everywhere.
 */
export const PROFILE_DEFS = [
  { key: 'google_business', label: 'Google Business Profile', short: 'Google', placeholder: 'https://maps.app.goo.gl/… or https://www.google.com/maps/place/…', hosts: ['google.com', 'goo.gl', 'g.page', 'g.co'] },
  { key: 'facebook', label: 'Facebook', short: 'Facebook', placeholder: 'https://www.facebook.com/yourbusiness', hosts: ['facebook.com', 'fb.com'] },
  { key: 'instagram', label: 'Instagram', short: 'Instagram', placeholder: 'https://www.instagram.com/yourbusiness', hosts: ['instagram.com'] },
  { key: 'youtube', label: 'YouTube', short: 'YouTube', placeholder: 'https://www.youtube.com/@yourbusiness', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'yelp', label: 'Yelp', short: 'Yelp', placeholder: 'https://www.yelp.com/biz/your-business', hosts: ['yelp.com'] },
  { key: 'linkedin', label: 'LinkedIn', short: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/yourbusiness', hosts: ['linkedin.com'] },
  { key: 'tiktok', label: 'TikTok', short: 'TikTok', placeholder: 'https://www.tiktok.com/@yourbusiness', hosts: ['tiktok.com'] },
  { key: 'nextdoor', label: 'Nextdoor', short: 'Nextdoor', placeholder: 'https://nextdoor.com/pages/your-business', hosts: ['nextdoor.com'] },
  { key: 'bbb', label: 'Better Business Bureau', short: 'BBB', placeholder: 'https://www.bbb.org/us/…/profile/…', hosts: ['bbb.org'] },
] as const;

export type ProfileKey = (typeof PROFILE_DEFS)[number]['key'];
export type SiteProfiles = Partial<Record<ProfileKey, string>>;
export interface ProfileLink { key: ProfileKey; label: string; short: string; url: string }

/** Trim, force https, drop blanks and anything that is not a URL. Does not enforce host (owners may use short links). */
export function normalizeProfiles(input: unknown): SiteProfiles {
  const out: SiteProfiles = {};
  if (!input || typeof input !== 'object') return out;
  for (const def of PROFILE_DEFS) {
    const raw = (input as Record<string, unknown>)[def.key];
    if (typeof raw !== 'string') continue;
    let v = raw.trim();
    if (!v) continue;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    try {
      const u = new URL(v);
      if (!u.hostname.includes('.')) continue;
      out[def.key] = u.toString().replace(/\/$/, '');
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/** Ordered links for rendering (only the ones filled in). */
export function profileLinks(profiles: SiteProfiles | null | undefined): ProfileLink[] {
  if (!profiles) return [];
  return PROFILE_DEFS.flatMap((d) => (profiles[d.key] ? [{ key: d.key, label: d.label, short: d.short, url: profiles[d.key]! }] : []));
}

/** Maps link for a connected GBP location, when we know its Place ID. */
export function googleMapsUrlForPlaceId(placeId: string | null | undefined): string | null {
  return placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : null;
}
