/**
 * Shared shapes for GBP automation queue rows. Kept free of server-only
 * imports (sharp, next/og, Supabase admin) so dashboard client components can
 * import them without dragging Node modules into the browser bundle.
 */

export type PostSource = 'service' | 'work' | 'review' | 'tip';

export interface GbpPostContext {
  source: PostSource;
  source_id: string | null;
  source_label: string;
  cta_url: string;
  media_url: string | null;
}

export interface PhotoUploadItem { media_id: string; url: string; role: string | null }

export interface PhotoUploadContext {
  job_snap_id: string;
  snap_title: string;
  /** All of this job's photos going to the gallery together. */
  photos: PhotoUploadItem[];
  /** @deprecated single-photo shape from the first release; kept so old queue rows still render/publish */
  media_id?: string;
  url?: string;
}

/** Photos of a queued action, tolerant of the older one-photo shape. */
export function photosOf(ctx: PhotoUploadContext): PhotoUploadItem[] {
  if (Array.isArray(ctx.photos) && ctx.photos.length) return ctx.photos;
  return ctx.media_id && ctx.url ? [{ media_id: ctx.media_id, url: ctx.url, role: null }] : [];
}
