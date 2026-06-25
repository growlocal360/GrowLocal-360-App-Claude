import { createStaticClient } from '@/lib/supabase/static';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebsiteType } from '@/types/database';
import type { MicrositeConfig, TravelStrategy, PrimaryMarket } from '@/types/wizard';
import type { SiteScope } from '@/lib/onboarding/site-scope';
import { FULL_BUSINESS_SCOPE } from '@/lib/onboarding/site-scope';
import { filterGscByScope, type GscQueryForFilter } from '@/lib/onboarding/gsc-scope-filter';

// Types for wizard data structure
export interface WizardLocation {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  isPrimary: boolean;
  gbpPlaceId?: string;
  gbpLocationId?: string;
  gbpAccountId?: string;
  latitude?: number;
  longitude?: number;
  representativeCity?: string;
  representativeState?: string;
}

export interface WizardCategory {
  gcid: string;
  name: string;
  displayName?: string;
  commonServices?: string[];
  isPrimary?: boolean;
}

export interface WizardService {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryGcid: string;
  categoryName: string;
  isSelected: boolean;
  sortOrder: number;
}

export interface WizardServiceArea {
  id: string;
  name: string;
  state?: string;
  placeId?: string;
  distanceMiles?: number;
  isCustom?: boolean;
}

export interface WizardNeighborhood {
  id: string;
  name: string;
  locationId: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

export interface WizardGSCQueryData {
  query: string;
  pageUrl: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface WizardBrand {
  name: string;
}

export interface WizardSiteData {
  businessName: string;
  coreIndustry: string;
  websiteType: WebsiteType;
  locations: WizardLocation[];
  primaryCategory: WizardCategory | null;
  secondaryCategories: WizardCategory[];
  services: WizardService[];
  serviceAreas: WizardServiceArea[];
  neighborhoods: WizardNeighborhood[];
  brands?: WizardBrand[];
  // Microsite targeting (only when websiteType === 'microsite')
  micrositeConfig?: MicrositeConfig;
  // GSC data (optional — synced during wizard if user has Search Console)
  gscPropertyUrl?: string;
  gscQueries?: WizardGSCQueryData[];
  // v4 SITE_SCOPE — collected in the site-scope wizard step. Drives the
  // GSC scope filter + the Phase 2 onboarding analysis. Null = FULL_BUSINESS.
  siteScope?: SiteScope | null;
  // v5 Primary Market model — collected in the primary-market wizard step.
  travelStrategy?: TravelStrategy | null;
  primaryMarket?: PrimaryMarket | null;
}

export interface CreateSiteResult {
  siteId: string;
  slug: string;
}

/**
 * Creates a site and all related records from wizard data.
 * Used by both direct creation (wizard) and webhook (after payment).
 *
 * @param userId - The ID of the user creating the site
 * @param organizationId - The ID of the organization
 * @param data - The wizard site data
 * @param supabaseClient - Optional Supabase client (uses static client if not provided).
 *                         Pass an admin client when calling from webhooks.
 */
export async function createSiteFromWizardData(
  userId: string,
  organizationId: string,
  data: WizardSiteData,
  supabaseClient?: SupabaseClient
): Promise<CreateSiteResult> {
  const supabase = supabaseClient || createStaticClient();

  const {
    businessName,
    coreIndustry,
    websiteType,
    locations,
    primaryCategory,
    secondaryCategories,
    services,
    serviceAreas,
    neighborhoods,
    brands,
  } = data;

  // Generate a globally unique slug — use microsite slug if available, otherwise business name
  const slugBase = (websiteType === 'microsite' && data.micrositeConfig?.suggestedSlug)
    ? data.micrositeConfig.suggestedSlug
    : businessName;
  let slug = slugBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for existing sites with the same slug (across ALL orgs)
  const { count: existingCount } = await supabase
    .from('sites')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug);

  if (existingCount && existingCount > 0) {
    // Find the next available suffix
    const { data: similarSlugs } = await supabase
      .from('sites')
      .select('slug')
      .like('slug', `${slug}%`);

    const usedSlugs = new Set(similarSlugs?.map(s => s.slug) || []);
    let suffix = 2;
    while (usedSlugs.has(`${slug}-${suffix}`)) {
      suffix++;
    }
    slug = `${slug}-${suffix}`;
  }

  // Calculate total tasks for progress tracking
  const selectedServicesCount = services.filter((s) => s.isSelected).length;
  const allCategoriesCount =
    (primaryCategory ? 1 : 0) + secondaryCategories.length;
  const totalTasks =
    selectedServicesCount + // Service pages
    serviceAreas.length + // Service area pages
    allCategoriesCount + // Category pages
    3; // Core pages (home, about, contact)

