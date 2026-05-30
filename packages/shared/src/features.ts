/**
 * The canonical registry of the 25 product features.
 *
 * This is the single source of truth shared by the SaaS API, the merchant
 * dashboard, the super-admin dashboard, and the WordPress plugin. Plan
 * entitlements (see plans.ts) and plugin-side feature toggles both key off
 * these stable string IDs, so changing an ID is a breaking change.
 */

export const FEATURE_IDS = [
  'visitor_tracking',
  'abandoned_cart_recovery',
  'ai_coupon_engine',
  'email_autopilot',
  'multichannel_automation',
  'automation_builder',
  'smart_segments',
  'product_recommendations',
  'onsite_personalization',
  'exit_intent_offers',
  'store_doctor',
  'revenue_attribution',
  'campaign_generator',
  'ab_testing',
  'discount_protection',
  'customer_timeline',
  'lead_capture_forms',
  'browse_abandonment',
  'checkout_friction',
  'email_designer',
  'license_control',
  'agency_whitelabel',
  'monthly_growth_report',
  'store_type_templates',
  'deliverability',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export interface FeatureDefinition {
  id: FeatureId;
  /** Human label shown in dashboards and the plugin. */
  name: string;
  /** Short marketing/help description. */
  description: string;
  /** Grouping used for dashboard navigation. */
  category:
    | 'tracking'
    | 'recovery'
    | 'coupons'
    | 'messaging'
    | 'automation'
    | 'audience'
    | 'insights'
    | 'growth'
    | 'platform';
  /** Whether the WordPress plugin exposes a local on/off toggle for it. */
  pluginToggle: boolean;
  /**
   * When true, the feature must be hard-stopped the moment the license goes
   * inactive (the "premium" surface area). Non-premium features (e.g. the
   * diagnostics/status page) keep working so the merchant can still see why
   * things stopped and re-activate.
   */
  premium: boolean;
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  visitor_tracking: {
    id: 'visitor_tracking',
    name: 'AI Visitor Tracking',
    description: 'Track on-site behavior and compute an explainable 0–100 purchase intent score.',
    category: 'tracking',
    pluginToggle: true,
    premium: true,
  },
  abandoned_cart_recovery: {
    id: 'abandoned_cart_recovery',
    name: 'Smart Abandoned Cart Recovery',
    description: 'Detect abandoned carts/checkouts and run AI-decided multi-step recovery flows.',
    category: 'recovery',
    pluginToggle: true,
    premium: true,
  },
  ai_coupon_engine: {
    id: 'ai_coupon_engine',
    name: 'AI Coupon Engine',
    description: 'Generate the smallest effective personalized coupon with margin protection.',
    category: 'coupons',
    pluginToggle: true,
    premium: true,
  },
  email_autopilot: {
    id: 'email_autopilot',
    name: 'AI Email Marketing Autopilot',
    description: 'Lifecycle email flows with AI-written copy, timing, segments, and attribution.',
    category: 'messaging',
    pluginToggle: true,
    premium: true,
  },
  multichannel_automation: {
    id: 'multichannel_automation',
    name: 'Multi-channel Automation',
    description: 'Email + Web Push now, WhatsApp-ready provider abstraction (no SMS).',
    category: 'messaging',
    pluginToggle: true,
    premium: true,
  },
  automation_builder: {
    id: 'automation_builder',
    name: 'Visual Automation Builder',
    description: 'Trigger → Condition → Delay → Action flows with Autopilot and Manual modes.',
    category: 'automation',
    pluginToggle: false,
    premium: true,
  },
  smart_segments: {
    id: 'smart_segments',
    name: 'Smart Segments',
    description: 'Automatic + custom visitor/customer segments driven by behavior and AI.',
    category: 'audience',
    pluginToggle: false,
    premium: true,
  },
  product_recommendations: {
    id: 'product_recommendations',
    name: 'Product Recommendation Engine',
    description: 'AI product recommendations across emails, popups, cart recovery and dashboards.',
    category: 'growth',
    pluginToggle: true,
    premium: true,
  },
  onsite_personalization: {
    id: 'onsite_personalization',
    name: 'On-site Personalization',
    description: 'Top bars, popups, slide-ins and reminders targeted by segment and page.',
    category: 'messaging',
    pluginToggle: true,
    premium: true,
  },
  exit_intent_offers: {
    id: 'exit_intent_offers',
    name: 'Exit Intent Offers',
    description: 'Detect exit intent and show an AI-selected offer with frequency caps.',
    category: 'messaging',
    pluginToggle: true,
    premium: true,
  },
  store_doctor: {
    id: 'store_doctor',
    name: 'AI Store Doctor',
    description: 'Diagnose lost revenue, friction and opportunities with prioritized actions.',
    category: 'insights',
    pluginToggle: false,
    premium: true,
  },
  revenue_attribution: {
    id: 'revenue_attribution',
    name: 'Revenue Attribution Dashboard',
    description: 'Recovered vs tracked revenue, ROI, and the "you paid $X, we recovered $Y" hero.',
    category: 'insights',
    pluginToggle: false,
    premium: true,
  },
  campaign_generator: {
    id: 'campaign_generator',
    name: 'AI Campaign Generator',
    description: 'Describe a goal in plain language; AI builds a full multi-channel campaign.',
    category: 'growth',
    pluginToggle: false,
    premium: true,
  },
  ab_testing: {
    id: 'ab_testing',
    name: 'Auto A/B Testing',
    description: 'Split-test subject lines, copy, coupons and timing; auto-select the winner.',
    category: 'growth',
    pluginToggle: false,
    premium: true,
  },
  discount_protection: {
    id: 'discount_protection',
    name: 'AI Pricing & Discount Protection',
    description: 'Margin guards, max-discount rules and abuse scoring to protect profit.',
    category: 'coupons',
    pluginToggle: true,
    premium: true,
  },
  customer_timeline: {
    id: 'customer_timeline',
    name: 'Customer Timeline',
    description: 'Full unified profile with anonymous-to-known identity merge.',
    category: 'audience',
    pluginToggle: false,
    premium: true,
  },
  lead_capture_forms: {
    id: 'lead_capture_forms',
    name: 'Lead Capture Forms',
    description: 'Popups, embeds, floating bars and waitlists with consent compliance.',
    category: 'messaging',
    pluginToggle: true,
    premium: true,
  },
  browse_abandonment: {
    id: 'browse_abandonment',
    name: 'Browse Abandonment',
    description: 'Detect repeated product/category interest and follow up by email or on-site.',
    category: 'recovery',
    pluginToggle: true,
    premium: true,
  },
  checkout_friction: {
    id: 'checkout_friction',
    name: 'Checkout Friction Detection',
    description: 'Pinpoint where checkout breaks down and recommend fixes.',
    category: 'insights',
    pluginToggle: true,
    premium: true,
  },
  email_designer: {
    id: 'email_designer',
    name: 'AI Email Designer',
    description: 'Brand-matched, block-based email templates with desktop/mobile preview.',
    category: 'messaging',
    pluginToggle: false,
    premium: true,
  },
  license_control: {
    id: 'license_control',
    name: 'Subscription & License Control',
    description: 'License/serial lifecycle, entitlements, and the emergency kill switch.',
    category: 'platform',
    pluginToggle: false,
    premium: false,
  },
  agency_whitelabel: {
    id: 'agency_whitelabel',
    name: 'White-label / Agency',
    description: 'Agency accounts, multi-client stores, and white-label reporting.',
    category: 'platform',
    pluginToggle: false,
    premium: true,
  },
  monthly_growth_report: {
    id: 'monthly_growth_report',
    name: 'AI Monthly Growth Report',
    description: 'Auto-generated monthly PDF report with next-month action plan (stored in R2).',
    category: 'insights',
    pluginToggle: false,
    premium: true,
  },
  store_type_templates: {
    id: 'store_type_templates',
    name: 'Plug-and-play Templates',
    description: 'Store-type presets that seed flows, segments, coupons and tone on onboarding.',
    category: 'growth',
    pluginToggle: false,
    premium: true,
  },
  deliverability: {
    id: 'deliverability',
    name: 'Smart Deliverability System',
    description: 'SPF/DKIM/DMARC checks, suppression, bounce tracking and deliverability score.',
    category: 'insights',
    pluginToggle: false,
    premium: true,
  },
};

/** Feature IDs that must be hard-stopped when a license becomes inactive. */
export const PREMIUM_FEATURE_IDS: FeatureId[] = FEATURE_IDS.filter(
  (id) => FEATURES[id].premium,
);

export function isFeatureId(value: string): value is FeatureId {
  return (FEATURE_IDS as readonly string[]).includes(value);
}
