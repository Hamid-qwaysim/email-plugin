/**
 * Checkout Friction Detection (#19). Builds the checkout funnel from event
 * counts and pinpoints the biggest drop-off step + likely reasons. Pure.
 */
export interface FunnelCounts {
  productViews: number;
  addToCart: number;
  checkoutStarted: number;
  checkoutErrors: number;
  couponFailed: number;
  purchases: number;
}

export interface FunnelStep {
  from: string;
  to: string;
  enter: number;
  exit: number;
  dropPct: number;
}

export interface FrictionReport {
  steps: FunnelStep[];
  worstStep: FunnelStep | null;
  reasons: string[];
}

export function analyzeFunnel(c: FunnelCounts): FrictionReport {
  const steps: FunnelStep[] = [
    mkStep('product_view', 'add_to_cart', c.productViews, c.addToCart),
    mkStep('add_to_cart', 'checkout_started', c.addToCart, c.checkoutStarted),
    mkStep('checkout_started', 'purchase', c.checkoutStarted, c.purchases),
  ];

  const worstStep = steps.reduce<FunnelStep | null>((worst, s) => {
    if (s.enter < 5) return worst; // ignore low-volume noise
    if (!worst || s.dropPct > worst.dropPct) return s;
    return worst;
  }, null);

  const reasons: string[] = [];
  if (worstStep?.to === 'purchase') {
    if (c.checkoutErrors > 0) reasons.push('Checkout errors occurred during payment.');
    if (c.couponFailed > 0) reasons.push('Customers tried coupons that failed at checkout.');
    reasons.push('Shipping cost or payment step is a common exit point here.');
  } else if (worstStep?.to === 'checkout_started') {
    reasons.push('Shoppers add to cart but hesitate before checkout — try a cart reminder or trust signals.');
  } else if (worstStep?.to === 'add_to_cart') {
    reasons.push('Product pages are not converting views to carts — review pricing, images, or stock.');
  }

  return { steps, worstStep, reasons };
}

function mkStep(from: string, to: string, enter: number, next: number): FunnelStep {
  const exit = Math.max(0, enter - next);
  const dropPct = enter > 0 ? Math.round((exit / enter) * 100) : 0;
  return { from, to, enter, exit, dropPct };
}
