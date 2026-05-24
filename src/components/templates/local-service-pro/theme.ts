/**
 * Shared visual constants for the local-service-pro template.
 * One source of truth so every page picks up brand color overrides
 * consistently and the fallback never drifts.
 */
export const DEFAULT_BRAND_COLOR = '#00ef99';

export function getBrandColor(brandColor?: string | null): string {
  return brandColor || DEFAULT_BRAND_COLOR;
}