  // Resolve the effective site scope. The wizard may have passed an explicit
  // scope; if not, microsite websiteType auto-defaults to MICROSITE scope
  // pointed at the microsite's target city, and everything else defaults to
  // FULL_BUSINESS.
  const effectiveScope: SiteScope = data.siteScope ?? deriveDefaultScope(data);

  // Resolve the v5 Primary Market. Prefer what the wizard collected; otherwise
  // fall back to the primary location's city so the field is always populated
  // (backwards-compat: pre-v5 flows + any caller that skips the step).
  const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
  const fallbackCity = primaryLoc?.representativeCity || primaryLoc?.city || '';
  const fallbackState = primaryLoc?.representativeState || primaryLoc?.state || '';
  const v5Market = (data.primaryMarket?.city || fallbackCity)
    ? {
        travelStrategy: (data.travelStrategy ?? 'regional') as TravelStrategy,
        city: data.primaryMarket?.city || fallbackCity,
        state: data.primaryMarket?.state || fallbackState,
        source: (data.primaryMarket?.source ?? (data.primaryMarket ? 'user_input' : 'gbp_address')) as PrimaryMarket['source'],
      }
    : null;

  // Create the site with building status
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .insert({
      organization_id: organizationId,
      name: businessName,
      slug: slug,
      website_type: websiteType,
      template_id: 'local-service-pro',
      is_active: true,
      status: 'building',
      // v4 SITE_SCOPE — persisted alongside the legacy microsite_target_*
      // fields. Both will populate during transition; future content gen +
      // analysis reads from scope_* exclusively.
      scope_type: effectiveScope.scope_type,
      scope_target_city: effectiveScope.target_city,
      scope_city_variants: effectiveScope.city_variants.length > 0 ? effectiveScope.city_variants : null,
      scope_zip_codes: effectiveScope.zip_codes.length > 0 ? effectiveScope.zip_codes : null,
      scope_excluded_cities: effectiveScope.excluded_cities.length > 0 ? effectiveScope.excluded_cities : null,
      scope_existing_url_pattern: effectiveScope.existing_url_pattern,
      build_progress: {
        total_tasks: totalTasks,
        completed_tasks: 0,
        current_task: 'Creating site structure...',
        started_at: new Date().toISOString(),
      },
      status_updated_at: new Date().toISOString(),
      settings: {
        core_industry: coreIndustry,
        // v5 Primary Market model. Falls back to the primary location's city so
        // even sites created before this step shipped have a sensible value.
        ...(v5Market ? {
          travel_strategy: v5Market.travelStrategy,
          primary_market_city: v5Market.city,
          primary_market_state: v5Market.state,
          primary_market_source: v5Market.source,
        } : {}),
        ...(data.micrositeConfig ? {
          microsite_target_city: data.micrositeConfig.targetCity,
          microsite_target_city_state: data.micrositeConfig.targetCityState,
          microsite_target_service: data.micrositeConfig.targetServiceName,
          microsite_target_category: data.micrositeConfig.targetCategoryName,
          microsite_brand_mode: data.micrositeConfig.brandMode,
          microsite_selected_brand: data.micrositeConfig.selectedBrandName,
        } : {}),
        ...(data.gscPropertyUrl ? {
          gsc_property_url: data.gscPropertyUrl,
          gsc_connected: true,
          gsc_last_synced_at: new Date().toISOString(),
        } : {}),
      },
    })
    .select()
    .single();

  if (siteError) throw siteError;

  // Write GSC query data if provided (synced during wizard)
  if (data.gscQueries && data.gscQueries.length > 0) {
    const gscRecords = data.gscQueries.map((q) => ({
      site_id: site.id,
      query: q.query,
      page_url: q.pageUrl,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
      date_range_start: q.dateRangeStart,
      date_range_end: q.dateRangeEnd,
    }));

    // Insert in batches of 200
    for (let i = 0; i < gscRecords.length; i += 200) {
      const batch = gscRecords.slice(i, i + 200);
      await supabase.from('gsc_queries').insert(batch);
    }
  }

