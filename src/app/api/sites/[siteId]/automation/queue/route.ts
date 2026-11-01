import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

const STATUSES = ['pending', 'approved', 'rejected', 'published', 'failed'] as const;

/** GET /api/sites/[siteId]/automation/queue?status=pending|history */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const admin = createAdminClient();
  let query = admin.from('pending_actions').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(100);
  if (status === 'history') query = query.in('status', ['published', 'rejected', 'failed']);
  else if ((STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data || [] });
}
