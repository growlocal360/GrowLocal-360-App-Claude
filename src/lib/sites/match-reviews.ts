import type { PublicRenderReview } from './public-render-model';

/**
 * Case-insensitive substring match of keywords against review comments.
 * Returns matched reviews sorted by rating DESC.
 * Skips keywords shorter than 3 chars to avoid false positives.
 */
export function matchReviewsToKeywords(
  reviews: PublicRenderReview[],
  keywords: string[]
): PublicRenderReview[] {
  const lowerKeywords = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length >= 3);

  if (lowerKeywords.length === 0) return [];

  const matched = reviews.filter(review => {
    if (!review.comment) return false;
    const lowerComment = review.comment.toLowerCase();
    return lowerKeywords.some(keyword => lowerComment.includes(keyword));
  });

  return matched.sort((a, b) => b.rating - a.rating);
}

/** Match reviews mentioning a service name */
export function matchReviewsToService(
  reviews: PublicRenderReview[],
  serviceName: string
): PublicRenderReview[] {
  return matchReviewsToKeywords(reviews, [serviceName]);
}

/** Match reviews mentioning a brand name */
export function matchReviewsToBrand(
  reviews: PublicRenderReview[],
  brandName: string
): PublicRenderReview[] {
  return matchReviewsToKeywords(reviews, [brandName]);
}

/** Match reviews mentioning a category name or any of its service names */
export function matchReviewsToCategory(
  reviews: PublicRenderReview[],
  categoryName: string,
  serviceNames: string[]
): PublicRenderReview[] {
  return matchReviewsToKeywords(reviews, [categoryName, ...serviceNames]);
}