  // Create locations
  for (const location of locations) {
    // For SABs, use representative city for slug and content if provided
    const effectiveCity = location.representativeCity || location.city;
    const locationSlug = effectiveCity
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    await supabase.from('locations').insert({
      site_id: site.id,
      name: location.name,
      slug: locationSlug,
      address_line1: location.address,
      city: effectiveCity,
      state: location.representativeState || location.state,
      zip_code: location.zipCode,
      phone: location.phone,
      is_primary: location.isPrimary,
      gbp_place_id: location.gbpPlaceId,
      gbp_location_id: location.gbpLocationId,
      gbp_account_id: location.gbpAccountId,
      latitude: location.latitude,
      longitude: location.longitude,
      representative_city: location.representativeCity || null,
      representative_state: location.representativeState || null,
    });
  }

  // Create service areas
  for (let i = 0; i < serviceAreas.length; i++) {
    const area = serviceAreas[i];
    const areaSlug = area.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await supabase.from('service_areas').insert({
      site_id: site.id,
      name: area.name,
      slug: areaSlug,
      state: area.state || null,
      place_id: area.placeId || null,
      distance_miles: area.distanceMiles || null,
      is_custom: area.isCustom || false,
      sort_order: i,
    });
  }

  // Create neighborhoods (linked to their parent locations)
  const { data: createdLocations } = await supabase
    .from('locations')
    .select('id, city')
    .eq('site_id', site.id);

  const locationIdMap: Record<string, string> = {};
  createdLocations?.forEach((loc) => {
    locationIdMap[loc.city.toLowerCase()] = loc.id;
  });

  for (let i = 0; i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];
    const neighborhoodSlug = neighborhood.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const wizardLocation = locations.find((loc, idx) =>
      (loc.id || `loc-${idx}`) === neighborhood.locationId
    );

    const dbLocationId = wizardLocation
      ? locationIdMap[wizardLocation.city.toLowerCase()]
      : null;

    if (dbLocationId) {
      await supabase.from('neighborhoods').insert({
        site_id: site.id,
        location_id: dbLocationId,
        name: neighborhood.name,
        slug: neighborhoodSlug,
        place_id: neighborhood.placeId || null,
        latitude: neighborhood.latitude || null,
        longitude: neighborhood.longitude || null,
        sort_order: i,
        is_active: true,
      });
    }
  }

  // Save categories to site_categories table
  const allCategories = [
    ...(primaryCategory ? [{ ...primaryCategory, isPrimary: true }] : []),
    ...secondaryCategories.map((cat) => ({ ...cat, isPrimary: false })),
  ];

  // Build GCID -> site_category_id map during creation (not via re-query)
  const siteCategoryMap: Record<string, string> = {};

  for (let i = 0; i < allCategories.length; i++) {
    const cat = allCategories[i];

    // First, upsert the GBP category
    const { data: gbpCat, error: gbpError } = await supabase
      .from('gbp_categories')
      .upsert(
        {
          gcid: cat.gcid,
          name: cat.name,
          display_name: cat.displayName || cat.name,
          parent_gcid: null,
          service_types: cat.commonServices || [],
        },
        { onConflict: 'gcid' }
      )
      .select('id')
      .single();

    if (gbpError) {
      console.error('Error upserting GBP category:', gbpError);
      continue;
    }

    // Then create the site_category link and capture the id
    const { data: siteCat, error: siteCatError } = await supabase
      .from('site_categories')
      .insert({
        site_id: site.id,
        gbp_category_id: gbpCat.id,
        is_primary: cat.isPrimary,
        sort_order: i,
      })
      .select('id')
      .single();

    if (siteCatError) {
      console.error('Error creating site category:', siteCatError);
    } else if (siteCat) {
      siteCategoryMap[cat.gcid] = siteCat.id;
    }
  }

  // Verify category map by re-querying DB (catches any GCID mismatches)
  if (Object.keys(siteCategoryMap).length < allCategories.length) {
    const { data: verifiedCategories } = await supabase
      .from('site_categories')
      .select('id, is_primary, gbp_category:gbp_categories(gcid)')
      .eq('site_id', site.id);

    if (verifiedCategories) {
      for (const vc of verifiedCategories) {
        const gbp = Array.isArray(vc.gbp_category) ? vc.gbp_category[0] : vc.gbp_category;
        if (gbp?.gcid && !siteCategoryMap[gbp.gcid]) {
          siteCategoryMap[gbp.gcid] = vc.id;
        }
      }
    }
  }

  // Build a name-based fallback map for services whose GCID doesn't match
  const categoryNameMap: Record<string, string> = {};
  for (const cat of allCategories) {
    if (siteCategoryMap[cat.gcid]) {
      categoryNameMap[cat.name.toLowerCase()] = siteCategoryMap[cat.gcid];
      if (cat.displayName) {
        categoryNameMap[cat.displayName.toLowerCase()] = siteCategoryMap[cat.gcid];
      }
    }
  }

