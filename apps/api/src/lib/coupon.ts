import type { IntentBand } from '@arre/shared';

/**
 * AI coupon decisioning with margin protection. The goal: offer the SMALLEST
 * discount likely to recover the sale — and ideally no discount for very
 * high-intent shoppers. All percentages are clamped by the merchant's profit
 * guard settings.
 */
export interface CouponGuard {
  maxDiscountPct: number;
  maxDiscountCents: number;
  minCartCents: number;
  /** 0..100; higher means likely abuser → suppress generous offers. */
  abuseScore: number;
}

export type CouponStrategy =
  | 'none'
  | 'reminder'
  | 'free_shipping'
  | 'small_discount'
  | 'discount'
  | 'social_proof'
  | 'urgency';

export interface CouponDecision {
  strategy: CouponStrategy;
  discountPct: number;
  freeShipping: boolean;
  rationale: string;
}

export function decideCoupon(input: {
  intentBand: IntentBand;
  cartCents: number;
  guard: CouponGuard;
  isReturningAbandoner: boolean;
}): CouponDecision {
  const { guard } = input;

  if (input.cartCents < guard.minCartCents) {
    return {
      strategy: 'reminder',
      discountPct: 0,
      freeShipping: false,
      rationale: 'Cart below minimum for a discount; sending a reminder instead.',
    };
  }

  if (guard.abuseScore >= 70) {
    return {
      strategy: 'reminder',
      discountPct: 0,
      freeShipping: false,
      rationale: 'High coupon-abuse risk; withholding discount to protect margin.',
    };
  }

  // Very high intent: don't discount unless they've abandoned before.
  if (input.intentBand === 'high' && !input.isReturningAbandoner) {
    return {
      strategy: 'urgency',
      discountPct: 0,
      freeShipping: false,
      rationale: 'High purchase intent — a nudge is enough; no discount needed.',
    };
  }

  const clampPct = (p: number) => Math.max(0, Math.min(p, guard.maxDiscountPct));

  if (input.intentBand === 'warm') {
    // Try the cheapest lever first: free shipping over a small percentage.
    return {
      strategy: 'free_shipping',
      discountPct: 0,
      freeShipping: true,
      rationale: 'Warm shopper — free shipping usually converts cheaper than a discount.',
    };
  }

  if (input.intentBand === 'browsing') {
    return {
      strategy: 'small_discount',
      discountPct: clampPct(5),
      freeShipping: false,
      rationale: 'Browsing shopper — a small discount to tip the decision.',
    };
  }

  // Cold / returning abandoner — slightly stronger but still capped.
  const pct = clampPct(input.isReturningAbandoner ? 10 : 7);
  return {
    strategy: 'discount',
    discountPct: pct,
    freeShipping: false,
    rationale: `Lower intent — offering a capped ${pct}% discount within profit guard.`,
  };
}
