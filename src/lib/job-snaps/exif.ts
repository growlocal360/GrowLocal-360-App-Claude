/**
 * EXIF GPS extraction for job snap images.
 * Uses exifr to parse GPS coordinates from image files.
 */

import exifr from 'exifr';

export interface ExifGpsResult {
  lat: number;
  lng: number;
}

/**
 * Attempts to extract GPS coordinates from an image file's EXIF data.
 * Returns null if no GPS data is found or parsing fails.
 */
export async function extractExifGps(file: File): Promise<ExifGpsResult | null> {
  try {
    // Only JPEG files reliably contain EXIF data
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return null;
    }

    const gps = await exifr.gps(file);
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') {
      return null;
    }

    // Sanity check: valid coordinate ranges
    if (
      gps.latitude < -90 || gps.latitude > 90 ||
      gps.longitude < -180 || gps.longitude > 180
    ) {
      return null;
    }

    return { lat: gps.latitude, lng: gps.longitude };
  } catch {
    // EXIF parsing failure is non-fatal
    return null;
  }
}

/**
 * Extracts GPS from multiple files, returning results keyed by index.
 */
export async function extractExifGpsBatch(
  files: File[]
): Promise<Map<number, ExifGpsResult>> {
  const results = new Map<number, ExifGpsResult>();

  await Promise.all(
    files.map(async (file, index) => {
      const gps = await extractExifGps(file);
      if (gps) {
        results.set(index, gps);
      }
    })
  );

  return results;
}
