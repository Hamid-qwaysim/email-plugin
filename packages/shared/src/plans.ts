import { FEATURE_IDS, type FeatureId } from './features.js';

/** Subscription plan tiers. `free_test` is the admin-issued beta/trial plan. */
export const PLAN_IDS = ['free_test', 'starter', 'growth', 'pro', 'agency'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * Usage limits per billing period. `null` means unlimited. These are enforced
 * server-side (the plugin never trusts its own counts) and surfaced read-only
 * in the merchant dashboard.
 */
export interface PlanLimits {
  maxStores: number | null;
  maxContacts: number | null;
  maxMonthlyEvents: number | null;
  maxMonthlyEmails: number | null;
  maxMonthlyAiGenerations: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Price in the smallest currency unit (cents) for one billing interval. */
  priceCents: number;
  /** Billing interval. All public plans bill annually. */
  interval: 'month' | 'year';
  /** When true, no fixed price — the UI shows a "Contact our team" CTA. */
  contactSales: boolean;
  currency: string;
  /** Feature IDs this plan is entitled to. */
  entitlements: FeatureId[];
  limits: PlanLimits;
  /** Shown with a "Test Mode" badge and only creatable by super admins. */
  internalOnly: boolean;
  marketingBlurb: string;
}

// Starter intentionally excludes the heavier AI/automation surface.
const STARTER_FEATURES: FeatureId[] = [
  'visitor_tracking',
  'abandoned_cart_recovery',
  'ai_coupon_engine',
  'email_autopilot',
  'smart_segments',
  'revenue_attribution',
  'customer_timeline',
  'lead_capture_forms',
  'browse_abandonment',
  'email_designer',
  'license_control',
  'deliverability',
];

const GROWTH_FEATURES: FeatureId[] = [
  ...STARTER_FEATURES,
  'multichannel_automation',
  'automation_builder',
  'product_recommendations',
  'onsite_personalization',
  'exit_intent_offers',
  'store_doctor',
  'checkout_friction',
  'store_type_templates',
];

const PRO_FEATURES: FeatureId[] = [
  ...GROWTH_FEATURES,
  'campaign_generator',
  'ab_testing',
  'discount_protection',
  'monthly_growth_report',
];

// Agency gets everything, including white-label.
const AGENCY_FEATURES: FeatureId[] = [...FEATURE_IDS];

export const PLANS: Record<PlanId, PlanDefinition> = {
  free_test: {
    id: 'free_test',
    name: 'Free Test / Beta',
    priceCents: 0,
    interval: 'year',
    contactSales: false,
    currency: 'usd',
    entitlements: [...PRO_FEATURES],
    limits: {
      maxStores: 1,
      maxContacts: 500,
      maxMonthlyEvents: 50_000,
      maxMonthlyEmails: 1_000,
      maxMonthlyAiGenerations: 100,
    },
    internalOnly: true,
    marketingBlurb: 'Admin-issued beta access with capped usage and an expiry date.',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceCents: 9700,
    interval: 'year',
    contactSales: false,
    currency: 'usd',
    entitlements: STARTER_FEATURES,
    limits: {
      maxStores: 1,
      maxContacts: 2_000,
      maxMonthlyEvents: 200_000,
      maxMonthlyEmails: 10_000,
      maxMonthlyAiGenerations: 300,
    },
    internalOnly: false,
    marketingBlurb: 'Core recovery, coupons and email for a single store.',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceCents: 19700,
    interval: 'year',
    contactSales: false,
    currency: 'usd',
    entitlements: GROWTH_FEATURES,
    limits: {
      maxStores: 1,
      maxContacts: 15_000,
      maxMonthlyEvents: 1_000_000,
      maxMonthlyEmails: 60_000,
      maxMonthlyAiGenerations: 1_500,
    },
    internalOnly: false,
    marketingBlurb: 'Full automation, personalization and the Store Doctor.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 24900,
    interval: 'year',
    contactSales: false,
    currency: 'usd',
    entitlements: PRO_FEATURES,
    limits: {
      maxStores: 3,
      maxContacts: 75_000,
      maxMonthlyEvents: 5_000_000,
      maxMonthlyEmails: 300_000,
      maxMonthlyAiGenerations: 8_000,
    },
    internalOnly: false,
    marketingBlurb: 'Campaign generator, A/B testing, profit guard and monthly reports.',
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceCents: 0,
    interval: 'year',
    contactSales: true,
    currency: 'usd',
    entitlements: AGENCY_FEATURES,
    limits: {
      maxStores: 25,
      maxContacts: null,
      maxMonthlyEvents: null,
      maxMonthlyEmails: 1_000_000,
      maxMonthlyAiGenerations: 30_000,
    },
    internalOnly: false,
    marketingBlurb: 'Custom plan for agencies — multi-client management and white-label reporting. Contact our team.',
  },
};

/** Format a plan's price for display, e.g. "$97/yr" or "Contact our team". */
export function formatPlanPrice(plan: PlanDefinition): string {
  if (plan.contactSales) return 'Contact our team';
  const amount = (plan.priceCents / 100).toLocaleString('en-US', { style: 'currency', currency: plan.currency.toUpperCase(), maximumFractionDigits: 0 });
  return `${amount}/${plan.interval === 'year' ? 'yr' : 'mo'}`;
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

/** Resolve the effective entitlement set for a plan + per-license overrides. */
export function resolveEntitlements(
  planId: PlanId,
  overrides?: Partial<Record<FeatureId, boolean>>,
): Set<FeatureId> {
  const set = new Set<FeatureId>(PLANS[planId].entitlements);
  if (overrides) {
    for (const [feature, enabled] of Object.entries(overrides)) {
      if (enabled) set.add(feature as FeatureId);
      else set.delete(feature as FeatureId);
    }
  }
  return set;
}
