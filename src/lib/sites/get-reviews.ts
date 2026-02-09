import { createStaticClient } from '@/lib/supabase/static';
import type { GoogleReview } from '@/types/database';

export async function getGoogleReviewsForSite(siteId: string): Promise<GoogleReview[]> {
  const supabase = createStaticClient();

  const { data: reviews } = await supabase
    .from('google_reviews')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_visible', true)
    .order('rating', { ascending: false })
    .order('review_date', { ascending: false })
    .limit(10);

  return (reviews || []) as GoogleReview[];
}
