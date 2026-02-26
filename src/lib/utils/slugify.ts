export interface NormalizeCategorySlugOptions {
  /** Trailing suffixes to consider stripping. Default: ["service", "services"] */
  suffixes?: string[];
  /** If stripping would leave the slug ending with one of these words, keep the suffix. */
  blocklist?: string[];
}

const DEFAULT_SUFFIXES = ['service', 'services'];

const DEFAULT_BLOCKLIST = [
  'tree', 'moving', 'delivery', 'drone', 'dating',
  'cleaning', 'storage', 'transport', 'security', 'taxi', 'towing',
];

// Targeted phrase compactions applied before hyphenation.
// Each entry: [pattern (word-boundary safe), replacement]
const PHRASE_COMPACTIONS: [RegExp, string][] = [
  [/\bwashers?\s+and\s+dryers?\b/g, 'washer dryer'],
];

/**
 * Normalizes a GBP category display name into a clean URL slug.
 *
 * 1. Baseline slugification (lowercase, &→and, apostrophes removed, etc.)
 * 2. Targeted phrase compaction (e.g. "washer and dryer" → "washer dryer")
 * 3. Smart suffix stripping with single-word and blocklist guards
 */
export function normalizeCategorySlug(
  categoryName: string,
  options?: NormalizeCategorySlugOptions,
): string {
  const suffixes = options?.suffixes ?? DEFAULT_SUFFIXES;
  const blocklist = options?.blocklist ?? DEFAULT_BLOCKLIST;

  // Step 1: Baseline slugification
  let text = categoryName
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, ' ');

  // Step 2: Targeted phrase compaction
  for (const [pattern, replacement] of PHRASE_COMPACTIONS) {
    text = text.replace(pattern, replacement);
  }

  // Step 3: Split into words for suffix logic
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return '';

  const lastWord = words[words.length - 1];

  if (words.length > 1 && suffixes.includes(lastWord)) {
    const remaining = words.slice(0, -1);

    if (remaining.length === 1) {
      // Single word remaining — don't strip (e.g. "Drone Service" → "drone-service")
    } else {
      // 2+ words remaining — strip unless final remaining word is blocklisted
      const tailWord = remaining[remaining.length - 1];
      if (!blocklist.includes(tailWord)) {
        return remaining.join('-');
      }
      // Blocklisted tail word — keep suffix (e.g. "House Cleaning Services" → "house-cleaning-services")
    }
  }

  return words.join('-');
}
