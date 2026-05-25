import { describe, it, expect } from 'vitest';
import { classifyAuto, evaluateRules, type SubjectSignals } from '../src/features/segments.js';
import { recommend, type ProductLite } from '../src/features/recommendations.js';
import { analyzeFunnel } from '../src/features/friction.js';
import { diagnose } from '../src/features/doctor.js';
import { evaluateTest } from '../src/features/abtest.js';
import { scoreDeliverability } from '../src/features/deliverability.js';
import { renderHtml, renderText, type EmailDocument } from '../src/features/email-render.js';
import { stepFlow, validateFlow, type Flow } from '../src/features/automation.js';
import { selectOnsite, type OnsiteElement } from '../src/features/onsite.js';
import { detectBrowseAbandon } from '../src/features/browse.js';

const baseSignals: SubjectSignals = {
  intentScore: 90, sessions: 5, ordersCount: 3, aovCents: 20000, ltvCents: 60000,
  hasAbandonedCart: true, hasAbandonedCheckout: false, daysSinceLastSeen: 2,
  emailEngaged: true, couponUses: 0, webPushSubscribed: true, whatsappReady: false,
};

describe('segments', () => {
  it('classifies a VIP high-intent returning buyer', () => {
    const segs = classifyAuto(baseSignals);
    expect(segs).toContain('vip');
    expect(segs).toContain('high_intent');
    expect(segs).toContain('repeat_buyer');
    expect(segs).toContain('cart_abandoner');
  });
  it('flags coupon abuse risk and discount hunters', () => {
    const segs = classifyAuto({ ...baseSignals, couponUses: 7 });
    expect(segs).toContain('coupon_abuse_risk');
    expect(segs).toContain('discount_hunter');
  });
  it('evaluates custom rule trees', () => {
    const rule = { all: [{ field: 'ordersCount', op: 'gte', value: 2 } as const, { any: [{ field: 'aovCents', op: 'gte', value: 15000 } as const] }] };
    expect(evaluateRules(rule, baseSignals)).toBe(true);
    expect(evaluateRules(rule, { ...baseSignals, ordersCount: 1 })).toBe(false);
  });
});

describe('recommendations', () => {
  const products: ProductLite[] = [
    { wooId: 1, name: 'A', priceCents: 1000, categories: ['x'], stockStatus: 'instock', salesCount: 5 },
    { wooId: 2, name: 'B', priceCents: 3000, categories: ['x'], stockStatus: 'instock', salesCount: 50 },
    { wooId: 3, name: 'C', priceCents: 500, categories: ['y'], stockStatus: 'outofstock', salesCount: 99 },
  ];
  it('bestsellers excludes out-of-stock and ranks by sales', () => {
    const r = recommend('bestsellers', products);
    expect(r[0]!.wooId).toBe(2);
    expect(r.find((p) => p.wooId === 3)).toBeUndefined();
  });
  it('cheaper_alternative respects anchor price and category', () => {
    const r = recommend('cheaper_alternative', products, { anchor: products[1] });
    expect(r.every((p) => p.priceCents < 3000)).toBe(true);
    expect(r.find((p) => p.wooId === 2)).toBeUndefined();
  });
});