  // Find the primary category ID as last-resort fallback
  const primaryCatId = primaryCategory ? siteCategoryMap[primaryCategory.gcid] : null;

  // Save selected services to services table
  const selectedServices = services.filter((s) => s.isSelected);
  for (const service of selectedServices) {
    const siteCategoryId =
      siteCategoryMap[service.categoryGcid] ||
      categoryNameMap[service.categoryName?.toLowerCase()] ||
      primaryCatId ||
      null;

    const { error: serviceError } = await supabase
      .from('services')
      .insert({
        site_id: site.id,
        site_category_id: siteCategoryId,
        name: service.name,
        slug: service.slug,
        description: service.description,
        is_active: true,
        sort_order: service.sortOrder,
      });

    if (serviceError) {
      console.error('Error creating service:', serviceError);
    }
  }

  // Create brands
  if (brands && brands.length > 0) {
    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const brandSlug = brand.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { error: brandError } = await supabase
        .from('site_brands')
        .insert({
          site_id: site.id,
          name: brand.name,
          slug: brandSlug,
          sort_order: i,
          is_active: true,
        });

      if (brandError) {
        console.error('Error creating brand:', brandError);
      }
    }
  }

  // ── Phase 1 onboarding analysis row ─────────────────────────────────────
  // Record the SITE_SCOPE that was used + the result of running the GSC
  // scope filter against the wizard's GSC queries. Phase 2 will populate
  // gbp_audit_findings + scenario_classification + sitemap_spec via the
  // Claude orchestrator on a separate row (or this same row, depending on
  // where Phase 2 hooks in).
  try {
    const queriesForFilter: GscQueryForFilter[] = (data.gscQueries || []).map((q) => ({
      query: q.query,
      page_url: q.pageUrl,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    }));
    const { filtering_report, scoped_queries } = filterGscByScope(queriesForFilter, effectiveScope);
    // Compact form of scoped_queries — drop redundant data (full rows live
    // in gsc_queries). Just keep query + impressions for replay/auditing.
    const scopedDataCompact = scoped_queries.map((q) => ({
      q: q.query,
      i: q.impressions,
      c: q.clicks,
      p: q.position,
    }));
    await supabase.from('onboarding_analyses').insert({
      site_id: site.id,
      scope_snapshot: effectiveScope,
      filtering_report,
      scoped_gsc_data: { queries: scopedDataCompact },
    });
  } catch (err) {
    // Non-fatal — site is created; analysis row is auditability nice-to-have.
    console.error('onboarding_analyses insert failed:', err);
  }

  return {
    siteId: site.id,
    slug: site.slug,
  };
}

/**
 * Resolve the default SiteScope when the wizard didn't collect one
 * explicitly. Microsite websiteType → MICROSITE scope pointed at the
 * microsite target city; everything else → FULL_BUSINESS.
 */
function deriveDefaultScope(data: WizardSiteData): SiteScope {
  if (data.websiteType === 'microsite' && data.micrositeConfig) {
    return {
      scope_type: 'MICROSITE',
      target_city: data.micrositeConfig.targetCity,
      city_variants: data.micrositeConfig.targetCity ? [data.micrositeConfig.targetCity] : [],
      zip_codes: [],
      excluded_cities: [],
      existing_url_pattern: null,
    };
  }
  return FULL_BUSINESS_SCOPE;
}

/**
 * Ensures user has an organization, creating one if needed.
 * Returns the organization ID.
 *
 * @param userId - The ID of the user
 * @param email - The user's email (optional)
 * @param fullName - The user's full name (optional)
 * @param supabaseClient - Optional Supabase client (uses static client if not provided).
 *                         Pass an admin client when calling from webhooks.
 */
export async function ensureUserOrganization(
  userId: string,
  email: string | undefined,
  fullName: string | undefined,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const supabase = supabaseClient || createStaticClient();

  // Check if user already has a profile with organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', userId)
    .single();

  if (profile?.organization_id) {
    return profile.organization_id;
  }

  // Create new organization
  const orgId = crypto.randomUUID();
  const orgSlug = (fullName || email?.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 8);

  const { error: orgError } = await supabase
    .from('organizations')
    .insert({
      id: orgId,
      name: fullName || email?.split('@')[0] || 'My Organization',
      slug: orgSlug,
    });

  if (orgError) {
    throw new Error(`Failed to create organization: ${orgError.message}`);
  }

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      organization_id: orgId,
      role: 'admin',
      full_name: fullName,
    });

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  return orgId;
}
