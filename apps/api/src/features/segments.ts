/**
 * Smart Segments (#7). Two parts:
 *  - classifyAuto: derive the automatic segment memberships for a subject from
 *    its behavioral/commerce signals.
 *  - evaluateRules: evaluate a custom segment rule tree against a subject.
 * Both are pure and unit-tested.
 */
import { type IntentBand, intentBand } from '@arre/shared';

export interface SubjectSignals {
  intentScore: number;
  sessions: number;
  ordersCount: number;
  aovCents: number;
  ltvCents: number;
  hasAbandonedCart: boolean;
  hasAbandonedCheckout: boolean;
  daysSinceLastSeen: number;
  emailEngaged: boolean;
  couponUses: number;
  webPushSubscribed: boolean;
  whatsappReady: boolean;
}

export const AUTO_SEGMENTS = [
  'new_visitor', 'returning_visitor', 'high_intent', 'cart_abandoner',
  'checkout_abandoner', 'one_time_buyer', 'repeat_buyer', 'vip',
  'price_sensitive', 'discount_hunter', 'inactive', 'likely_to_churn',
  'likely_to_buy_7d', 'high_aov', 'low_aov', 'email_engaged',
  'email_unengaged', 'whatsapp_ready', 'web_push_subscriber', 'coupon_abuse_risk',
] as const;
export type AutoSegment = (typeof AUTO_SEGMENTS)[number];

export function classifyAuto(s: SubjectSignals): AutoSegment[] {
  const out = new Set<AutoSegment>();
  const band: IntentBand = intentBand(s.intentScore);

  out.add(s.sessions <= 1 ? 'new_visitor' : 'returning_visitor');
  if (band === 'high') out.add('high_intent');
  if (s.hasAbandonedCart) out.add('cart_abandoner');
  if (s.hasAbandonedCheckout) out.add('checkout_abandoner');

  if (s.ordersCount === 1) out.add('one_time_buyer');
  if (s.ordersCount >= 2) out.add('repeat_buyer');
  if (s.ordersCount >= 3 && s.ltvCents >= 50000) out.add('vip');

  if (s.aovCents > 0 && s.aovCents < 3000) out.add('low_aov');
  if (s.aovCents >= 15000) out.add('high_aov');

  if (s.couponUses >= 3) out.add('discount_hunter');
  if (s.couponUses >= 6) out.add('coupon_abuse_risk');
  if (s.couponUses >= 2 && s.aovCents < 5000) out.add('price_sensitive');

  if (s.daysSinceLastSeen >= 60) out.add('inactive');
  if (s.daysSinceLastSeen >= 30 && s.ordersCount >= 1) out.add('likely_to_churn');
  if (band !== 'cold' && s.daysSinceLastSeen <= 7) out.add('likely_to_buy_7d');

  out.add(s.emailEngaged ? 'email_engaged' : 'email_unengaged');
  if (s.webPushSubscribed) out.add('web_push_subscriber');
  if (s.whatsappReady) out.add('whatsapp_ready');

  return [...out];
}

/* ----- Custom rule tree ----- */
export type Comparator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
export interface Condition {
  field: keyof SubjectSignals;
  op: Comparator;
  value: number | boolean;
}
export interface RuleGroup {
  all?: Array<Condition | RuleGroup>;
  any?: Array<Condition | RuleGroup>;
}

function isGroup(node: Condition | RuleGroup): node is RuleGroup {
  return (node as RuleGroup).all !== undefined || (node as RuleGroup).any !== undefined;
}

function evalCondition(c: Condition, s: SubjectSignals): boolean {
  const actual = s[c.field];
  const expected = c.value;
  switch (c.op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
  }
}

export function evaluateRules(group: RuleGroup, s: SubjectSignals): boolean {
  if (group.all) {
    return group.all.every((n) => (isGroup(n) ? evaluateRules(n, s) : evalCondition(n, s)));
  }
  if (group.any) {
    return group.any.some((n) => (isGroup(n) ? evaluateRules(n, s) : evalCondition(n, s)));
  }
  return true; // empty group matches everyone
}
