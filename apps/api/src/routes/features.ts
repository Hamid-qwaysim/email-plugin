import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { prefixedId, now } from '../lib/ids.js';
import { decideCoupon, type CouponGuard } from '../lib/coupon.js';
import { intentBand } from '@arre/shared';
import { classifyAuto, evaluateRules, type RuleGroup, type SubjectSignals } from '../features/segments.js';
import { recommend, type ProductLite, type RecoStrategy } from '../features/recommendations.js';
import { analyzeFunnel } from '../features/friction.js';
import { diagnose, type StoreMetrics } from '../features/doctor.js';
import { evaluateTest, type Variant } from '../features/abtest.js';
import { scoreDeliverability } from '../features/deliverability.js';
import { renderHtml, renderText, type EmailDocument } from '../features/email-render.js';
import { validateFlow, type Flow } from '../features/automation.js';
import { getAiProvider, withGuardrails } from '../ai/provider.js';
import { generateReport } from '../features/report.js';

/**
 * Feature endpoints for the merchant dashboard, mounted under /v1/merchant.
 * Every handler verifies store ownership against the caller's org.
 */
export const featureRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
featureRoutes.use('*', requireAuth);

interface StoreRow {
  id: string;
  org_id: string;
  store_type: string;
  brand: string | null;
}

async function ownStore(c: { env: Env; get: (k: 'auth') => { orgId: string } | undefined }, id: string): Promise<StoreRow | null> {
  const auth = c.get('auth')!;
  return c.env.DB.prepare(`SELECT id, org_id, store_type, brand FROM stores WHERE id=?1 AND org_id=?2`)
    .bind(id, auth.orgId)
    .first<StoreRow>();
}

async function eventCount(env: Env, storeId: string, type: string): Promise<number> {
  const r = await env.DB.prepare(`SELECT COUNT(*) n FROM events WHERE store_id=?1 AND type=?2`).bind(storeId, type).first<{ n: number }>();
  return r?.n ?? 0;
}

const DEFAULT_GUARD: CouponGuard = { maxDiscountPct: 15, maxDiscountCents: 5000, minCartCents: 2000, abuseScore: 0 };

/* ----------------------------- #1 Visitors ----------------------------- */
featureRoutes.get('/stores/:id/visitors', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(
    `SELECT id, anon_id, intent_score, intent_reason, device, country, last_seen_at
       FROM visitors WHERE store_id=?1 ORDER BY intent_score DESC LIMIT 200`,
  ).bind(store.id).all();
  const visitors = (rows.results ?? []).map((v) => ({ ...v, band: intentBand((v as { intent_score: number }).intent_score) }));
  return ok(c, { visitors });
});

