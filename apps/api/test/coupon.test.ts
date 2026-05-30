import { describe, it, expect } from 'vitest';
import { decideCoupon, type CouponGuard } from '../src/lib/coupon.js';
import { computeIntent } from '../src/lib/intent.js';

const guard: CouponGuard = {
  maxDiscountPct: 15,
  maxDiscountCents: 5000,
  minCartCents: 2000,
  abuseScore: 0,
};

describe('decideCoupon', () => {
  it('withholds discount from very high intent shoppers', () => {
    const d = decideCoupon({ intentBand: 'high', cartCents: 5000, guard, isReturningAbandoner: false });
    expect(d.discountPct).toBe(0);
    expect(d.strategy).toBe('urgency');
  });

  it('prefers free shipping for warm shoppers', () => {
    const d = decideCoupon({ intentBand: 'warm', cartCents: 5000, guard, isReturningAbandoner: false });
    expect(d.freeShipping).toBe(true);
  });

  it('never exceeds the merchant max discount', () => {
    const d = decideCoupon({ intentBand: 'cold', cartCents: 9000, guard: { ...guard, maxDiscountPct: 6 }, isReturningAbandoner: true });
    expect(d.discountPct).toBeLessThanOrEqual(6);
  });

  it('suppresses offers for likely abusers', () => {
    const d = decideCoupon({ intentBand: 'cold', cartCents: 9000, guard: { ...guard, abuseScore: 80 }, isReturningAbandoner: true });
    expect(d.discountPct).toBe(0);
  });

  it('no discount below cart minimum', () => {
    const d = decideCoupon({ intentBand: 'cold', cartCents: 1000, guard, isReturningAbandoner: true });
    expect(d.strategy).toBe('reminder');
  });
});

describe('computeIntent', () => {
  it('produces an explainable reason and band', () => {
    const r = computeIntent([
      { type: 'product_view' },
      { type: 'product_view' },
      { type: 'add_to_cart' },
      { type: 'checkout_started' },
    ]);
    expect(r.score).toBeGreaterThan(30);
    expect(r.reason).toMatch(/cart|checkout|product/);
  });
});
