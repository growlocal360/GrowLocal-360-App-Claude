'use client';

import { Wrench } from 'lucide-react';

/**
 * Custom line-icon set for the appliance intake cards. Drawn to match the Lucide
 * visual language used elsewhere (24×24, 1.5 stroke, round caps/joins, no fill)
 * and stroked with `currentColor` so they inherit the card's text color — dark
 * when idle, the site accent color when selected.
 *
 * Keyed by the `icon` value on each appliance option in niche-forms.ts.
 */

interface IconProps {
  name?: string;
  className?: string;
}

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ApplianceIcon({ name, className = 'h-7 w-7' }: IconProps) {
  const svg = (children: React.ReactNode) => (
    <svg className={className} {...baseProps} aria-hidden>
      {children}
    </svg>
  );

  switch (name) {
    case 'refrigerator':
      return svg(<>
        <rect x="6" y="2.5" width="12" height="19" rx="2" />
        <line x1="6" y1="9.5" x2="18" y2="9.5" />
        <line x1="9" y1="5" x2="9" y2="7.5" />
        <line x1="9" y1="12" x2="9" y2="15" />
      </>);

    case 'washer':
      return svg(<>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="7" x2="20" y2="7" />
        <circle cx="12" cy="14" r="4.2" />
        <circle cx="12" cy="14" r="1.4" />
        <circle cx="6.75" cy="5" r="0.5" />
        <circle cx="9.25" cy="5" r="0.5" />
      </>);

    case 'dryer':
      return svg(<>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="7" x2="20" y2="7" />
        <circle cx="12" cy="14" r="4.2" />
        <path d="M10 14 q1 -1.5 2 0 t2 0" />
        <circle cx="16.5" cy="5" r="0.5" />
      </>);

    case 'dishwasher':
      return svg(<>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="7" y1="5" x2="13" y2="5" />
        <line x1="9" y1="10.5" x2="9" y2="18" />
        <line x1="12" y1="10.5" x2="12" y2="18" />
        <line x1="15" y1="10.5" x2="15" y2="18" />
      </>);

    case 'oven':
      return svg(<>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="8.5" x2="20" y2="8.5" />
        <circle cx="8" cy="5.75" r="1" />
        <circle cx="16" cy="5.75" r="1" />
        <line x1="7" y1="10.5" x2="17" y2="10.5" />
        <rect x="7" y="12" width="10" height="6.5" rx="1" />
      </>);

    case 'microwave':
      return svg(<>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <rect x="4.5" y="7" width="10" height="10" rx="1" />
        <line x1="17" y1="8" x2="19" y2="8" />
        <line x1="17" y1="10.5" x2="19" y2="10.5" />
        <circle cx="18" cy="14.5" r="1" />
      </>);

    case 'freezer':
      return svg(<>
        <rect x="3" y="6.5" width="18" height="11" rx="2" />
        <line x1="3" y1="10.5" x2="21" y2="10.5" />
        <line x1="6" y1="8.5" x2="9" y2="8.5" />
      </>);

    case 'ice-maker':
      return svg(<>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <line x1="12" y1="6" x2="12" y2="12" />
        <line x1="9.4" y1="7.5" x2="14.6" y2="10.5" />
        <line x1="14.6" y1="7.5" x2="9.4" y2="10.5" />
        <path d="M8 16 h8 v1.5 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 z" />
      </>);

    case 'garbage-disposal':
      return svg(<>
        <path d="M6 4 h12 l-2.5 5 h-7 z" />
        <rect x="8.5" y="9" width="7" height="7" rx="1" />
        <line x1="10.5" y1="16" x2="10.5" y2="18" />
        <line x1="13.5" y1="16" x2="13.5" y2="18" />
        <rect x="10" y="18.5" width="4" height="2" rx="0.5" />
      </>);

    case 'wine-cooler':
      return svg(<>
        <rect x="5.5" y="2.5" width="13" height="19" rx="2" />
        <line x1="14.5" y1="2.5" x2="14.5" y2="21.5" />
        <line x1="5.5" y1="8" x2="14.5" y2="8" />
        <line x1="5.5" y1="13" x2="14.5" y2="13" />
        <line x1="16.5" y1="9" x2="16.5" y2="12" />
      </>);

    case 'other':
      return <Wrench className={className} strokeWidth={1.5} aria-hidden />;

    default:
      return null;
  }
}