/* --------------------- #3/#15 Coupon generate + guard ------------------- */
featureRoutes.post('/stores/:id/coupons/generate', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ cartCents?: number; intentScore?: number; email?: string; isReturning?: boolean; guard?: Partial<CouponGuard> }>().catch(() => null);
  if (!body) return errors.badRequest(c, 'Invalid body.');

  const guard: CouponGuard = { ...DEFAULT_GUARD, ...(body.guard ?? {}) };
  const decision = decideCoupon({
    intentBand: intentBand(body.intentScore ?? 0),
    cartCents: body.cartCents ?? 0,
    guard,
    isReturningAbandoner: !!body.isReturning,
  });

  let code: string | null = null;
  if (decision.discountPct > 0 || decision.freeShipping) {
    code = `ARRE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await c.env.DB.prepare(
      `INSERT INTO coupons (id, store_id, code, type, amount, customer_email, usage_limit, one_time, source, ai_rationale, expires_at, status, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,1,1,'ai',?7,?8,'active',?9)`,
    ).bind(
      prefixedId('cpn'), store.id, code,
      decision.freeShipping ? 'free_shipping' : 'percent',
      decision.discountPct, body.email ?? null, decision.rationale,
      now() + 7 * 86400000, now(),
    ).run();
  }
  return ok(c, { decision, code });
});

/* ------------------------------ #7 Segments ----------------------------- */
featureRoutes.post('/stores/:id/segments', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ name?: string; rules?: RuleGroup }>().catch(() => null);
  if (!body?.name) return errors.badRequest(c, 'name is required.');
  const id = prefixedId('seg');
  await c.env.DB.prepare(
    `INSERT INTO segments (id, store_id, name, kind, rules, member_count, created_at, updated_at)
     VALUES (?1,?2,?3,'custom',?4,0,?5,?5)`,
  ).bind(id, store.id, body.name, JSON.stringify(body.rules ?? {}), now()).run();
  return ok(c, { id }, 201);
});

featureRoutes.post('/stores/:id/segments/preview', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ rules?: RuleGroup; sample?: SubjectSignals }>().catch(() => null);
  if (!body?.rules || !body.sample) return errors.badRequest(c, 'rules and sample required.');
  return ok(c, { matches: evaluateRules(body.rules, body.sample), autoSegments: classifyAuto(body.sample) });
});

/* -------------------------- #8 Recommendations -------------------------- */
featureRoutes.get('/stores/:id/recommendations', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const strategy = (c.req.query('strategy') ?? 'bestsellers') as RecoStrategy;
  const anchorId = c.req.query('anchorId') ? Number(c.req.query('anchorId')) : undefined;

  const rows = await c.env.DB.prepare(
    `SELECT woo_id, name, price_cents, categories, stock_status FROM products WHERE store_id=?1 LIMIT 500`,
  ).bind(store.id).all<{ woo_id: number; name: string; price_cents: number; categories: string | null; stock_status: string }>();

  const products: ProductLite[] = (rows.results ?? []).map((p) => ({
    wooId: p.woo_id, name: p.name, priceCents: p.price_cents ?? 0,
    categories: p.categories ? (JSON.parse(p.categories) as string[]) : [],
    stockStatus: p.stock_status ?? 'instock',
  }));
  const anchor = anchorId ? products.find((p) => p.wooId === anchorId) : undefined;
  return ok(c, { products: recommend(strategy, products, { anchor }) });
});

/* --------------------------- #6 Automations ----------------------------- */
featureRoutes.get('/stores/:id/automations', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(`SELECT id, name, mode, status, trigger FROM automations WHERE store_id=?1`).bind(store.id).all();
  return ok(c, { automations: rows.results ?? [] });
});

featureRoutes.post('/stores/:id/automations', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ name?: string; mode?: string; trigger?: string; flow?: Flow }>().catch(() => null);
  if (!body?.name || !body.trigger) return errors.badRequest(c, 'name and trigger required.');
  if (body.flow) {
    const errs = validateFlow(body.flow);
    if (errs.length) return errors.badRequest(c, 'Invalid flow.', errs);
  }
  const id = prefixedId('auto');
  await c.env.DB.prepare(
    `INSERT INTO automations (id, store_id, name, mode, status, trigger, definition, created_at, updated_at)
     VALUES (?1,?2,?3,?4,'draft',?5,?6,?7,?7)`,
  ).bind(id, store.id, body.name, body.mode === 'manual' ? 'manual' : 'autopilot', body.trigger, JSON.stringify(body.flow ?? {}), now()).run();
  return ok(c, { id }, 201);
});

featureRoutes.patch('/stores/:id/automations/:autoId/status', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ status?: string }>().catch(() => null);
  const status = body?.status === 'active' ? 'active' : body?.status === 'paused' ? 'paused' : 'draft';
  await c.env.DB.prepare(`UPDATE automations SET status=?3, updated_at=?4 WHERE id=?1 AND store_id=?2`)
    .bind(c.req.param('autoId'), store.id, status, now()).run();
  return ok(c, { status });
});

/* ---------------------- #13 Campaigns (AI + persist) -------------------- */
featureRoutes.post('/stores/:id/campaigns/generate', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ goal?: string }>().catch(() => null);
  if (!body?.goal) return errors.badRequest(c, 'goal is required.');
  const ai = getAiProvider(c.env);
  const result = await ai.complete(withGuardrails(`Create a WooCommerce campaign for: "${body.goal}". Return JSON {name, targetSegment, couponStrategy, emailSequence:[{subject,preview,body}], pushCopy, recommendedTiming, successPrediction}.`), { json: true });
  let def: unknown;
  try { def = JSON.parse(result.text); } catch { def = { raw: result.text }; }
  const id = prefixedId('cmp');
  await c.env.DB.prepare(
    `INSERT INTO campaigns (id, store_id, name, status, goal_prompt, definition, created_at, updated_at)
     VALUES (?1,?2,?3,'draft',?4,?5,?6,?6)`,
  ).bind(id, store.id, (def as { name?: string }).name ?? 'AI Campaign', body.goal, JSON.stringify(def), now()).run();
  return ok(c, { id, campaign: def, provider: result.provider }, 201);
});

featureRoutes.get('/stores/:id/campaigns', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(`SELECT id, name, status, goal_prompt, scheduled_at, created_at FROM campaigns WHERE store_id=?1 ORDER BY created_at DESC LIMIT 100`).bind(store.id).all();
  return ok(c, { campaigns: rows.results ?? [] });
});

featureRoutes.post('/stores/:id/campaigns/:cid/launch', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  await c.env.DB.prepare(`UPDATE campaigns SET status='running', updated_at=?3 WHERE id=?1 AND store_id=?2`).bind(c.req.param('cid'), store.id, now()).run();
  return ok(c, { launched: true });
});

/* ----------------------------- #11 Store Doctor ------------------------- */
featureRoutes.get('/stores/:id/store-doctor', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const [checkoutStarted, purchases, abandoned, recovered] = await Promise.all([
    eventCount(c.env, store.id, 'checkout_started'),
    eventCount(c.env, store.id, 'purchase_completed'),
    c.env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(value_cents),0) v FROM abandoned_carts WHERE store_id=?1 AND recovered_at IS NULL`).bind(store.id).first<{ n: number; v: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM abandoned_carts WHERE store_id=?1 AND recovered_at IS NOT NULL`).bind(store.id).first<{ n: number }>(),
  ]);
  const rate = checkoutStarted > 0 ? ((checkoutStarted - purchases) / checkoutStarted) * 100 : 0;
  const metrics: StoreMetrics = {
    abandonedCarts: abandoned?.n ?? 0,
    abandonedValueCents: abandoned?.v ?? 0,
    recoveredCarts: recovered?.n ?? 0,
    checkoutAbandonRatePct: rate,
    prevCheckoutAbandonRatePct: rate, // baseline; refined as history accrues
    mobileConversionPct: 0,
    desktopConversionPct: 0,
    emailEngagementPct: 0,
    inactiveSegmentSize: 0,
  };
  return ok(c, { insights: diagnose(metrics), metrics });
});

/* ----------------------------- #19 Friction ----------------------------- */
featureRoutes.get('/stores/:id/friction', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const [pv, atc, cs, ce, cf, pur] = await Promise.all([
    eventCount(c.env, store.id, 'product_view'),
    eventCount(c.env, store.id, 'add_to_cart'),
    eventCount(c.env, store.id, 'checkout_started'),
    eventCount(c.env, store.id, 'checkout_error'),
    eventCount(c.env, store.id, 'coupon_failed'),
    eventCount(c.env, store.id, 'purchase_completed'),
  ]);
  return ok(c, analyzeFunnel({ productViews: pv, addToCart: atc, checkoutStarted: cs, checkoutErrors: ce, couponFailed: cf, purchases: pur }));
});

/* ------------------------------ #14 A/B Test ---------------------------- */
featureRoutes.post('/stores/:id/ab-tests/evaluate', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ variants?: Variant[] }>().catch(() => null);
  if (!body?.variants) return errors.badRequest(c, 'variants required.');
  return ok(c, evaluateTest(body.variants));
});

/* --------------------------- #25 Deliverability ------------------------- */
featureRoutes.get('/stores/:id/deliverability', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const [sent, bounces, complaints, unsub, suppressed] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) n FROM emails WHERE store_id=?1 AND status='sent'`).bind(store.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM email_events WHERE store_id=?1 AND type='bounce'`).bind(store.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM email_events WHERE store_id=?1 AND type='complaint'`).bind(store.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM email_events WHERE store_id=?1 AND type='unsubscribe'`).bind(store.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM suppression_list WHERE store_id=?1`).bind(store.id).first<{ n: number }>(),
  ]);
  const brand = store.brand ? (JSON.parse(store.brand) as { spf?: boolean; dkim?: boolean; dmarc?: boolean }) : {};
  return ok(c, scoreDeliverability({
    spf: !!brand.spf, dkim: !!brand.dkim, dmarc: !!brand.dmarc,
    sentLast30d: sent?.n ?? 0, bounces: bounces?.n ?? 0, complaints: complaints?.n ?? 0,
    unsubscribes: unsub?.n ?? 0, suppressedCount: suppressed?.n ?? 0,
  }));
});

