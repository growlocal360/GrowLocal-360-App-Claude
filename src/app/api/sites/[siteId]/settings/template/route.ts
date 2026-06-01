import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import { TEMPLATE_CATALOG } from '@/lib/templates/catalog';
import type { TemplateId } from '@/types/database';

const VALID_TEMPLATE_IDS = TEMPLATE_CATALOG.map((t) => t.id);

// GET — current template_id for the site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: site, error } = await supabase
    .from('sites')
    .select('id, template_id')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  return NextResponse.json({ templateId: site.template_id || 'local-service-pro' });
}

// PATCH — change the site's template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const templateId = body.templateId as TemplateId;

  if (!templateId || !VALID_TEMPLATE_IDS.includes(templateId)) {
    return NextResponse.json(
      { error: `Invalid template. Must be one of: ${VALID_TEMPLATE_IDS.join(', ')}` },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('sites')
    .update({ template_id: templateId, updated_at: new Date().toISOString() })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update template:', updateError);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  // Bust cached pages so the new template renders immediately.
  await revalidateSite(siteId);

  return NextResponse.json({ templateId });
}
