import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createStaticClient } from '@/lib/supabase/static';
import { createSiteFromWizardData, ensureUserOrganization } from '@/lib/sites/create-site';
import type { WizardSiteData } from '@/lib/sites/create-site';

// Disable body parsing for webhook
export const runtime = 'nodejs';

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createStaticClient();

  const metadata = session.metadata || {};
  const userId = metadata.user_id;
  const planName = metadata.plan_name;

  if (!userId || !planName) {
    console.error('Missing required metadata in checkout session:', { userId, planName });
    return;
  }

  // Get site data - either from metadata or pending_site_data table
  let siteData: WizardSiteData | null = null;

  if (metadata.site_data) {
    try {
      siteData = JSON.parse(metadata.site_data);
    } catch (e) {
      console.error('Failed to parse site_data from metadata:', e);
    }
  } else if (metadata.pending_site_id) {
    const { data: pendingData } = await supabase
      .from('pending_site_data')
      .select('site_data')
      .eq('id', metadata.pending_site_id)
      .single();

    if (pendingData?.site_data) {
      siteData = pendingData.site_data as WizardSiteData;

      // Delete the pending record
      await supabase
        .from('pending_site_data')
        .delete()
        .eq('id', metadata.pending_site_id);
    }
  }

  if (!siteData) {
    console.error('No site data found for checkout session');
    return;
  }

  // Get the subscription plan from database
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', planName)
    .single();

  if (!plan) {
    console.error('Subscription plan not found:', planName);
    return;
  }

  // Ensure user has an organization
  const organizationId = await ensureUserOrganization(
    userId,
    undefined,
    siteData.businessName
  );

  // Create the site
  const { siteId } = await createSiteFromWizardData(
    userId,
    organizationId,
    siteData
  );

  // Create subscription record
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

  // Get billing period from first subscription item (Stripe API v2024+)
  const firstItem = stripeSubscription.items?.data?.[0];
  const currentPeriodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const currentPeriodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  await supabase.from('subscriptions').insert({
    user_id: userId,
    site_id: siteId,
    plan_id: plan.id,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    status: stripeSubscription.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
  });

  // Record the initial payment
  if (session.payment_intent) {
    await supabase.from('payments').insert({
      subscription_id: (await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()
      ).data?.id,
      stripe_payment_intent_id: session.payment_intent as string,
      amount_cents: session.amount_total || 0,
      status: 'succeeded',
    });
  }

  // Trigger background content generation
  // Site was created with status 'building', now start the AI content generation
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const internalKey = process.env.INTERNAL_API_KEY;
    // Use the new background function that supports up to 5 minutes
    fetch(`${baseUrl}/api/sites/${siteId}/generate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalKey || '',
      },
    }).catch((err) => {
      // Fire and forget - content generation happens async in background
      console.error('Failed to trigger content generation:', err);
    });
  } catch {
    // Content generation error shouldn't fail the webhook
    // Site is still created, user can retry from dashboard
    console.error('Failed to trigger content generation');
  }

  console.log(`Site ${siteId} created for user ${userId} with plan ${planName}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createStaticClient();

  // Get billing period from first subscription item (Stripe API v2024+)
  const firstItem = subscription.items?.data?.[0];
  const currentPeriodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const currentPeriodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createStaticClient();

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createStaticClient();

  // Get subscription ID from parent details (Stripe API v2024+)
  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  // Get subscription from database
  const { data: dbSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id)
    .single();

  if (!dbSubscription) return;

  // Record the payment
  await supabase.from('payments').insert({
    subscription_id: dbSubscription.id,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_paid || 0,
    status: 'succeeded',
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createStaticClient();

  // Get subscription ID from parent details (Stripe API v2024+)
  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  const stripeSubId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubId);

  // Record the failed payment
  const { data: dbSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubId)
    .single();

  if (dbSubscription) {
    await supabase.from('payments').insert({
      subscription_id: dbSubscription.id,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_due || 0,
      status: 'failed',
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
