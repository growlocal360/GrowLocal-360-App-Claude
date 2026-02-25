import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Revalidates all cached pages for a site.
 * Call this after any settings change (branding, business info, services, etc.)
 * so the public site updates immediately instead of waiting for ISR expiry.
 */
export async function revalidateSite(siteId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sites')
    .select('slug')
    .eq('id', siteId)
    .single();

  if (data?.slug) {
    revalidatePath(`/sites/${data.slug}`, 'layout');
  }
}
