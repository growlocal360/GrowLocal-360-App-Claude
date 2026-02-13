import { createAdminClient } from '@/lib/supabase/admin';
import type {
  SiteWithRelations,
  Location,
  WorkItem,
  WorkItemWithRelations,
} from '@/types/database';

export interface WorkItemPageData {
  site: SiteWithRelations;
  primaryLocation: Location;
  workItem: WorkItem;
  service?: { id: string; name: string; slug: string } | null;
  itemLocation?: { id: string; city: string; state: string; slug: string } | null;
}

/**
 * Get published work items for a site, ordered by performed_at DESC.
 */
export async function getPublishedWorkItems(
  siteId: string,
  options?: { limit?: number }
): Promise<WorkItemWithRelations[]> {
  const supabase = createAdminClient();
  const limit = options?.limit ?? 12;

  const { data: items } = await supabase
    .from('work_items')
    .select('*')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .order('performed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!items || items.length === 0) return [];

  // Collect unique service_ids and location_ids to batch-fetch
  const serviceIds = [...new Set(items.map(i => i.service_id).filter(Boolean))] as string[];
  const locationIds = [...new Set(items.map(i => i.location_id).filter(Boolean))] as string[];

  const [{ data: services }, { data: locations }] = await Promise.all([
    serviceIds.length > 0
      ? supabase.from('services').select('id, name, slug').in('id', serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    locationIds.length > 0
      ? supabase.from('locations').select('id, city, state, slug').in('id', locationIds)
      : Promise.resolve({ data: [] as { id: string; city: string; state: string; slug: string }[] }),
  ]);

  const serviceMap = new Map((services || []).map(s => [s.id, s]));
  const locationMap = new Map((locations || []).map(l => [l.id, l]));

  return items.map(item => ({
    ...item,
    service: item.service_id ? serviceMap.get(item.service_id) || null : null,
    location: item.location_id ? locationMap.get(item.location_id) || null : null,
  })) as WorkItemWithRelations[];
}

/**
 * Get a single published work item by its slug, along with site + location data.
 */
export async function getWorkItemBySlug(
  siteSlug: string,
  workSlug: string
): Promise<WorkItemPageData | null> {
  const supabase = createAdminClient();

  // Fetch site
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .single();

  if (!site) return null;

  // Fetch the work item
  const { data: workItem } = await supabase
    .from('work_items')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', workSlug)
    .eq('status', 'published')
    .single();

  if (!workItem) return null;

  // Fetch primary location
  const { data: primaryLocation } = await supabase
    .from('locations')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_primary', true)
    .single();

  if (!primaryLocation) return null;

  // Fetch related service and location if referenced
  const [serviceResult, locationResult] = await Promise.all([
    workItem.service_id
      ? supabase.from('services').select('id, name, slug').eq('id', workItem.service_id).single()
      : Promise.resolve({ data: null }),
    workItem.location_id
      ? supabase.from('locations').select('id, city, state, slug').eq('id', workItem.location_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    site: site as SiteWithRelations,
    primaryLocation: primaryLocation as Location,
    workItem: workItem as WorkItem,
    service: serviceResult.data as WorkItemPageData['service'],
    itemLocation: locationResult.data as WorkItemPageData['itemLocation'],
  };
}

/**
 * Get related published work items (same service first, then backfill).
 */
export async function getRelatedWorkItems(options: {
  siteId: string;
  serviceId?: string | null;
  locationId?: string | null;
  excludeId: string;
  limit?: number;
}): Promise<WorkItemWithRelations[]> {
  const { siteId, serviceId, excludeId, limit = 3 } = options;
  const supabase = createAdminClient();

  let results: WorkItem[] = [];

  // First: same-service items
  if (serviceId) {
    const { data: sameService } = await supabase
      .from('work_items')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .eq('service_id', serviceId)
      .neq('id', excludeId)
      .order('performed_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    results = sameService || [];
  }

  // Backfill if needed
  if (results.length < limit) {
    const excludeIds = [excludeId, ...results.map(r => r.id)];
    const { data: backfill } = await supabase
      .from('work_items')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .order('performed_at', { ascending: false, nullsFirst: false })
      .limit(limit - results.length);

    results = [...results, ...(backfill || [])];
  }

  if (results.length === 0) return [];

  // Batch-fetch services and locations
  const serviceIds = [...new Set(results.map(i => i.service_id).filter(Boolean))] as string[];
  const locationIds = [...new Set(results.map(i => i.location_id).filter(Boolean))] as string[];

  const [{ data: services }, { data: locations }] = await Promise.all([
    serviceIds.length > 0
      ? supabase.from('services').select('id, name, slug').in('id', serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    locationIds.length > 0
      ? supabase.from('locations').select('id, city, state, slug').in('id', locationIds)
      : Promise.resolve({ data: [] as { id: string; city: string; state: string; slug: string }[] }),
  ]);

  const serviceMap = new Map((services || []).map(s => [s.id, s]));
  const locationMap = new Map((locations || []).map(l => [l.id, l]));

  return results.map(item => ({
    ...item,
    service: item.service_id ? serviceMap.get(item.service_id) || null : null,
    location: item.location_id ? locationMap.get(item.location_id) || null : null,
  })) as WorkItemWithRelations[];
}

/**
 * Get all published work item slugs for generateStaticParams.
 */
export async function getAllPublishedWorkSlugs(): Promise<{
  siteSlug: string;
  workSlug: string;
}[]> {
  const supabase = createAdminClient();

  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug')
    .eq('is_active', true);

  if (!sites) return [];

  const slugs: { siteSlug: string; workSlug: string }[] = [];

  for (const site of sites) {
    const { data: workItems } = await supabase
      .from('work_items')
      .select('slug')
      .eq('site_id', site.id)
      .eq('status', 'published');

    if (!workItems) continue;

    for (const item of workItems) {
      slugs.push({
        siteSlug: site.slug,
        workSlug: item.slug,
      });
    }
  }

  return slugs;
}
