import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getPlanConfig, PlanName } from '@/lib/stripe';

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
    if (!planName || !['growth', 'growth_ai_leads'].includes(planName)) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    const plan = getPlanConfig(planName as PlanName);

    // Get or create Stripe customer
    let stripeCustomerId: string;

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save Stripe customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', user.id);
    }

    // Store site data in a temporary table or session
    // For now, we'll store it in the checkout session metadata
    // Note: Stripe metadata has a 500 char limit per value, so we might need to store in DB
    const siteDataString = JSON.stringify(siteData);

    // If site data is too large for metadata, store it and pass a reference
    let metadataPayload: Record<string, string>;

    if (siteDataString.length > 400) {
      // Store site data in a temporary record
      const { data: pendingSite, error: pendingError } = await supabase
        .from('pending_site_data')
        .insert({
          user_id: user.id,
          site_data: siteData,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select('id')
        .single();

      if (pendingError) {
        // Don't proceed without site data - this will cause webhook to fail
        console.error('Failed to store pending site data:', pendingError);
        return NextResponse.json(
          { error: 'Failed to initialize checkout. Please try again.' },
          { status: 500 }
        );
      } else {
        metadataPayload = {
          user_id: user.id,
          plan_name: planName,
          pending_site_id: pendingSite.id,
        };
      }
    } else {
      metadataPayload = {
        user_id: user.id,
        plan_name: planName,
        site_data: siteDataString,
      };
    }

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
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sites/new/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sites/new`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
