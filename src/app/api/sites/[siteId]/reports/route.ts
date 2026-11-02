import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import { currentMonthKey } from '@/lib/reports/monthly';

const KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET  /api/sites/[siteId]/reports?period=YYYY-MM -> that month's stored report (or null) + available months
 * POST /api/sites/[siteId]/reports { period }      -> (re)generate in the background; poll GET
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const period = req.nextUrl.searchParams.get('period') || currentMonthKey();
  if (!KEY_RE.test(period)) return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: report }, { data: months }] = await Promise.all([
    admin.from('site_reports').select('period_key, data, generated_at, emailed_at').eq('site_id', siteId).eq('period_key', period).maybeSingle(),
    admin.from('site_reports').select('period_key, generated_at').eq('site_id', siteId).order('period_key', { ascending: false }).limit(24),
  ]);
  return NextResponse.json({ period, report: report || null, months: months || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { period?: string };
  const period = body.period || currentMonthKey();
  if (!KEY_RE.test(period)) return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  if (period > currentMonthKey()) return NextResponse.json({ error: 'That month has not happened yet' }, { status: 400 });

  await inngest.send({ name: 'reports/generate.requested', data: { siteId, period } });
  return NextResponse.json({ ok: true, period });
}
