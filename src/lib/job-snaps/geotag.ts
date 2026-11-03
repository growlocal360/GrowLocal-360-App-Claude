import piexif from 'piexifjs';
import exifr from 'exifr';

/**
 * Geotagging for Job Snap photos.
 *
 * The browser re-encodes every photo before upload (to keep requests small),
 * which drops the camera's EXIF. We know the job's coordinates anyway, so the
 * stored JPEG gets them written back: GPS position, the job title as the image
 * description, the business as artist/copyright, and the capture date. piexif
 * inserts the APP1 segment without touching the pixels, so there is no second
 * generation of JPEG loss. Branded and Instagram variants (which sharp does
 * re-encode) copy the tags across with `carryGeotag`.
 */

export interface GeotagMeta {
  lat: number;
  lng: number;
  title?: string | null;
  businessName?: string | null;
  city?: string | null;
  takenAt?: Date | null;
}

const ascii = (s: string | null | undefined, max = 200): string | null => {
  if (!s) return null;
  const clean = s
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, max) : null;
};

const exifDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}:${p(d.getUTCMonth() + 1)}:${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

export function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/** The EXIF dictionary for a job photo. Exported for tests. */
export function buildExif(meta: GeotagMeta): piexif.ExifDict {
  const when = meta.takenAt || new Date();
  const zeroth: Record<number, unknown> = {
    [piexif.ImageIFD.Software]: 'GrowLocal 360',
    [piexif.ImageIFD.DateTime]: exifDate(when),
  };
  const description = ascii(meta.title && meta.city ? `${meta.title} - ${meta.city}` : meta.title || meta.city);
  if (description) zeroth[piexif.ImageIFD.ImageDescription] = description;
  const business = ascii(meta.businessName, 120);
  if (business) {
    zeroth[piexif.ImageIFD.Artist] = business;
    zeroth[piexif.ImageIFD.Copyright] = `${when.getUTCFullYear()} ${business}`;
  }
  const exifIfd: Record<number, unknown> = {
    [piexif.ExifIFD.DateTimeOriginal]: exifDate(when),
    [piexif.ExifIFD.DateTimeDigitized]: exifDate(when),
  };
  const gps: Record<number, unknown> = {
    [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
    [piexif.GPSIFD.GPSLatitudeRef]: meta.lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(meta.lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: meta.lng >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(meta.lng)),
    [piexif.GPSIFD.GPSMapDatum]: 'WGS-84',
    [piexif.GPSIFD.GPSDateStamp]: exifDate(when).slice(0, 10),
  };
  return { '0th': zeroth, Exif: exifIfd, GPS: gps, Interop: {}, '1st': {} } as piexif.ExifDict;
}

/** Write the tags into a JPEG without re-encoding it. Non-JPEG input is returned unchanged. */
export function geotagJpeg(buffer: Buffer, meta: GeotagMeta): Buffer {
  if (!isJpeg(buffer)) return buffer;
  if (!Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return buffer;
  const exifBytes = piexif.dump(buildExif(meta));
  // piexif works on "binary strings" (one char per byte).
  const out = piexif.insert(exifBytes, buffer.toString('binary'));
  return Buffer.from(out, 'binary') as Buffer<ArrayBuffer>;
}

export interface ReadGeotag { lat: number; lng: number; title: string | null; businessName: string | null; takenAt: Date | null }

/** GPS and descriptive tags already in a JPEG, or null when it carries no position. */
export async function readGeotag(buffer: Buffer): Promise<ReadGeotag | null> {
  if (!isJpeg(buffer)) return null;
  try {
    const gps = await exifr.gps(buffer);
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return null;
    const tags = (await exifr.parse(buffer, { pick: ['ImageDescription', 'Artist', 'DateTimeOriginal'] })) as { ImageDescription?: string; Artist?: string; DateTimeOriginal?: Date } | undefined;
    return {
      lat: gps.latitude,
      lng: gps.longitude,
      title: tags?.ImageDescription || null,
      businessName: tags?.Artist || null,
      takenAt: tags?.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : null,
    };
  } catch {
    return null;
  }
}

/**
 * Re-apply the source photo's tags to a derived JPEG (branded overlay,
 * Instagram crop). sharp drops EXIF when it re-encodes, so without this the
 * copies sent to Google and social would be untagged again.
 */
export async function carryGeotag(source: Buffer, output: Buffer, overrides: Partial<GeotagMeta> = {}): Promise<Buffer> {
  const found = await readGeotag(source);
  if (!found) return output;
  return geotagJpeg(output, {
    lat: found.lat,
    lng: found.lng,
    title: overrides.title ?? found.title,
    businessName: overrides.businessName ?? found.businessName,
    city: overrides.city ?? null,
    takenAt: overrides.takenAt ?? found.takenAt,
  });
}