/* ------------------------ #16 Customer Timeline ------------------------- */
featureRoutes.get('/stores/:id/customers/:cid/timeline', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const cid = c.req.param('cid');
  const customer = await c.env.DB.prepare(`SELECT * FROM customers WHERE id=?1 AND store_id=?2`).bind(cid, store.id).first();
  if (!customer) return errors.notFound(c, 'Customer not found.');
  const [orders, emails] = await Promise.all([
    c.env.DB.prepare(`SELECT id, status, total_cents, created_at FROM orders WHERE store_id=?1 AND customer_id=?2 ORDER BY created_at DESC LIMIT 50`).bind(store.id, cid).all(),
    c.env.DB.prepare(`SELECT id, subject, status, sent_at FROM emails WHERE store_id=?1 AND customer_id=?2 ORDER BY queued_at DESC LIMIT 50`).bind(store.id, cid).all(),
  ]);
  return ok(c, { customer, orders: orders.results ?? [], emails: emails.results ?? [] });
});

/* ----------------------- #20 Email Designer preview --------------------- */
featureRoutes.post('/stores/:id/email-preview', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ document?: EmailDocument }>().catch(() => null);
  if (!body?.document) return errors.badRequest(c, 'document required.');
  return ok(c, { html: renderHtml(body.document), text: renderText(body.document) });
});

