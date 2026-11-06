import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';
import { aiModelsAvailable, lastAiBatchAt, AI_RECHECK_CREDITS, AI_RECHECK_MIN_HOURS } from '@/lib/rank/ai-visibility';
import { spendCredits } from '@/lib/rank/credits';

/**
 * POST -> run only the AI visibility check now (no grid scan). Costs AI_RECHECK_CREDITS,
 * charged up front and refunded by the Inngest function if no assistant answers.
 * Refused (409, nothing charged) when the last batch is younger than AI_RECHECK_MIN_HOURS.
 * The page polls GET /rankings until `ai.batchAt` moves past `startedAt`.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  if (aiModelsAvailable().length === 0) return NextResponse.json({ error: 'AI checks need at least one assistant configured (ANTHROPIC_API_KEY, OPENAI_API_KEY or DataForSEO).' }, { status: 400 });

  const admin = createAdminClient();
  const { data: site } = await admin.from('sites').select('organization_id, status').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.status !== 'active') return NextResponse.json({ error: 'The site has to be live before AI assistants can be asked about it.' }, { status: 400 });

  const last = await lastAiBatchAt(admin, siteId);
  if (last) {
    const ageHours = (Date.now() - new Date(last).getTime()) / 3_600_000;
    if (ageHours < AI_RECHECK_MIN_HOURS) {
      const wait = Math.max(1, Math.ceil(AI_RECHECK_MIN_HOURS - ageHours));
      return NextResponse.json({ error: `The assistants were asked ${Math.max(1, Math.round(ageHours))} hour${Math.round(ageHours) === 1 ? '' : 's'} ago and their answers rarely change within a day. Try again in ${wait} hour${wait === 1 ? '' : 's'}.`, lastBatchAt: last }, { status: 409 });
    }
  }

  const spend = await spendCredits(admin, site.organization_id, AI_RECHECK_CREDITS, 'ai_recheck', siteId);
  if (!spend.ok) {
    return NextResponse.json({ error: `An AI re-check needs ${AI_RECHECK_CREDITS} credits and you have ${spend.balance}. Buy credits or wait for the scheduled check.`, needCredits: AI_RECHECK_CREDITS, balance: spend.balance }, { status: 402 });
  }

  const startedAt = new Date().toISOString();
  await inngest.send({ name: 'rank/ai.requested', data: { siteId, charged: AI_RECHECK_CREDITS } });
  return NextResponse.json({ ok: true, balance: spend.balance, charged: AI_RECHECK_CREDITS, startedAt });
}
