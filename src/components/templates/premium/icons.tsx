/**
 * Flat line-icons for the premium template — rendered inside .pm-icon
 * stroked circles. Single source so service/why/contact stay consistent.
 * Never use emoji or filled/3D glyphs here.
 */
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const PmIconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
export const PmIconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} strokeWidth={3} {...p}><polyline points="20 6 9 17 4 12"/></svg>
);
export const PmIconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 4 2-7L2 9h7z"/></svg>
);
export const PmIconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
export const PmIconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
export const PmIconBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
export const PmIconDollar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
export const PmIconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
export const PmIconThumbsUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
);
export const PmIconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
export const PmIconWrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/></svg>
);
export const PmIconLayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);
export const PmIconArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} strokeWidth={2} {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