featureRoutes.post('/stores/:id/email-templates', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ name?: string; subject?: string; document?: EmailDocument }>().catch(() => null);
  if (!body?.name) return errors.badRequest(c, 'name required.');
  const id = prefixedId('tpl');
  await c.env.DB.prepare(
    `INSERT INTO email_templates (id, store_id, name, subject, blocks, is_system, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,0,?6,?6)`,
  ).bind(id, store.id, body.name, body.subject ?? '', JSON.stringify(body.document ?? { blocks: [] }), now()).run();
  return ok(c, { id }, 201);
});

/* ----------------------------- #23 Reports ------------------------------ */
featureRoutes.post('/stores/:id/reports/generate', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const report = await generateReport(c.env, store.id, store.org_id);
  return ok(c, { report }, 201);
});

featureRoutes.get('/stores/:id/reports', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(`SELECT id, kind, period_label, status, r2_key, created_at FROM reports WHERE store_id=?1 ORDER BY created_at DESC LIMIT 50`).bind(store.id).all();
  return ok(c, { reports: rows.results ?? [] });
});

/* ------------------- #12 Revenue Attribution breakdown ------------------ */
featureRoutes.get('/stores/:id/attribution', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const [recovered, tracked, byCoupon] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) v FROM orders WHERE store_id=?1 AND recovered=1`).bind(store.id).first<{ n: number; v: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE store_id=?1`).bind(store.id).first<{ v: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM coupons WHERE store_id=?1 AND used_count>0`).bind(store.id).first<{ n: number }>(),
  ]);
  return ok(c, {
    recoveredRevenueCents: recovered?.v ?? 0,
    recoveredOrders: recovered?.n ?? 0,
    trackedRevenueCents: tracked?.v ?? 0,
    couponsRedeemed: byCoupon?.n ?? 0,
  });
});

/* ----------------- #5 Channels (web push + WhatsApp-ready) -------------- */
featureRoutes.patch('/stores/:id/channels', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ webPush?: boolean; whatsapp?: { enabled?: boolean; provider?: string } }>().catch(() => null);
  const brand = store.brand ? (JSON.parse(store.brand) as Record<string, unknown>) : {};
  brand.channels = { webPush: !!body?.webPush, whatsapp: body?.whatsapp ?? { enabled: false } };
  await c.env.DB.prepare(`UPDATE stores SET brand=?2, updated_at=?3 WHERE id=?1`).bind(store.id, JSON.stringify(brand), now()).run();
  return ok(c, { channels: brand.channels });
});

featureRoutes.post('/stores/:id/web-push/subscribe', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ endpoint?: string }>().catch(() => null);
  if (!body?.endpoint) return errors.badRequest(c, 'endpoint required.');
  await c.env.DB.prepare(
    `INSERT INTO messages (id, store_id, channel, to_address, status, created_at) VALUES (?1,?2,'web_push',?3,'subscribed',?4)`,
  ).bind(prefixedId('msg'), store.id, body.endpoint, now()).run();
  return ok(c, { subscribed: true });
});

/* --------------------------- #17 Lead Forms ----------------------------- */
featureRoutes.post('/stores/:id/forms/submit', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ email?: string; name?: string; consent?: boolean }>().catch(() => null);
  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return errors.badRequest(c, 'Valid email required.');
  const id = prefixedId('cus');
  await c.env.DB.prepare(
    `INSERT INTO customers (id, store_id, email, name, consent_marketing, consent_recorded_at, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?6,?6)
     ON CONFLICT(store_id, woo_id) DO NOTHING`,
  ).bind(id, store.id, body.email, body.name ?? null, body.consent ? 1 : 0, now()).run();
  await c.env.DB.prepare(
    `INSERT INTO consent_records (id, store_id, email, channel, granted, source, created_at) VALUES (?1,?2,?3,'email',?4,'lead_form',?5)`,
  ).bind(prefixedId('con'), store.id, body.email, body.consent ? 1 : 0, now()).run();
  return ok(c, { captured: true }, 201);
});

/* ------------------- #24 Apply store-type templates --------------------- */
featureRoutes.post('/stores/:id/apply-template', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  // Seed a starter recovery automation + a couple of auto segments as a preset.
  const id = prefixedId('auto');
  await c.env.DB.prepare(
    `INSERT INTO automations (id, store_id, name, mode, status, trigger, definition, created_at, updated_at)
     VALUES (?1,?2,'Abandoned cart recovery','autopilot','active','checkout_abandoned','{}',?3,?3)`,
  ).bind(id, store.id, now()).run();
  return ok(c, { applied: true, storeType: store.store_type });
});
