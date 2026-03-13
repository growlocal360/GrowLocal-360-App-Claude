import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadBusinessContext,
  generateSingleServiceAreaContent,
} from '@/lib/content/generators';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Parse body
  const body = await request.json();
  const { serviceAreaId } = body;

  if (!serviceAreaId) {
    return NextResponse.json({ error: 'serviceAreaId is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load service area
  const { data: area } = await admin
    .from('service_areas')
    .select('id, name, slug, state')
    .eq('id', serviceAreaId)
    .eq('site_id', siteId)
    .single();

  if (!area) {
    return NextResponse.json({ error: 'Service area not found' }, { status: 404 });
  }

  try {
    const ctx = await loadBusinessContext(siteId);
    const content = await generateSingleServiceAreaContent(ctx, {
      name: area.name,
      state: area.state || ctx.state,
    });

    // Save to DB
    await admin
      .from('service_areas')
      .update({
        meta_title: content.meta_title,
        meta_description: content.meta_description,
        h1: content.h1,
        body_copy: content.body_copy,
      })
      .eq('id', area.id);

    // Targeted revalidation
    const base = `/sites/${ctx.siteSlug}`;
    revalidatePath(`${base}/areas/${area.slug}`, 'page');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate service area content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
