import type { SupabaseClient } from '@supabase/supabase-js';
import { GBPClient, type GBPLocation } from '@/lib/google/gbp-client';
import { getStoredGoogleToken } from '@/lib/google/stored-token';

/**
 * Profile-change watch: a nightly snapshot of the fields on the Google
 * Business Profile that owners care about (name, phone, website, address,
 * categories, hours, open status, description), diffed against the last
 * snapshot. Google edits, suggested edits that get auto-accepted, and
 * well-meaning staff all change these without telling anyone.
 */

export interface ProfileSnapshot {
  title: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  hours: string[]; // "MONDAY 08:00-17:00"
  openStatus: string | null;
  description: string | null;
}

export interface ProfileChange { field: string; label: string; before: string; after: string }

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

type LocationWithExtras = Omit<GBPLocation, 'regularHours'> & {
  openInfo?: { status?: string };
  profile?: { description?: string };
  regularHours?: { periods?: { openDay: string; openTime: { hours?: number; minutes?: number } | string; closeDay: string; closeTime: { hours?: number; minutes?: number } | string }[] };
};

function fmtTime(t: { hours?: number; minutes?: number } | string | undefined): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return `${String(t.hours ?? 0).padStart(2, '0')}:${String(t.minutes ?? 0).padStart(2, '0')}`;
}

export function normalizeSnapshot(loc: LocationWithExtras): ProfileSnapshot {
  const addr = loc.storefrontAddress
    ? [...(loc.storefrontAddress.addressLines || []), loc.storefrontAddress.locality, loc.storefrontAddress.administrativeArea, loc.storefrontAddress.postalCode].filter(Boolean).join(', ')
    : null;
  const hours = (loc.regularHours?.periods || [])
    .map((p) => `${p.openDay} ${fmtTime(p.openTime)}-${fmtTime(p.closeTime)}${p.closeDay && p.closeDay !== p.openDay ? ` (${p.closeDay})` : ''}`)
    .sort((a, b) => DAYS.indexOf(a.split(' ')[0]) - DAYS.indexOf(b.split(' ')[0]) || a.localeCompare(b));
  return {
    title: loc.title || null,
    phone: loc.phoneNumbers?.primaryPhone || null,
    website: loc.websiteUri || null,
    address: addr,
    primaryCategory: loc.categories?.primaryCategory?.displayName || null,
    additionalCategories: (loc.categories?.additionalCategories || []).map((c) => c.displayName).sort(),
    hours,
    openStatus: loc.openInfo?.status || null,
    description: loc.profile?.description || null,
  };
}

const LABELS: Record<keyof ProfileSnapshot, string> = {
  title: 'Business name',
  phone: 'Phone number',
  website: 'Website link',
  address: 'Address',
  primaryCategory: 'Primary category',
  additionalCategories: 'Additional categories',
  hours: 'Hours',
  openStatus: 'Open status',
  description: 'Business description',
};

const show = (v: string | string[] | null): string => (Array.isArray(v) ? (v.length ? v.join('; ') : '(none)') : v ?? '(empty)');

export function diffSnapshots(before: ProfileSnapshot, after: ProfileSnapshot): ProfileChange[] {
  const out: ProfileChange[] = [];
  for (const key of Object.keys(LABELS) as (keyof ProfileSnapshot)[]) {
    const a = before[key];
    const b = after[key];
    const same = Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : (a ?? null) === (b ?? null);
    if (!same) out.push({ field: key, label: LABELS[key], before: show(a), after: show(b) });
  }
  return out;
}

export interface WatchResult { siteId: string; status: 'first_snapshot' | 'unchanged' | 'changed' | 'skipped'; changes?: ProfileChange[]; reason?: string }

/** Fetch the live profile, compare with the stored snapshot, persist both the snapshot and any changes. */
export async function watchSiteProfile(supabase: SupabaseClient, siteId: string): Promise<WatchResult> {
  const { data: location } = await supabase.from('locations').select('gbp_location_id').eq('site_id', siteId).not('gbp_location_id', 'is', null).order('is_primary', { ascending: false }).limit(1).maybeSingle();
  if (!location?.gbp_location_id) return { siteId, status: 'skipped', reason: 'no GBP location' };
  const token = await getStoredGoogleToken(supabase, siteId);
  if (!token) return { siteId, status: 'skipped', reason: 'no Google token' };

  const name = location.gbp_location_id.startsWith('locations/') ? location.gbp_location_id : `locations/${location.gbp_location_id}`;
  const live = normalizeSnapshot(await new GBPClient(token).getLocationProfile(name));

  const { data: prev } = await supabase.from('gbp_profile_snapshots').select('snapshot').eq('site_id', siteId).maybeSingle();
  const now = new Date().toISOString();
  await supabase.from('gbp_profile_snapshots').upsert({ site_id: siteId, snapshot: live, taken_at: now }, { onConflict: 'site_id' });
  if (!prev) return { siteId, status: 'first_snapshot' };

  const changes = diffSnapshots(prev.snapshot as ProfileSnapshot, live);
  if (changes.length === 0) return { siteId, status: 'unchanged' };
  await supabase.from('gbp_profile_changes').insert({ site_id: siteId, changes, detected_at: now });
  return { siteId, status: 'changed', changes };
}
