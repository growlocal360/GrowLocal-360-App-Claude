import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveOrg } from '@/lib/auth/resolve-org';

/**
 * GET /api/integrations/sites
 *
 * Returns the list of sites in the active org for the integrations UI's
 * "which site does this key/webhook attach to?" dropdown. When a user has
 * exactly one site, the UI auto-selects it and hides the dropdown.
 */
export async function GET() {
  const supabase = await createClient();
  const ctx = await resolveActiveOrg(supabase);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('sites')
    .select('id, name, slug, settings')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: true });

  // Surface workspace_only as a top-level field so dropdowns can label
  // Job-Snaps-only workspaces vs full GL360 sites distinctly.
  const sites = (data || []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    workspace_only: !!(s.settings as { workspace_only?: boolean } | null)?.workspace_only,
  }));

  return NextResponse.json({ sites });
}
