import { describe, it, expect } from 'vitest';
import { planRecovery, dueStep } from '../src/lib/recovery.js';
import type { CouponGuard } from '../src/lib/coupon.js';

const guard: CouponGuard = { maxDiscountPct: 15, maxDiscountCents: 5000, minCartCents: 2000, abuseScore: 0 };

describe('planRecovery', () => {
  it('produces three escalating steps, first never discounted', () => {
    const steps = planRecovery({ intentBand: 'browsing', cartCents: 6000, guard, isReturningAbandoner: false, hasEmail: true });
    expect(steps).toHaveLength(3);
    expect(steps[0]!.strategy).toBe('reminder');
    expect(steps[0]!.withCoupon).toBe(false);
    expect(steps[0]!.discountPct).toBe(0);
  });

  it('high intent gets urgency, not a discount, even at the last step', () => {
    const steps = planRecovery({ intentBand: 'high', cartCents: 6000, guard, isReturningAbandoner: false, hasEmail: true });
    expect(steps[2]!.withCoupon).toBe(false);
    expect(steps[2]!.discountPct).toBe(0);
  });

  it('uses web_push channel when no email is known', () => {
    const steps = planRecovery({ intentBand: 'cold', cartCents: 6000, guard, isReturningAbandoner: true, hasEmail: false });
    expect(steps.every((s) => s.channel === 'web_push')).toBe(true);
  });

  it('never exceeds the merchant max discount on the final step', () => {
    const steps = planRecovery({ intentBand: 'cold', cartCents: 9000, guard: { ...guard, maxDiscountPct: 6 }, isReturningAbandoner: true, hasEmail: true });
    expect(steps[2]!.discountPct).toBeLessThanOrEqual(6);
  });
});

describe('dueStep', () => {
  const steps = planRecovery({ intentBand: 'browsing', cartCents: 6000, guard, isReturningAbandoner: false, hasEmail: true });
  const abandoned = 1_000_000;

  it('returns nothing before the first delay', () => {
    expect(dueStep(steps, abandoned, [], abandoned + 1000)).toBeNull();
  });

  it('returns step 1 once its delay elapses', () => {
    const at = abandoned + steps[0]!.delayMinutes * 60000 + 1;
    expect(dueStep(steps, abandoned, [], at)?.order).toBe(1);
  });

  it('skips already-sent steps', () => {
    const at = abandoned + steps[1]!.delayMinutes * 60000 + 1;
    expect(dueStep(steps, abandoned, [1], at)?.order).toBe(2);
  });
});
