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

// Plan configuration - maps internal plan names to Stripe Price IDs.
// Internal keys MATCH display names so code/env vars/customer-facing labels
// all line up. Renaming is intentionally deep — see migration 045.
export const PLAN_CONFIG = {
  jobsnaps_pro: {
    name: 'jobsnaps_pro',
    displayName: 'Job Snaps Pro',
    priceId: process.env.STRIPE_JOBSNAPS_PRO_PRICE_ID || 'price_jobsnaps_pro_placeholder',
    priceCents: 3700,
    trialDays: 14,
    features: [
      'AI-generated photo titles + descriptions',
      'Push to your existing website (Next.js, WordPress, anywhere)',
      'Push to Google Business Profile',
      'Push to Facebook, Instagram, TikTok',
      'Unlimited Job Snaps',
      'API + Webhooks',
      '14-day free trial',
    ],
  },
  jobsnaps_max: {
    name: 'jobsnaps_max',
    displayName: 'Job Snaps Max',
    priceId: process.env.STRIPE_JOBSNAPS_MAX_PRICE_ID || 'price_jobsnaps_max_placeholder',
    priceCents: 6700,
    trialDays: 14,
    features: [
      'Everything in Job Snaps Pro',
      'Auto-generated flip-through videos for Reels/Shorts',
      'YouTube Shorts publishing',
      'Branded video outros + music',
      'Priority support',
    ],
  },
  starter: {
    name: 'starter',
    displayName: 'GrowLocal 360 Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_placeholder',
    priceCents: 14700,
    features: [
      'AI-generated SEO website built for local map pack ranking',
      'Job Snaps Pro included ($37 value)',
      'Unlimited service + service area landing pages',
      'GBP integration',
      'Lead capture forms + basic scheduling',
      'Mobile-optimized design',
      'Basic analytics',
    ],
  },
  growth: {
    name: 'growth',
    displayName: 'GrowLocal 360 Growth',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth_placeholder',
    priceCents: 29700,
    features: [
      'Everything in Starter',
      'Job Snaps Max included ($67 value)',
      'AI chat widget',
      'Call tracking number',
      'CRM integration (GoHighLevel)',
      'Automated follow-ups',
      'Missed call text back',
      'Lead notifications',
      'Priority support',
    ],
    highlighted: true,
  },
  dominate: {
    name: 'dominate',
    displayName: 'GrowLocal 360 Dominate',
    priceId: process.env.STRIPE_DOMINATE_PRICE_ID || 'price_dominate_placeholder',
    priceCents: 49700,
    features: [
      'Everything in Growth',
      'HighLevel Conversations AI',
      'HighLevel Voice AI (AI receptionist)',
      'Custom AI agents',
      'Multi-location support',
      'Advanced analytics + GSC feedback loop',
      'Dedicated account manager',
    ],
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIG;

export function getPlanConfig(planName: PlanName) {
  return PLAN_CONFIG[planName];
}

export function getAllPlans() {
  return Object.values(PLAN_CONFIG);
}
