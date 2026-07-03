import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * POST /api/sites/[siteId]/leads
 * Public endpoint — submits a lead from a site form.
 * On success, fires `lead/created` to trigger email + (optional) SMS to the site owner.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    const body = await request.json();
    const { name, email, phone, service_type, message, address, source_page, metadata } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify site exists and is active
    const { data: site } = await supabase
      .from('sites')
      .select('id, name, is_active')
      .eq('id', siteId)
      .eq('is_active', true)
      .single();

    if (!site) {
      console.warn('[leads] Rejecting submission — site not found or inactive', { siteId });
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    console.log('[leads] Inserting new lead', { siteId, name, service_type, source_page });

    const payload: Record<string, unknown> = {
      site_id: siteId,
      name,
      email: email || null,
      phone: phone || null,
      service_type: service_type || null,
      message: message || null,
      address: address || null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      source_page: source_page || null,
      status: 'new',
    };

    // Insert with graceful fallback: if an optional column hasn't been migrated
    // yet (address → migration 038, metadata → migration 055), Postgres reports
    // "column X does not exist" — strip that column and retry so the lead still
    // captures rather than 500ing.
    let result = await supabase.from('leads').insert(payload).select().single();
    for (let attempt = 0; attempt < 2 && result.error; attempt++) {
      const missing = result.error.message.match(/column .*?"?(address|metadata)"? .*does not exist/i);
      if (!missing) break;
      console.warn(`[leads] ${missing[1]} column missing — retrying without it (apply the pending migration to enable it)`);
      delete payload[missing[1]];
      result = await supabase.from('leads').insert(payload).select().single();
    }
    const { data: lead, error } = result;

    if (error) {
      console.error('[leads] Failed to insert lead:', error);
      return NextResponse.json(
        { error: 'Failed to submit lead', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    console.log('[leads] Inserted lead', { leadId: lead.id, siteId });

    // Fire notification event (non-blocking — failures don't break the public form)
    try {
      await inngest.send({
        name: 'lead/created',
        data: { leadId: lead.id, siteId },
      });
    } catch (eventError) {
      console.error('[leads] Failed to enqueue lead/created event:', eventError);
    }

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    console.error('[leads] Error handling lead submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
