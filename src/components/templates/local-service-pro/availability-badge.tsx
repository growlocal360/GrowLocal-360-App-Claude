'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, ArrowRight } from 'lucide-react';

interface AvailabilityBadgeProps {
  siteId: string;
  brandColor?: string;
  /** `onDark` renders white-on-translucent for photo/dark heroes regardless of brand color. */
  tone?: 'brand' | 'onDark';
  /** `lg` makes the count the focal point (big number + label), for hero use. */
  size?: 'md' | 'lg';
}

type BadgeState =
  | { kind: 'today'; count: number }
  | { kind: 'next'; label: string }
  | { kind: 'full' };

interface RangeDay { date: string; spotsRemaining: number; totalCapacity: number; isBlocked: boolean }

/** "Tue, Oct 28" from "YYYY-MM-DD" without timezone drift. */
function labelFor(dateStr: string, todayStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  if (diff === 1) return 'tomorrow';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Hero availability pill. Reads the next 7 days from the public availability
 * API (dates resolved in the business's timezone) and says one of:
 *   "N spots available today"  ·  "Next opening: tomorrow / Thu, Oct 29"
 *   "Fully booked this week — call us"
 * It renders nothing when scheduling has no capacity configured at all
 * (no staff or no schedules), so a half-set-up site never claims to be booked.
 */
export function AvailabilityBadge({ siteId, brandColor = '#00ef99', tone = 'brand', size = 'md' }: AvailabilityBadgeProps) {
  const [state, setState] = useState<BadgeState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/availability?siteId=${siteId}&days=7`);
        const data = await res.json();
        if (cancelled || !data?.active || !Array.isArray(data.range) || data.range.length === 0) return;
        const range = data.range as RangeDay[];
        const today = range[0];
        const hasAnyCapacity = range.some((d) => d.totalCapacity > 0);
        if (!hasAnyCapacity) return; // scheduling exists but nothing to offer yet
        if (today.spotsRemaining > 0) {
          setState({ kind: 'today', count: today.spotsRemaining });
          return;
        }
        const next = range.slice(1).find((d) => d.spotsRemaining > 0);
        setState(next ? { kind: 'next', label: labelFor(next.date, today.date) } : { kind: 'full' });
      } catch {
        // Silently fail — badge just won't show
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  if (!state) return null;

  const text =
    state.kind === 'today'
      ? `${state.count} spot${state.count === 1 ? '' : 's'} available today`
      : state.kind === 'next'
        ? `Next opening: ${state.label}`
        : 'Fully booked this week — call us';

  const style = tone === 'onDark'
    ? { borderColor: 'rgba(255,255,255,.28)', backgroundColor: 'rgba(255,255,255,.14)', color: '#fff' }
    : { borderColor: `${brandColor}40`, backgroundColor: `${brandColor}15`, color: brandColor };

  if (size === 'lg') {
    // Conversion moment: the number is the message. Big count, live dot, short label.
    const live = state.kind === 'today';
    const accent = tone === 'onDark' ? '#fff' : brandColor;
    return (
      <div
        className="inline-flex items-center gap-4 border backdrop-blur"
        style={{ ...style, padding: '12px 26px 12px 20px', borderRadius: 20 }}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-8 w-8 shrink-0" aria-hidden="true">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ backgroundColor: '#22c55e' }} />}
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full pm-availarrow" style={{ backgroundColor: live ? '#22c55e' : '#f59e0b' }}>
            <ArrowRight style={{ color: '#fff', width: 18, height: 18 }} strokeWidth={3} />
          </span>
        </span>
        {state.kind === 'today' ? (
          <>
            <span style={{ fontSize: 60, lineHeight: 0.9, fontWeight: 800, letterSpacing: '-0.04em', color: accent }}>{state.count}</span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>spot{state.count === 1 ? '' : 's'} available</span>
              <span style={{ fontSize: 15, opacity: 0.85, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}><CalendarDays className="h-4 w-4" /> today · book before they&apos;re gone</span>
            </span>
          </>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{state.kind === 'next' ? `Next opening: ${state.label}` : 'Fully booked this week'}</span>
            <span style={{ fontSize: 15, opacity: 0.85 }}>{state.kind === 'next' ? 'Book now to hold your spot' : 'Call us to get on the list'}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur" style={style}>
      <CalendarDays className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}
