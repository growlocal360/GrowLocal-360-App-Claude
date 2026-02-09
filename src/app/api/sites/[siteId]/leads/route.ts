import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * POST /api/sites/[siteId]/leads
 * Public endpoint — submits a lead from a site form
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    const body = await request.json();
    const { name, email, phone, service_type, message, source_page } = body;

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
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Insert the lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        site_id: siteId,
        name,
        email: email || null,
        phone: phone || null,
        service_type: service_type || null,
        message: message || null,
        source_page: source_page || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert lead:', error);
      return NextResponse.json({ error: 'Failed to submit lead' }, { status: 500 });
    }

    // TODO: Send email notification to site owner
    // This will be implemented with Resend/SendGrid in a future iteration

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    console.error('Error handling lead submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
