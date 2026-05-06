import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getPlanConfig, PlanName } from '@/lib/stripe';
import { getActiveOrgId } from '@/lib/auth/active-org';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { planName, siteData, successUrl, cancelUrl } = body;

    // Validate plan
    if (
      !planName ||
      !['starter', 'growth', 'dominate', 'jobsnaps_pro', 'jobsnaps_max'].includes(planName)
    ) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    const plan = getPlanConfig(planName as PlanName);
    const isJobSnapsOnly = planName === 'jobsnaps_pro' || planName === 'jobsnaps_max';

    // Get or create Stripe customer
    // Note: .limit(1) instead of .single() — multi-org users have multiple profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    const profile = profiles?.[0];

    let stripeCustomerId: string | null = profile?.stripe_customer_id || null;

    // Verify the saved customer still exists in THIS Stripe account.
    // Common gotcha: switching Stripe accounts (test mode, sandboxes, or
    // live→test) leaves stale cus_xxx IDs that don't exist in the new account.
    if (stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(stripeCustomerId);
        if ('deleted' in existing && existing.deleted) {
          stripeCustomerId = null;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('No such customer') || msg.includes('resource_missing')) {
          console.warn(
            `Stale stripe_customer_id ${stripeCustomerId} not found in current Stripe account; creating new customer.`
          );
          stripeCustomerId = null;
        } else {
          throw e;
        }
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', user.id);
    }

    // For Job Snaps flows, capture the active org so the webhook attaches
    // the new workspace site to the right org. Existing logged-in users
    // (multi-org agencies) need this; brand-new signups don't have one yet.
    const activeOrgId = isJobSnapsOnly ? await getActiveOrgId() : null;

    let metadataPayload: Record<string, string>;

    if (isJobSnapsOnly) {
      // Job Snaps signup — stash business basics directly as metadata fields.
      // The webhook reads these to create a workspace site (no wizard data).
      metadataPayload = {
        user_id: user.id,
        plan_name: planName,
        business_name: (siteData?.businessName || '').slice(0, 100),
        industry: (siteData?.industry || '').slice(0, 50),
        city: (siteData?.city || '').slice(0, 50),
        state: (siteData?.state || '').slice(0, 10),
        phone: (siteData?.phone || '').slice(0, 30),
        ...(activeOrgId ? { organization_id: activeOrgId } : {}),
      };
    } else {
      // GL360 wizard — store full siteData JSON or fall back to pending_site_data
      const siteDataString = JSON.stringify(siteData);

      if (siteDataString.length > 400) {
        const { data: pendingSite, error: pendingError } = await supabase
          .from('pending_site_data')
          .insert({
            user_id: user.id,
            site_data: siteData,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single();

        if (pendingError) {
          console.error('Failed to store pending site data:', pendingError);
          return NextResponse.json(
            { error: 'Failed to initialize checkout. Please try again.' },
            { status: 500 }
          );
        }
        metadataPayload = {
          user_id: user.id,
          plan_name: planName,
          pending_site_id: pendingSite.id,
        };
      } else {
        metadataPayload = {
          user_id: user.id,
          plan_name: planName,
          site_data: siteDataString,
        };
      }
    }

    // For Job Snaps Pro, support 14-day free trial.
    const trialDays = isJobSnapsOnly && 'trialDays' in plan ? plan.trialDays : undefined;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      metadata: metadataPayload,
      subscription_data: {
        metadata: metadataPayload,
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      success_url:
        successUrl ||
        (isJobSnapsOnly
          ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/job-snaps?welcome=true&session_id={CHECKOUT_SESSION_ID}`
          : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sites/new/success?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url:
        cancelUrl ||
        (isJobSnapsOnly
          ? `${process.env.NEXT_PUBLIC_APP_URL}/signup/job-snaps`
          : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sites/new`),
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Create checkout error:', message, error);
    // Bubble up specifics in dev/preview so we can debug without server logs.
    // In production, keep the generic message to avoid leaking internals.
    const detail =
      process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'
        ? `: ${message}`
        : '';
    return NextResponse.json(
      { error: `Failed to create checkout session${detail}` },
      { status: 500 }
    );
  }
}
