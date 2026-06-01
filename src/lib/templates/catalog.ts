import type { TemplateId } from '@/types/database';

/**
 * Template catalog — metadata for the template pickers (wizard + dashboard settings).
 * Adding a new template = add an entry here + a registry entry in registry.tsx.
 * This is the single source of truth for what templates exist and how they're
 * presented to users.
 */
export interface TemplateCatalogEntry {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  /** Public path to a preview thumbnail (16:10ish). Optional until a real image exists. */
  thumbnail?: string;
  /** Short bullet highlights shown in the picker card. */
  highlights: string[];
  /** Mark as the default for new sites. Exactly one should be true. */
  isDefault?: boolean;
}

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: 'local-service-pro',
    name: 'Local Service Pro',
    tagline: 'Clean, proven, conversion-focused',
    description:
      'Our original template — a clean, trustworthy layout proven to convert for local service businesses.',
    thumbnail: '/templates/local-service-pro.png',
    highlights: ['Proven layout', 'Fast & lightweight', 'Great for any trade'],
    isDefault: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Bold, modern, established',
    description:
      'A confident, contemporary design with editorial typography and refined detailing. Makes any business look established and high-end.',
    thumbnail: '/templates/premium.png',
    highlights: [
      'Bold modern typography',
      'Premium editorial layout',
      'Adapts to your brand color',
    ],
  },
];

export const DEFAULT_TEMPLATE_ID: TemplateId =
  TEMPLATE_CATALOG.find((t) => t.isDefault)?.id ?? 'local-service-pro';

export function getTemplateCatalogEntry(id: TemplateId): TemplateCatalogEntry {
  return TEMPLATE_CATALOG.find((t) => t.id === id) ?? TEMPLATE_CATALOG[0];
}
