import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';
import type { ServiceFAQ } from '@/types/database';

export interface FAQHubItem {
  question: string;
  teaserAnswer: string;
  canonicalUrl: string;
  canonicalPageTitle: string;
  topicGroup: string;
  sourceType: 'service' | 'brand';
}

export interface FAQHubData {
  items: FAQHubItem[];
  topicGroups: string[];
}

/**
 * Truncate an answer to 1-2 sentences for the FAQ hub teaser.
 */
function createTeaser(answer: string): string {
  // Split on sentence-ending punctuation followed by a space
  const sentences = answer.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) {
    // No sentence boundary found — truncate at 150 chars
    return answer.length > 150 ? answer.slice(0, 147).trim() + '...' : answer;
  }
  // Take first 1-2 sentences, staying under ~200 chars
  const first = sentences[0].trim();
  if (sentences.length > 1 && (first + ' ' + sentences[1].trim()).length <= 200) {
    return first + ' ' + sentences[1].trim();
  }
  return first;
}

/**
 * Aggregates FAQs from services and brands for a site's FAQ hub page.
 * Dynamically assembled at render time so it stays in sync with page changes.
 */
export async function getFAQHubData(
  siteId: string,
  locationSlug?: string
): Promise<FAQHubData> {
  const supabase = createAdminClient();

  // Fetch services with their categories in parallel
  const [{ data: services }, { data: categories }, { data: brands }] = await Promise.all([
    supabase
      .from('services')
      .select('name, slug, site_category_id, faqs')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('site_categories')
      .select('id, is_primary, gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false })
      .order('sort_order'),
    supabase
      .from('site_brands')
      .select('name, slug, faqs')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  // Build category lookup: id → { name, slug, isPrimary }
  const catMap = new Map<string, { name: string; slug: string; isPrimary: boolean }>();
  let primaryCatId: string | null = null;
  for (const cat of categories || []) {
    const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
    if (gbp?.display_name) {
      const slug = normalizeCategorySlug(gbp.display_name);
      catMap.set(cat.id, { name: gbp.display_name, slug, isPrimary: cat.is_primary });
      if (cat.is_primary) primaryCatId = cat.id;
    }
  }

  const items: FAQHubItem[] = [];
  const topicGroupSet = new Set<string>();

  // Process service FAQs
  for (const service of services || []) {
    const faqs = service.faqs as ServiceFAQ[] | null;
    if (!faqs || faqs.length === 0) continue;

    // Determine category for this service (fall back to primary for orphans)
    const effectiveCatId = service.site_category_id || primaryCatId;
    const cat = effectiveCatId ? catMap.get(effectiveCatId) : null;
    if (!cat) continue;

    const topicGroup = `${cat.name} Questions`;
    topicGroupSet.add(topicGroup);

    const serviceUrl = paths.servicePage(
      service.slug,
      cat.slug,
      cat.isPrimary,
      locationSlug
    );

    for (const faq of faqs) {
      items.push({
        question: faq.question,
        teaserAnswer: createTeaser(faq.answer),
        canonicalUrl: serviceUrl,
        canonicalPageTitle: service.name,
        topicGroup,
        sourceType: 'service',
      });
    }
  }

  // Process brand FAQs
  for (const brand of brands || []) {
    const faqs = brand.faqs as ServiceFAQ[] | null;
    if (!faqs || faqs.length === 0) continue;

    const topicGroup = 'Brand Questions';
    topicGroupSet.add(topicGroup);

    const brandUrl = paths.brandPage(brand.slug, locationSlug);

    for (const faq of faqs) {
      items.push({
        question: faq.question,
        teaserAnswer: createTeaser(faq.answer),
        canonicalUrl: brandUrl,
        canonicalPageTitle: brand.name,
        topicGroup,
        sourceType: 'brand',
      });
    }
  }

  // Order topic groups: service categories first (in their natural order), brands last
  const topicGroups = Array.from(topicGroupSet).sort((a, b) => {
    if (a === 'Brand Questions') return 1;
    if (b === 'Brand Questions') return -1;
    return 0; // Preserve insertion order for category groups
  });

  return { items, topicGroups };
}
