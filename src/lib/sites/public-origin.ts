import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The public origin links in GBP posts should open. Order:
 *   1. settings.public_website_url (external-site clients)
 *   2. verified custom domain
 *   3. an active webhook endpoint's origin (external site fed by Job Snaps)
 *   4. {slug}.{app domain}
 */
export async function resolvePublicOrigin(
  supabase: SupabaseClient,
  site: { id: string; slug: string; settings: { public_website_url?: string | null } | null; custom_domain: string | null; custom_domain_verified: boolean | null }
): Promise<string> {
  const explicit = site.settings?.public_website_url;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (site.custom_domain && site.custom_domain_verified) return `https://${site.custom_domain}`;
  const { data: hooks } = await supabase
    .from('webhook_endpoints')
    .select('url')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1);
  const hookUrl = hooks?.[0]?.url;
  if (hookUrl) {
    try { return new URL(hookUrl).origin; } catch { /* fall through */ }
  }
  return `https://${site.slug}.${process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com'}`;
}
