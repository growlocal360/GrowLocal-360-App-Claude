import { createStaticClient } from '@/lib/supabase/static';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebsiteType } from '@/types/database';

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
  } = data;

  // Generate slug from business name
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Calculate total tasks for progress tracking
  const selectedServicesCount = services.filter((s) => s.isSelected).length;
  const allCategoriesCount =
    (primaryCategory ? 1 : 0) + secondaryCategories.length;
  const totalTasks =
    selectedServicesCount + // Service pages
    serviceAreas.length + // Service area pages
    allCategoriesCount + // Category pages
    3; // Core pages (home, about, contact)

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
      build_progress: {
        total_tasks: totalTasks,
        completed_tasks: 0,
        current_task: 'Creating site structure...',
        started_at: new Date().toISOString(),
      },
      status_updated_at: new Date().toISOString(),
      settings: {
        core_industry: coreIndustry,
      },
    })
    .select()
    .single();

  if (siteError) throw siteError;

  // Create locations
  for (const location of locations) {
    const locationSlug = location.city
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    await supabase.from('locations').insert({
      site_id: site.id,
      name: location.name,
      slug: locationSlug,
      address_line1: location.address,
      city: location.city,
      state: location.state,
      zip_code: location.zipCode,
      phone: location.phone,
      is_primary: location.isPrimary,
      gbp_place_id: location.gbpPlaceId,
      gbp_location_id: location.gbpLocationId,
      gbp_account_id: location.gbpAccountId,
      latitude: location.latitude,
      longitude: location.longitude,
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

  // Save selected services to services table
  const selectedServices = services.filter((s) => s.isSelected);
  for (const service of selectedServices) {
    const siteCategoryId = siteCategoryMap[service.categoryGcid] || null;

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

  return {
    siteId: site.id,
    slug: site.slug,
  };
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
