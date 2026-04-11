'use client';

import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';

interface AvailabilityBadgeProps {
  siteId: string;
  brandColor?: string;
}

export function AvailabilityBadge({ siteId, brandColor = '#00ef99' }: AvailabilityBadgeProps) {
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/public/availability?siteId=${siteId}&date=${today}`);
        const data = await res.json();

        if (data.active) {
          setIsActive(true);
          setSpotsRemaining(data.spotsRemaining ?? 0);
        }
      } catch {
        // Silently fail — badge just won't show
      }
    }

    fetchAvailability();
  }, [siteId]);

  if (!isActive || spotsRemaining === null) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur"
      style={{
        borderColor: `${brandColor}40`,
        backgroundColor: `${brandColor}15`,
        color: brandColor,
      }}
    >
      <CalendarDays className="h-4 w-4" />
      {spotsRemaining > 0 ? (
        <span>{spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} available today</span>
      ) : (
        <span>Fully booked today &mdash; call for waitlist</span>
      )}
    </div>
  );
}
