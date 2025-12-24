import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Client for static generation (build time)
// Uses anon key which has public read access via RLS policies
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
