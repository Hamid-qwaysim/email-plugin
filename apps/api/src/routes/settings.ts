import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { prefixedId, now } from '../lib/ids.js';

/**
 * Store settings: brand/autopilot, on-site popups, and data privacy
 * (export/erase). Mounted under /v1/merchant. Ownership-checked.
 */
export const settingsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
settingsRoutes.use('*', requireAuth);

async function ownStore(c: { env: Env; get: (k: 'auth') => { orgId: string } | undefined }, id: string) {
  const auth = c.get('auth')!;
  return c.env.DB.prepare(`SELECT id, org_id, brand, store_type FROM stores WHERE id=?1 AND org_id=?2`)
    .bind(id, auth.orgId)
    .first<{ id: string; org_id: string; brand: string | null; store_type: string }>();
}

/* --------------------------- Brand + Autopilot -------------------------- */
settingsRoutes.get('/stores/:id/settings', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  return ok(c, { brand: store.brand ? JSON.parse(store.brand) : {} });
});

settingsRoutes.patch('/stores/:id/settings', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return errors.badRequest(c, 'Invalid body.');

  const brand = store.brand ? (JSON.parse(store.brand) as Record<string, unknown>) : {};
  // Shallow-merge known sections only.
  for (const key of ['logoUrl', 'primaryColor', 'tone', 'language', 'spf', 'dkim', 'dmarc']) {
    if (key in body) brand[key] = body[key];
  }
  if (body.autopilot && typeof body.autopilot === 'object') {
    brand.autopilot = { ...(brand.autopilot as object ?? {}), ...(body.autopilot as object) };
  }
  if (body.channels && typeof body.channels === 'object') {
    brand.channels = { ...(brand.channels as object ?? {}), ...(body.channels as object) };
  }
  await c.env.DB.prepare(`UPDATE stores SET brand=?2, updated_at=?3 WHERE id=?1`)
    .bind(store.id, JSON.stringify(brand), now())
    .run();
  return ok(c, { brand });
});

/* ------------------------------- Popups -------------------------------- */
settingsRoutes.get('/stores/:id/popups', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(
    `SELECT id, name, kind, status, content, design, frequency_cap FROM popups WHERE store_id=?1 ORDER BY created_at DESC`,
  ).bind(store.id).all();
  return ok(c, { popups: rows.results ?? [] });
});

settingsRoutes.post('/stores/:id/popups', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{
    name?: string; kind?: string; content?: unknown; design?: unknown; frequency?: unknown; status?: string; targeting?: unknown;
  }>().catch(() => null);
  if (!body?.name) return errors.badRequest(c, 'name is required.');
  const id = prefixedId('pop');
  await c.env.DB.prepare(
    `INSERT INTO popups (id, store_id, name, kind, status, targeting, design, content, frequency_cap, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)`,
  ).bind(
    id, store.id, body.name, body.kind ?? 'popup', body.status === 'active' ? 'active' : 'draft',
    JSON.stringify(body.targeting ?? {}), JSON.stringify(body.design ?? {}),
    JSON.stringify(body.content ?? {}), JSON.stringify(body.frequency ?? { perSession: 1 }), now(),
  ).run();
  return ok(c, { id }, 201);
});

settingsRoutes.patch('/stores/:id/popups/:popId/status', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ status?: string }>().catch(() => null);
  const status = body?.status === 'active' ? 'active' : 'draft';
  await c.env.DB.prepare(`UPDATE popups SET status=?3, updated_at=?4 WHERE id=?1 AND store_id=?2`)
    .bind(c.req.param('popId'), store.id, status, now()).run();
  return ok(c, { status });
});

/* ----------------------------- Data privacy ---------------------------- */
settingsRoutes.get('/stores/:id/data/export', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const [customers, consent, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT email, name, consent_marketing, orders_count, ltv_cents FROM customers WHERE store_id=?1 LIMIT 5000`).bind(store.id).all(),
    c.env.DB.prepare(`SELECT email, channel, granted, created_at FROM consent_records WHERE store_id=?1 LIMIT 5000`).bind(store.id).all(),
    c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM events WHERE store_id=?1) events, (SELECT COUNT(*) FROM visitors WHERE store_id=?1) visitors`).bind(store.id).first(),
  ]);
  return ok(c, { exportedAt: now(), counts, customers: customers.results ?? [], consent: consent.results ?? [] });
});

settingsRoutes.post('/stores/:id/data/erase', async (c) => {
  const store = await ownStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ confirm?: string }>().catch(() => null);
  if (body?.confirm !== 'ERASE') return errors.badRequest(c, 'Confirmation token required ("ERASE").');
  // Scoped destructive erase of tracking/customer data for this store only.
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM events WHERE store_id=?1`).bind(store.id),
    c.env.DB.prepare(`DELETE FROM visitors WHERE store_id=?1`).bind(store.id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE store_id=?1`).bind(store.id),
    c.env.DB.prepare(`DELETE FROM customers WHERE store_id=?1`).bind(store.id),
    c.env.DB.prepare(`DELETE FROM consent_records WHERE store_id=?1`).bind(store.id),
  ]);
  return ok(c, { erased: true });
});
