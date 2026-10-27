'use client';

import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';

interface AvailabilityBadgeProps {
  siteId: string;
  brandColor?: string;
  /** `onDark` renders white-on-translucent for photo/dark heroes regardless of brand color. */
  tone?: 'brand' | 'onDark';
}

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
export function AvailabilityBadge({ siteId, brandColor = '#00ef99', tone = 'brand' }: AvailabilityBadgeProps) {
  const [text, setText] = useState<string | null>(null);

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
          setText(`${today.spotsRemaining} spot${today.spotsRemaining === 1 ? '' : 's'} available today`);
          return;
        }
        const next = range.slice(1).find((d) => d.spotsRemaining > 0);
        setText(next ? `Next opening: ${labelFor(next.date, today.date)}` : 'Fully booked this week — call us');
      } catch {
        // Silently fail — badge just won't show
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  if (!text) return null;

  const style = tone === 'onDark'
    ? { borderColor: 'rgba(255,255,255,.28)', backgroundColor: 'rgba(255,255,255,.14)', color: '#fff' }
    : { borderColor: `${brandColor}40`, backgroundColor: `${brandColor}15`, color: brandColor };

  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur" style={style}>
      <CalendarDays className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}
