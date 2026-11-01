import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createReviewRequest } from '@/lib/automation/review-requests';

/**
 * GET  /api/sites/[siteId]/automation/review-requests        -> recent requests
 * POST /api/sites/[siteId]/automation/review-requests        -> ask one customer
 *   Body: { name, phone?, email?, leadId?, appointmentId?, sendNow? }
 *   A human clicking "send" defaults to sendNow; omit it to respect the site's
 *   approve / autopilot mode instead.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const { data, error } = await admin.from('review_requests').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string; phone?: string; email?: string; leadId?: string; appointmentId?: string; sendNow?: boolean;
  };
  const admin = createAdminClient();

  // Prefill from a lead or appointment when only an id was sent.
  let name = body.name?.trim() || '';
  let phone = body.phone?.trim() || '';
  let email = body.email?.trim() || '';
  if (body.leadId && !name) {
    const { data: lead } = await admin.from('leads').select('name, phone, email').eq('id', body.leadId).eq('site_id', siteId).maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    name = lead.name || ''; phone = phone || lead.phone || ''; email = email || lead.email || '';
  }
  if (body.appointmentId && !name) {
    const { data: appt } = await admin.from('appointments').select('customer_name, customer_phone, customer_email').eq('id', body.appointmentId).eq('site_id', siteId).maybeSingle();
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    name = appt.customer_name || ''; phone = phone || appt.customer_phone || ''; email = email || appt.customer_email || '';
  }

  const result = await createReviewRequest(admin, {
    siteId,
    source: body.leadId ? 'lead' : 'manual',
    customer: { name, phone, email },
    leadId: body.leadId || null,
    appointmentId: body.appointmentId || null,
    sendNow: body.sendNow !== false,
    decidedBy: access.caller?.user_id ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
