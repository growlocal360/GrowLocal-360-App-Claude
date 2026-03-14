export type AssetType = 'brand_asset' | 'site_asset' | 'job_snap_asset';

export const ASSET_BUCKET = 'site-assets';

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Map asset type to its public path prefix.
 */
export function getAssetPrefix(type: AssetType): string {
  switch (type) {
    case 'brand_asset':
      return 'assets/brand';
    case 'site_asset':
      return 'assets/site';
    case 'job_snap_asset':
      return 'job-snaps';
  }
}

/**
 * Map asset type to its storage subfolder within a site's directory.
 */
export function getStorageSubfolder(type: AssetType): string {
  switch (type) {
    case 'brand_asset':
      return 'brand';
    case 'site_asset':
      return 'site';
    case 'job_snap_asset':
      return 'job-snaps';
  }
}

/**
 * Slugify a filename for site assets (lowercase, hyphens, no special chars).
 * Preserves extension.
 */
export function slugifyFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';

  const slugged = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slugged + ext.toLowerCase();
}
