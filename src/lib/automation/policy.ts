import type { AutomationMode } from '@/types/database';

/** Reviews older than this never get an automated draft (first sync on an old profile). */
export const REVIEW_REPLY_MAX_AGE_DAYS = 60;
/** Cap drafts per site per sync so a backlog doesn't burn tokens or flood the queue. */
export const REVIEW_REPLY_MAX_PER_SYNC = 10;
/** Autopilot publishes replies at or above this rating; lower ones always wait for a human. */
export const AUTOPILOT_MIN_RATING = 4;
/** Ratings at or below this trigger an owner alert. */
export const NEGATIVE_RATING_MAX = 2;

export function isRecentEnough(reviewDate: string | null | undefined, now = new Date()): boolean {
  if (!reviewDate) return false;
  const t = new Date(reviewDate).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= REVIEW_REPLY_MAX_AGE_DAYS * 86400000;
}

/** Whether a drafted reply may go out without a human looking at it. */
export function shouldAutoPublishReply(mode: AutomationMode, rating: number): boolean {
  return mode === 'autopilot' && rating >= AUTOPILOT_MIN_RATING;
}

export function isNegativeReview(rating: number): boolean {
  return rating <= NEGATIVE_RATING_MAX;
}

/** Hard limits on what we will send to Google as a reply. */
export function sanitizeReply(text: string): string {
  const cleaned = text
    .replace(/^["\u201c\u201d']+|["\u201c\u201d']+$/g, '')
    .replace(/\s*\u2014\s*/g, '. ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // GBP caps replies at 4096 chars; we want them far shorter than that.
  return cleaned.length > 1000 ? cleaned.slice(0, 997).trimEnd() + '...' : cleaned;
}
