/**
 * Shared renderer for v5 "category in a city" pages.
 * ----------------------------------------------------------------------------
 * Used by BOTH:
 *   - Pattern 1 / city-hub-service routes ("/{category}/{city}/", "/{city}/{category}/")
 *   - the city hub / Primary Market hub ("/{city}/") — rendered as the PRIMARY
 *     category localized to that city, so the Primary Market page actually OWNS
 *     the "{category} in {city}" geo keyword (instead of a thin Location page).
 *
 * The H1 is constructed by the Category template from the (overridden) city, so
 * it's correct on both axes. The body borrows the city's OWN generated copy
 * (service_areas row) to avoid the primary market's content leaking onto other
 * cities. For the Primary Market hub specifically, callers may allow a fallback
 * to the primary category page content when the city has no area copy.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v5.md
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getAllGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { matchReviewsToCategory } from '@/lib/sites/match-reviews';
import { getCategoryBySlugSingleLocation } from '@/lib/sites/get-services';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getTemplate } from '@/lib/templates/registry';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';
import {
  toPublicSite, toPublicLocation, toPublicCategory, toPublicServiceListing,
  toPublicReview, toPublicAreaListing, toPublicNeighborhoodListing,
  toPublicPageContent, toPublicWorkItem,
} from '@/lib/sites/public-render-model';

export async function renderCategoryInCity(params: {
  siteSlug: string;
  categorySlug: string;
  /** slug of the city (used to look up the city's own generated copy). */
  citySeg: string;
  city: { name: string; state: string | null };
  /** Anti-doorway per-(category×city) intro (short, page-specific). Shown as the
   *  hero sub-copy; takes precedence over the generic area body for the lede. */
  introText?: string | null;
  /** PM hub only: if the city has no area copy, fall back to the primary category
   *  page content (which is localized to the primary market). */
  allowPrimaryContentFallback?: boolean;
}) {
  const { siteSlug, categorySlug, citySeg, city } = params;
  const base = await getSiteBySlug(siteSlug);
  if (!base) return null;
  const siteId = base.site.id;

  const categoryData = await getCategoryBySlugSingleLocation(siteSlug, categorySlug);
  if (!categoryData) return null;

  const admin = createAdminClient();
  const categoryServiceIds = categoryData.services.map((s) => s.id);
  const [allReviews, { data: serviceAreas }, { data: neighborhoods }, { data: schedulingConfig }, hasBrands, { data: cityArea }, ...workItemResults] = await Promise.all([
    getAllGoogleReviewsForSite(siteId),
    admin.from('service_areas').select('*').eq('site_id', siteId).order('sort_order'),
    admin.from('neighborhoods').select('*').eq('site_id', siteId).eq('is_active', true).order('sort_order'),
    admin.from('scheduling_configs').select('is_active, cta_style').eq('site_id', siteId).single(),
    siteHasActiveBrands(siteId),
    admin.from('service_areas').select('h1, body_copy').eq('site_id', siteId).eq('slug', citySeg).maybeSingle(),
    ...categoryServiceIds.map((sid) => getPublishedWorkItems(siteId, { serviceId: sid, limit: 6 })),
  ]);

  const seenIds = new Set<string>();
  const categoryWorkItems = workItemResults.flat().filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  }).slice(0, 6);

  const categoryName = categoryData.category.gbp_category.display_name;
  const serviceNames = categoryData.services.map((s) => s.name);
  const publicReviews = allReviews.map(toPublicReview);
  const matched = matchReviewsToCategory(publicReviews, `${categoryName} ${city.name}`, serviceNames);
  const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

  // City context: override the location's city so the H1 reads "{category} in {city}".
  const cityLocation = {
    ...toPublicLocation(categoryData.location),
    city: city.name,
    state: city.state || categoryData.location.state,
  };

  // Page content: a per-(category×city) intro (anti-doorway, page-specific) as the
  // hero lede, plus the city's OWN generated body. H1 is left null so the template
  // builds the correct "{category} in {city}" heading. For the PM hub with no area
  // copy, fall back to the (correctly-localized) primary category page content.
  const introMap = ((base.site.settings as { city_page_intros?: Record<string, string> } | null)?.city_page_intros) || {};
  const introKey = `${categorySlug}/${citySeg}`.toLowerCase();
  const cityIntro = params.introText || introMap[introKey] || null;
  const cityBody = cityArea?.body_copy || null;
  let pageContent: ReturnType<typeof toPublicPageContent> | null = null;
  if (cityIntro || cityBody) {
    pageContent = {
      h1: null, h2: null, hero_description: cityIntro,
      body_copy: cityBody, body_copy_2: null,
      faqs: null, sections: null, generated_images: null,
    };
  } else if (params.allowPrimaryContentFallback && categoryData.pageContent) {
    pageContent = { ...toPublicPageContent(categoryData.pageContent), h1: null };
  }

  const CatComp = getTemplate(base.site.template_id).Category;
  return (
    <CatComp
      data={{
        site: toPublicSite(base.site, { hasBrands }),
        location: cityLocation,
        category: toPublicCategory(categoryData.category),
        services: categoryData.services.map(toPublicServiceListing),
        allCategories: categoryData.allCategories.map(toPublicCategory),
        pageContent,
      }}
      siteSlug={siteSlug}
      googleReviews={displayReviews}
      serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
      neighborhoods={(neighborhoods || []).map(toPublicNeighborhoodListing)}
      recentWorkItems={categoryWorkItems.map(toPublicWorkItem)}
      formCategories={categoryData.allCategories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