describe('friction', () => {
  it('finds the worst drop-off and reasons', () => {
    const r = analyzeFunnel({ productViews: 1000, addToCart: 300, checkoutStarted: 200, checkoutErrors: 10, couponFailed: 5, purchases: 40 });
    expect(r.worstStep?.to).toBe('purchase');
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});

describe('store doctor', () => {
  it('prioritizes a checkout abandonment spike', () => {
    const insights = diagnose({
      abandonedCarts: 50, abandonedValueCents: 500000, recoveredCarts: 0,
      checkoutAbandonRatePct: 70, prevCheckoutAbandonRatePct: 50,
      mobileConversionPct: 1, desktopConversionPct: 3, emailEngagementPct: 5, inactiveSegmentSize: 100,
    });
    expect(insights[0]!.key).toBe('checkout_abandon_up');
    expect(insights[0]!.estImpactCents).toBeGreaterThan(0);
  });
});

describe('a/b testing', () => {
  it('needs minimum sample', () => {
    expect(evaluateTest([{ id: 'a', sent: 10, conversions: 5 }, { id: 'b', sent: 10, conversions: 1 }]).decided).toBe(false);
  });
  it('declares a clear winner at scale', () => {
    const r = evaluateTest([{ id: 'a', sent: 5000, conversions: 500 }, { id: 'b', sent: 5000, conversions: 250 }]);
    expect(r.decided).toBe(true);
    expect(r.winnerId).toBe('a');
  });
});

describe('deliverability', () => {
  it('penalizes missing auth and high bounce', () => {
    const perfect = scoreDeliverability({ spf: true, dkim: true, dmarc: true, sentLast30d: 1000, bounces: 5, complaints: 0, unsubscribes: 2, suppressedCount: 3 });
    expect(perfect.grade).toBe('A');
    const bad = scoreDeliverability({ spf: false, dkim: false, dmarc: false, sentLast30d: 1000, bounces: 80, complaints: 10, unsubscribes: 5, suppressedCount: 9 });
    expect(bad.score).toBeLessThan(perfect.score);
  });
});

describe('email render', () => {
  const doc: EmailDocument = {
    brandColor: '#ff0000',
    blocks: [
      { type: 'heading', text: 'Hi <there>' },
      { type: 'button', label: 'Buy', href: 'javascript:alert(1)' },
      { type: 'coupon', code: 'SAVE10' },
      { type: 'footer', storeName: 'Shop', unsubscribeUrl: 'https://x.com/u' },
    ],
  };
  it('escapes html and neutralizes unsafe urls', () => {
    const html = renderHtml(doc);
    expect(html).toContain('Hi &lt;there&gt;');
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).toContain('SAVE10');
  });
  it('produces a plain-text fallback', () => {
    expect(renderText(doc)).toContain('Coupon: SAVE10');
  });
});

describe('automation engine', () => {
  const flow: Flow = {
    startId: 't',
    nodes: {
      t: { id: 't', kind: 'trigger', next: ['c'] },
      c: { id: 'c', kind: 'condition', rules: { all: [{ field: 'intentScore', op: 'gte', value: 80 }] }, next: ['a_hi', 'a_lo'] },
      a_hi: { id: 'a_hi', kind: 'action', action: { type: 'send_web_push' }, next: ['d'] },
      a_lo: { id: 'a_lo', kind: 'action', action: { type: 'generate_coupon' }, next: ['stop'] },
      d: { id: 'd', kind: 'delay', delayMinutes: 60, next: ['stop'] },
      stop: { id: 'stop', kind: 'action', action: { type: 'stop' } },
    },
  };
  it('routes high intent down the true branch and stops at a delay', () => {
    const r = stepFlow(flow, 't', baseSignals);
    expect(r.actions[0]!.type).toBe('send_web_push');
    expect(r.waitMinutes).toBe(60);
    expect(r.nextNodeId).toBe('stop');
  });
  it('routes low intent to coupon then stop', () => {
    const r = stepFlow(flow, 't', { ...baseSignals, intentScore: 10 });
    expect(r.actions.map((a) => a.type)).toContain('generate_coupon');
    expect(r.done).toBe(true);
  });
  it('validates dangling edges', () => {
    expect(validateFlow({ startId: 'x', nodes: {} }).length).toBeGreaterThan(0);
  });
});

describe('onsite targeting + frequency caps', () => {
  const els: OnsiteElement[] = [
    { id: 'exit', kind: 'exit_intent', priority: 10, frequency: { perSession: 1 } },
    { id: 'bar', kind: 'top_bar', priority: 5, segments: ['vip'], frequency: { perDay: 2 } },
  ];
  it('selects exit-intent only on exit trigger and honors session cap', () => {
    const ctx = { segments: ['vip'], path: '/', trigger: 'exit_intent' as const };
    const empty = { sessionCount: {}, dayCount: {}, lastShownAt: {} };
    expect(selectOnsite(els, ctx, empty)?.id).toBe('exit');
    const capped = { sessionCount: { exit: 1 }, dayCount: {}, lastShownAt: {} };
    expect(selectOnsite(els, ctx, capped)?.id).toBe('bar');
  });
  it('respects segment targeting', () => {
    const ctx = { segments: ['new_visitor'], path: '/', trigger: 'page_load' as const };
    expect(selectOnsite(els, ctx, { sessionCount: {}, dayCount: {}, lastShownAt: {} })).toBeNull();
  });
});

describe('browse abandonment', () => {
  it('triggers on repeated views without cart', () => {
    const r = detectBrowseAbandon({ signals: [{ productId: 9, category: 'shoes', views: 4 }], addedToCart: false, hasEmail: true });
    expect(r.trigger).toBe(true);
    expect(r.topProductId).toBe(9);
    expect(r.channel).toBe('email');
  });
  it('does not trigger when added to cart', () => {
    expect(detectBrowseAbandon({ signals: [{ productId: 9, views: 9 }], addedToCart: true, hasEmail: true }).trigger).toBe(false);
  });
});
