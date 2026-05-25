import type { IntentBand } from '@arre/shared';
import { decideCoupon, type CouponGuard } from './coupon.js';

/**
 * Abandoned-cart recovery planning. Given a cart's context, produce an ordered
 * sequence of recovery steps. The AI strategy escalates across steps, and the
 * final step may attach a coupon — but only when the coupon engine (with the
 * merchant's profit guard) decides one is warranted.
 *
 * Stop conditions (purchase, empty cart, inactive license) are enforced by the
 * scheduler that executes the plan, not here.
 */
export type RecoveryChannel = 'email' | 'web_push';

export interface RecoveryStep {
  order: number;
  channel: RecoveryChannel;
  /** Minutes after abandonment to send this step. */
  delayMinutes: number;
  strategy: 'reminder' | 'social_proof' | 'urgency' | 'free_shipping' | 'discount';
  withCoupon: boolean;
  discountPct: number;
  rationale: string;
}

export interface RecoveryContext {
  intentBand: IntentBand;
  cartCents: number;
  guard: CouponGuard;
  isReturningAbandoner: boolean;
  /** Whether we have a known email to send to (else web_push only). */
  hasEmail: boolean;
  /** Merchant's configured delays (minutes) for the three steps. */
  delays?: [number, number, number];
}

export function planRecovery(ctx: RecoveryContext): RecoveryStep[] {
  const delays = ctx.delays ?? [60, 24 * 60, 72 * 60];
  const channel: RecoveryChannel = ctx.hasEmail ? 'email' : 'web_push';

  // Step 1 — gentle reminder, never discounted.
  const steps: RecoveryStep[] = [
    {
      order: 1,
      channel,
      delayMinutes: delays[0],
      strategy: 'reminder',
      withCoupon: false,
      discountPct: 0,
      rationale: 'First touch: a simple reminder converts best and protects margin.',
    },
  ];

  // Step 2 — strategy depends on intent. Higher intent → urgency/social proof
  // (no discount); lower intent → free shipping.
  const step2Strategy =
    ctx.intentBand === 'high'
      ? 'urgency'
      : ctx.intentBand === 'warm'
        ? 'social_proof'
        : 'free_shipping';
  steps.push({
    order: 2,
    channel,
    delayMinutes: delays[1],
    strategy: step2Strategy,
    withCoupon: false,
    discountPct: 0,
    rationale: `Second touch tuned to ${ctx.intentBand} intent without a discount yet.`,
  });

  // Step 3 — last chance. Ask the coupon engine whether a discount is justified.
  const coupon = decideCoupon({
    intentBand: ctx.intentBand,
    cartCents: ctx.cartCents,
    guard: ctx.guard,
    isReturningAbandoner: ctx.isReturningAbandoner,
  });
  const wantsDiscount = coupon.discountPct > 0 || coupon.freeShipping;
  steps.push({
    order: 3,
    channel,
    delayMinutes: delays[2],
    strategy: coupon.freeShipping ? 'free_shipping' : wantsDiscount ? 'discount' : 'urgency',
    withCoupon: coupon.discountPct > 0,
    discountPct: coupon.discountPct,
    rationale: coupon.rationale,
  });

  return steps;
}

/** Which step (if any) is due now, given when the cart was abandoned. */
export function dueStep(
  steps: RecoveryStep[],
  abandonedAtMs: number,
  sentOrders: number[],
  now: number = Date.now(),
): RecoveryStep | null {
  const minutesElapsed = (now - abandonedAtMs) / 60000;
  for (const step of steps) {
    if (sentOrders.includes(step.order)) continue;
    if (minutesElapsed >= step.delayMinutes) return step;
  }
  return null;
}
