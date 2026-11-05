import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { buildMainServiceList, type MainServiceEntry } from '@/lib/sites/main-service-list';

/** Load the site's main service list (see ./main-service-list.ts). */
export async function getMainServiceList(siteId: string): Promise<MainServiceEntry[]> {
  const { categories, services } = await getCategoriesWithServices(siteId);
  return buildMainServiceList(categories, services);
}
