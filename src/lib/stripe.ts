import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backward compatibility, export as stripe (but calls getStripe internally)
export const stripe = {
  get customers() { return getStripe().customers; },
  get subscriptions() { return getStripe().subscriptions; },
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
};

// Plan configuration - maps internal plan names to Stripe Price IDs
export const PLAN_CONFIG = {
  growth: {
    name: 'growth',
    displayName: 'Growth',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth_placeholder',
    priceCents: 7900,
    features: [
      'AI-Generated SEO Website',
      'Job Snaps Photo Posts',
      'Unlimited Service Pages',
      'Service Area Landing Pages',
      'Mobile-Optimized Design',
      'Basic Analytics',
    ],
  },
  growth_ai_leads: {
    name: 'growth_ai_leads',
    displayName: 'Growth + AI Leads',
    priceId: process.env.STRIPE_GROWTH_AI_LEADS_PRICE_ID || 'price_growth_ai_leads_placeholder',
    priceCents: 29700,
    features: [
      'Everything in Growth',
      'AI Chat Widget',
      'Call Tracking Number',
      'CRM Integration (GoHighLevel)',
      'Automated Follow-ups',
      'Missed Call Text Back',
      'Lead Notifications',
      'Priority Support',
    ],
    highlighted: true,
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIG;

export function getPlanConfig(planName: PlanName) {
  return PLAN_CONFIG[planName];
}

export function getAllPlans() {
  return Object.values(PLAN_CONFIG);
}
