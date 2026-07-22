import type { SupabaseClient } from '@supabase/supabase-js';

interface CreateWorkspaceSiteArgs {
  organizationId: string;
  userId: string;
  businessName: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

/**
 * Create a hidden "workspace" site for a Job-Snaps-only customer.
 *
 * A workspace site is a minimal sites row that holds Job Snaps + API keys +
 * webhooks but never renders a public website. It satisfies the existing
 * `job_snaps.site_id NOT NULL` constraint without requiring the customer to
 * go through the full GL360 site-build wizard.
 *
 * If the user later upgrades to GL360, we can flip `settings.workspace_only`
 * off, fill in the wizard data, and trigger content generation — the
 * existing snaps + integrations carry over.
 */
export async function createWorkspaceSite(
  supabase: SupabaseClient,
  args: CreateWorkspaceSiteArgs
): Promise<{ siteId: string; slug: string }> {
  const { organizationId, userId, businessName, industry, city, state, phone } = args;

  // Idempotency: an org needs only one Job Snaps workspace. A repeated Stripe
  // webhook (subscription created + updated, re-checkout, retries) must not mint
  // a second identical workspace. Reuse the existing one if present.
  const { data: existing } = await supabase
    .from('sites')
    .select('id, slug, settings')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(50);
  const existingWorkspace = (existing || []).find(
    (s) => (s.settings as Record<string, unknown> | null)?.workspace_only === true
  );
  if (existingWorkspace) {
    return { siteId: existingWorkspace.id, slug: existingWorkspace.slug };
  }

  // Generate a unique-ish slug. Workspace sites aren't publicly resolvable,
  // but the slug column on sites has a uniqueness constraint per org.
  const baseSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const slug = `${baseSlug}-jobsnaps-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from('sites')
    .insert({
      organization_id: organizationId,
      name: businessName,
      slug,
      website_type: 'single_location',
      status: 'active',
      is_active: true,
      settings: {
        workspace_only: true,        // NOT a public site — Job Snaps container only
        created_by: userId,          // store provenance in settings since sites has no created_by column
        industry: industry || null,
        city: city || null,
        state: state || null,
        phone: phone || null,
      },
    })
    .select('id, slug')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create workspace site: ${error?.message || 'unknown'}`);
  }

  return { siteId: data.id, slug: data.slug };
}
