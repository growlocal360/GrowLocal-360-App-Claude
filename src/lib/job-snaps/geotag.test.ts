import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { geotagJpeg, readGeotag, carryGeotag, buildExif, isJpeg } from './geotag';
import piexif from 'piexifjs';

const jpeg = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#4a6' } }).jpeg().toBuffer();

describe('geotag', () => {
  it('writes GPS, title, business and date into a JPEG and reads them back', async () => {
    const src = await jpeg();
    expect(await readGeotag(src)).toBeNull();
    const out = geotagJpeg(src, { lat: 30.2266, lng: -93.2174, title: 'Fleet wrap — Ford Transit', businessName: 'Graphic Works', city: 'Lake Charles', takenAt: new Date('2026-11-03T14:05:00Z') });
    const tags = await readGeotag(out);
    expect(tags?.lat).toBeCloseTo(30.2266, 3);
    expect(tags?.lng).toBeCloseTo(-93.2174, 3);
    expect(tags?.title).toBe('Fleet wrap - Ford Transit - Lake Charles');
    expect(tags?.businessName).toBe('Graphic Works');
    expect(tags?.takenAt?.toISOString().slice(0, 10)).toBe('2026-11-03');
    // Pixels untouched: the image still decodes to the same size.
    const m = await sharp(out).metadata();
    expect([m.width, m.height]).toEqual([64, 48]);
  });

  it('uses southern and western hemisphere refs', () => {
    const d = buildExif({ lat: -33.86, lng: 151.2 });
    expect(d.GPS?.[piexif.GPSIFD.GPSLatitudeRef]).toBe('S');
    expect(d.GPS?.[piexif.GPSIFD.GPSLongitudeRef]).toBe('E');
  });

  it('leaves non-JPEG buffers alone', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).png().toBuffer();
    expect(isJpeg(png)).toBe(false);
    expect(geotagJpeg(png, { lat: 1, lng: 2 })).toBe(png);
  });

  it('carries tags from a source onto a re-encoded copy', async () => {
    const src = geotagJpeg(await jpeg(), { lat: 27.3027, lng: -82.5225, title: 'Dryer repair', businessName: 'Fix It or Free' });
    const derived = await sharp(src).resize(32).jpeg().toBuffer(); // sharp drops EXIF
    expect(await readGeotag(derived)).toBeNull();
    const carried = await carryGeotag(src, derived, { title: 'Dryer repair - Sarasota' });
    const tags = await readGeotag(carried);
    expect(tags?.lat).toBeCloseTo(27.3027, 3);
    expect(tags?.title).toBe('Dryer repair - Sarasota');
    expect(tags?.businessName).toBe('Fix It or Free');
  });
});
