import { type EventType, intentBand } from '@arre/shared';

/**
 * Explainable intent scoring. Each event type contributes weighted points;
 * repetition compounds (with diminishing returns), and reaching checkout is
 * weighted heavily. We also produce a human sentence the UI/AI can show, e.g.
 * "Visited product 4 times, added to cart, reached checkout, abandoned at payment."
 */
const WEIGHTS: Partial<Record<EventType, number>> = {
  page_view: 1,
  product_view: 6,
  category_view: 3,
  search: 4,
  add_to_cart: 20,
  remove_from_cart: -8,
  cart_updated: 3,
  checkout_started: 28,
  checkout_field_focus: 6,
  checkout_error: -4,
  coupon_applied: 8,
  coupon_failed: 2,
  returning_visit: 10,
  exit_intent: -3,
  purchase_completed: 0, // purchase ends the funnel; handled separately
};

export interface IntentInput {
  type: EventType;
  props?: Record<string, unknown>;
}

export interface IntentResult {
  score: number; // 0..100
  band: ReturnType<typeof intentBand>;
  reason: string;
}

export function computeIntent(events: IntentInput[]): IntentResult {
  const counts = new Map<EventType, number>();
  let raw = 0;

  for (const ev of events) {
    const n = (counts.get(ev.type) ?? 0) + 1;
    counts.set(ev.type, n);
    const w = WEIGHTS[ev.type] ?? 0;
    // Diminishing returns on repeats: full weight first time, then sqrt-scaled.
    raw += w * (n === 1 ? 1 : 1 / Math.sqrt(n));
  }

  // Squash to 0..100.
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const parts: string[] = [];
  const pv = counts.get('product_view') ?? 0;
  if (pv) parts.push(`viewed ${pv} product${pv > 1 ? 's' : ''}`);
  if (counts.get('add_to_cart')) parts.push('added to cart');
  if (counts.get('checkout_started')) parts.push('reached checkout');
  if (counts.get('checkout_error')) parts.push('hit a checkout error');
  if (counts.get('exit_intent')) parts.push('showed exit intent');
  const reason = parts.length ? parts.join(', ') : 'limited activity so far';

  return { score, band: intentBand(score), reason };
}
