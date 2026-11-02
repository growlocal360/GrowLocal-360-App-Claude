import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Scan credits. The weekly scheduled scan is included with the plan; a manual
 * "Scan now" spends one credit per keyword scanned across the grid. Credits
 * live on the organization (an agency buys once for all its sites) with a
 * ledger row for every change.
 */

export const WELCOME_CREDITS = 10;

export const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, priceCents: 500, label: '10 credits', note: 'about 2 full scans at 5 keywords' },
  { id: 'pack_30', credits: 30, priceCents: 1200, label: '30 credits', note: 'about 6 full scans' },
  { id: 'pack_100', credits: 100, priceCents: 3000, label: '100 credits', note: 'about 20 full scans' },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export async function orgIdForSite(supabase: SupabaseClient, siteId: string): Promise<string | null> {
  const { data } = await supabase.from('sites').select('organization_id').eq('id', siteId).maybeSingle();
  return data?.organization_id || null;
}

export async function getBalance(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const { data } = await supabase.from('organizations').select('scan_credits').eq('id', organizationId).maybeSingle();
  return typeof data?.scan_credits === 'number' ? data.scan_credits : 0;
}

/**
 * Spend `n` credits if the balance allows. The conditional update
 * (`scan_credits >= n`) makes two simultaneous requests unable to both
 * succeed on the last credits.
 */
export async function spendCredits(
  supabase: SupabaseClient,
  organizationId: string,
  n: number,
  reason: string,
  siteId: string | null
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  if (n <= 0) return { ok: true, balance: await getBalance(supabase, organizationId) };
  const before = await getBalance(supabase, organizationId);
  if (before < n) return { ok: false, balance: before };
  const { data, error } = await supabase
    .from('organizations')
    .update({ scan_credits: before - n })
    .eq('id', organizationId)
    .gte('scan_credits', n)
    .eq('scan_credits', before)
    .select('scan_credits')
    .maybeSingle();
  if (error || !data) {
    // Someone else spent in between; re-read and report.
    return { ok: false, balance: await getBalance(supabase, organizationId) };
  }
  await supabase.from('scan_credit_ledger').insert({ organization_id: organizationId, site_id: siteId, delta: -n, balance_after: data.scan_credits, reason });
  return { ok: true, balance: data.scan_credits };
}

/** Add credits. `stripeSessionId` makes a purchase idempotent across webhook retries. */
export async function grantCredits(
  supabase: SupabaseClient,
  organizationId: string,
  n: number,
  reason: string,
  opts: { siteId?: string | null; stripeSessionId?: string | null } = {}
): Promise<{ balance: number; duplicate: boolean }> {
  if (opts.stripeSessionId) {
    const { data: dupe } = await supabase.from('scan_credit_ledger').select('balance_after').eq('stripe_session_id', opts.stripeSessionId).maybeSingle();
    if (dupe) return { balance: dupe.balance_after as number, duplicate: true };
  }
  const before = await getBalance(supabase, organizationId);
  const after = before + n;
  await supabase.from('organizations').update({ scan_credits: after }).eq('id', organizationId);
  await supabase.from('scan_credit_ledger').insert({ organization_id: organizationId, site_id: opts.siteId || null, delta: n, balance_after: after, reason, stripe_session_id: opts.stripeSessionId || null });
  return { balance: after, duplicate: false };
}
