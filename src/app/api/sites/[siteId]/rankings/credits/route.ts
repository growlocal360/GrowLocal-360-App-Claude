import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { stripe } from '@/lib/stripe';
import { CREDIT_PACKS, getBalance, orgIdForSite, type CreditPackId } from '@/lib/rank/credits';

/**
 * GET  -> { balance, packs, recent ledger }
 * POST { packId } -> Stripe Checkout URL for a one-time credit pack; the webhook grants the credits.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const orgId = await orgIdForSite(admin, siteId);
  if (!orgId) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const [balance, { data: ledger }] = await Promise.all([
    getBalance(admin, orgId),
    admin.from('scan_credit_ledger').select('delta, balance_after, reason, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10),
  ]);
  return NextResponse.json({ balance, packs: CREDIT_PACKS, ledger: ledger || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { packId?: CreditPackId };
  const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
  if (!pack) return NextResponse.json({ error: 'Pick a credit pack' }, { status: 400 });

  const admin = createAdminClient();
  const orgId = await orgIdForSite(admin, siteId);
  if (!orgId) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Reuse the buyer's Stripe customer when one exists and is still valid.
  const { data: profiles } = await admin.from('profiles').select('stripe_customer_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
  let customerId: string | null = profiles?.[0]?.stripe_customer_id || null;
  if (customerId) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      if ('deleted' in c && c.deleted) customerId = null;
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = c.id;
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
  const back = `${appUrl}/dashboard/sites/${siteId}/rankings`;
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceCents,
            product_data: { name: `GrowLocal 360 scan credits: ${pack.label}`, description: 'Manual Google Maps rank scans. 1 credit = one keyword scanned across your grid.' },
          },
        },
      ],
      metadata: { kind: 'scan_credits', organization_id: orgId, site_id: siteId, user_id: user.id, credits: String(pack.credits), pack_id: pack.id },
      success_url: `${back}?credits=purchased`,
      cancel_url: `${back}?credits=cancelled`,
      allow_promotion_codes: true,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not start checkout' }, { status: 500 });
  }
}
