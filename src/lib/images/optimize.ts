import sharp from 'sharp';

/**
 * One image pipeline for everything a site serves.
 *
 * Every upload and every generated image goes through here before it reaches
 * storage: resized to what its slot needs, encoded as WebP, EXIF stripped
 * (a 12-megapixel iPhone original has no business behind a 400px box, and a
 * person photo should not ship GPS coordinates). SVGs pass through untouched.
 *
 * Job Snap photos keep their own path: they are resized in the browser and
 * carry a geotag we write on purpose.
 */

export type ImagePreset = 'hero' | 'content' | 'person' | 'avatar' | 'logo' | 'thumbnail';

interface PresetSpec {
  /** Longest edge the slot can use at 2x on a large display. */
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

const PRESETS: Record<ImagePreset, PresetSpec> = {
  hero: { maxWidth: 1920, maxHeight: 1920, quality: 78 },
  content: { maxWidth: 1600, maxHeight: 1600, quality: 78 },
  person: { maxWidth: 1000, maxHeight: 1400, quality: 80 },
  avatar: { maxWidth: 512, maxHeight: 512, quality: 82 },
  logo: { maxWidth: 1000, maxHeight: 500, quality: 86 },
  thumbnail: { maxWidth: 800, maxHeight: 800, quality: 75 },
};

export interface OptimizedImage {
  buffer: Buffer;
  contentType: 'image/webp' | 'image/png' | 'image/jpeg' | 'image/svg+xml';
  ext: 'webp' | 'png' | 'jpg' | 'svg';
  width: number | null;
  height: number | null;
  bytesIn: number;
  bytesOut: number;
}

function isSvg(contentType: string | undefined, input: Buffer): boolean {
  if (contentType === 'image/svg+xml') return true;
  const head = input.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

/**
 * Resize + re-encode one image for a slot. Pass the declared content type
 * when you have it so SVGs are recognised without sniffing.
 */
export async function optimizeImage(
  input: Buffer,
  opts: { preset: ImagePreset; contentType?: string }
): Promise<OptimizedImage> {
  if (isSvg(opts.contentType, input)) {
    return { buffer: input, contentType: 'image/svg+xml', ext: 'svg', width: null, height: null, bytesIn: input.length, bytesOut: input.length };
  }

  const spec = PRESETS[opts.preset];
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  // .rotate() bakes the EXIF orientation into the pixels first; the metadata
  // itself is dropped because we never call .withMetadata().
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: spec.maxWidth, height: spec.maxHeight, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: spec.quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  // A small PNG/JPEG/WebP that already fits the slot can come out LARGER as
  // WebP (tiny logos, flat icons). Then the original bytes are the better file.
  const alreadyFits = (meta.width ?? 0) <= spec.maxWidth && (meta.height ?? 0) <= spec.maxHeight;
  const keep = { png: ['image/png', 'png'], jpeg: ['image/jpeg', 'jpg'], webp: ['image/webp', 'webp'] } as const;
  const fmt = meta.format as keyof typeof keep | undefined;
  if (alreadyFits && fmt && keep[fmt] && data.length >= input.length) {
    return {
      buffer: input,
      contentType: keep[fmt][0],
      ext: keep[fmt][1],
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytesIn: input.length,
      bytesOut: input.length,
    };
  }

  return {
    buffer: data,
    contentType: 'image/webp',
    ext: 'webp',
    width: info.width,
    height: info.height,
    bytesIn: input.length,
    bytesOut: data.length,
  };
}

/**
 * Build a descriptive, URL-safe file stem from the facts we know about an
 * image: ["Anthony Minor", "Plumber", "Anthony's Plumbing"] →
 * "anthony-minor-plumber-anthonys-plumbing". Empty parts are skipped.
 */
export function imageSlug(parts: Array<string | null | undefined>, maxLength = 90): string {
  const stem = parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) =>
      p
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    // "John David Eakin" + org "John David Eakin" must not double up
    .filter((part, i, all) => all.indexOf(part) === i)
    .join('-')
    .replace(/-{2,}/g, '-');
  const trimmed = stem.slice(0, maxLength).replace(/-+$/g, '');
  return trimmed || 'image';
}
