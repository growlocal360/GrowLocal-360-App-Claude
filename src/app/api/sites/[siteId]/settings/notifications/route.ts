import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

// GET - fetch notification settings + resolved fallback email
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminSupabase = createAdminClient();
  const [{ data: site }, { data: schedConfig }, { data: { user } }] = await Promise.all([
    adminSupabase.from('sites').select('settings, organization_id').eq('id', siteId).single(),
    adminSupabase.from('scheduling_configs').select('notification_email, notification_phone').eq('site_id', siteId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const settings = (site.settings || {}) as Record<string, unknown>;
  const leadEmail = typeof settings.lead_notification_email === 'string' ? settings.lead_notification_email : '';
  const leadPhone = typeof settings.lead_notification_phone === 'string' ? settings.lead_notification_phone : '';

  // Compute the email that would actually receive notifications today
  const resolvedEmail = leadEmail || schedConfig?.notification_email || user?.email || '';

  return NextResponse.json({
    leadNotificationEmail: leadEmail,
    leadNotificationPhone: leadPhone,
    resolvedEmail,
    fallbackSource: leadEmail ? 'explicit' : schedConfig?.notification_email ? 'scheduling_config' : user?.email ? 'auth_user' : 'none',
  });
}

// PATCH - update notification settings
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const { leadNotificationEmail, leadNotificationPhone } = body;

  const adminSupabase = createAdminClient();
  const { data: site } = await adminSupabase.from('sites').select('settings').eq('id', siteId).single();
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const currentSettings = (site.settings || {}) as Record<string, unknown>;
  const updatedSettings = {
    ...currentSettings,
    ...(leadNotificationEmail !== undefined && { lead_notification_email: leadNotificationEmail || null }),
    ...(leadNotificationPhone !== undefined && { lead_notification_phone: leadNotificationPhone || null }),
  };

  const { error } = await adminSupabase
    .from('sites')
    .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
    .eq('id', siteId);

  if (error) {
    console.error('Failed to update notification settings:', error);
    return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// POST - send a test lead (inserts a fake row + fires lead/created so the owner can verify delivery)
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminSupabase = createAdminClient();
  const { data: site } = await adminSupabase.from('sites').select('id, name').eq('id', siteId).single();
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const { data: lead, error } = await adminSupabase
    .from('leads')
    .insert({
      site_id: siteId,
      name: 'Test Lead',
      email: 'test@example.com',
      phone: '555-555-0100',
      service_type: 'Test service',
      message: 'This is a test lead generated from the Notifications settings panel. You can safely delete it.',
      source_page: 'Settings → Notifications (test)',
      status: 'new',
    })
    .select()
    .single();

  if (error) {
    console.error('[notifications] Failed to insert test lead:', error);
    return NextResponse.json({ error: 'Failed to create test lead' }, { status: 500 });
  }

  try {
    await inngest.send({
      name: 'lead/created',
      data: { leadId: lead.id, siteId, isTest: true },
    });
  } catch (eventError) {
    console.error('[notifications] Failed to enqueue test lead event:', eventError);
    return NextResponse.json({ error: 'Lead created but notification failed to queue' }, { status: 500 });
  }

  return NextResponse.json({ success: true, leadId: lead.id }, { status: 201 });
}
