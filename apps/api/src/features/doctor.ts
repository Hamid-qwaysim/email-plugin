/**
 * AI Store Doctor (#11). Turns store metrics into prioritized, quantified
 * insights with a recommended action and estimated revenue impact. Pure; the
 * AI layer can rephrase the body, but the diagnosis + math live here.
 */
export interface StoreMetrics {
  abandonedCarts: number;
  abandonedValueCents: number;
  recoveredCarts: number;
  checkoutAbandonRatePct: number; // 0..100
  prevCheckoutAbandonRatePct: number;
  mobileConversionPct: number;
  desktopConversionPct: number;
  emailEngagementPct: number;
  inactiveSegmentSize: number;
}

export interface Insight {
  key: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  recommendedAction: string;
  estImpactCents: number;
  priority: number; // higher = more important
}

export function diagnose(m: StoreMetrics): Insight[] {
  const insights: Insight[] = [];

  const abandonDelta = m.checkoutAbandonRatePct - m.prevCheckoutAbandonRatePct;
  if (abandonDelta >= 5) {
    insights.push({
      key: 'checkout_abandon_up',
      severity: abandonDelta >= 15 ? 'critical' : 'warn',
      title: `Checkout abandonment up ${Math.round(abandonDelta)}% this period`,
      body: `Most exits happen after the checkout step. A rising rate usually points to shipping cost or payment friction.`,
      recommendedAction: 'Test free shipping above a threshold for 48 hours and review payment options.',
      estImpactCents: Math.round(m.abandonedValueCents * 0.15),
      priority: 90 + Math.min(10, abandonDelta),
    });
  }

  if (m.abandonedValueCents > 0 && m.recoveredCarts === 0) {
    insights.push({
      key: 'recovery_off',
      severity: 'warn',
      title: 'You are leaving recoverable revenue on the table',
      body: `There is ${(m.abandonedValueCents / 100).toFixed(0)} in abandoned cart value with no recoveries yet.`,
      recommendedAction: 'Enable the abandoned cart recovery flow.',
      estImpactCents: Math.round(m.abandonedValueCents * 0.1),
      priority: 80,
    });
  }

  if (m.desktopConversionPct - m.mobileConversionPct >= 1.5) {
    insights.push({
      key: 'mobile_gap',
      severity: 'warn',
      title: 'Mobile converts worse than desktop',
      body: `Mobile is ${(m.desktopConversionPct - m.mobileConversionPct).toFixed(1)}pts behind desktop.`,
      recommendedAction: 'Audit mobile checkout: form length, button size, and load speed.',
      estImpactCents: 0,
      priority: 60,
    });
  }

  if (m.emailEngagementPct < 10) {
    insights.push({
      key: 'low_email_engagement',
      severity: 'info',
      title: 'Email engagement is low',
      body: `Open/click engagement is ${m.emailEngagementPct.toFixed(0)}%. Subject lines and timing may need work.`,
      recommendedAction: 'Turn on subject-line A/B testing and re-check sending domain health.',
      estImpactCents: 0,
      priority: 40,
    });
  }

  if (m.inactiveSegmentSize >= 50) {
    insights.push({
      key: 'inactive_segment',
      severity: 'info',
      title: `${m.inactiveSegmentSize} customers have gone inactive`,
      body: 'A win-back campaign can re-engage lapsed customers cost-effectively.',
      recommendedAction: 'Launch a win-back campaign for the inactive segment.',
      estImpactCents: 0,
      priority: 50,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
