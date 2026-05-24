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
    const { name, email, phone, service_type, message, address, source_page } = body;

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

    const buildPayload = (includeAddress: boolean) => ({
      site_id: siteId,
      name,
      email: email || null,
      phone: phone || null,
      service_type: service_type || null,
      message: message || null,
      ...(includeAddress ? { address: address || null } : {}),
      source_page: source_page || null,
      status: 'new',
    });

    let { data: lead, error } = await supabase
      .from('leads')
      .insert(buildPayload(true))
      .select()
      .single();

    // Graceful fallback: if migration 038 hasn't been applied yet, the
    // address column doesn't exist — retry without it so the lead still
    // captures rather than 500ing.
    if (error && /column .*address.* does not exist/i.test(error.message)) {
      console.warn('[leads] address column missing — retrying without it (apply migration 038 to enable address capture)');
      const retry = await supabase
        .from('leads')
        .insert(buildPayload(false))
        .select()
        .single();
      lead = retry.data;
      error = retry.error;
    }

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
