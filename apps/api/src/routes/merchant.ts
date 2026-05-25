import { Hono } from 'hono';
import { isStoreType, type StoreType } from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { prefixedId, now } from '../lib/ids.js';
import { deriveStoreSecret, randomToken } from '../lib/crypto.js';

/** Authenticated merchant dashboard API (org-scoped). */
export const merchantRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

merchantRoutes.use('*', requireAuth);

/** Ensure a store belongs to the caller's org before returning it. */
async function ownedStore(c: { env: Env; get: (k: 'auth') => { orgId: string } | undefined }, storeId: string) {
  const auth = c.get('auth')!;
  return c.env.DB.prepare(`SELECT * FROM stores WHERE id = ?1 AND org_id = ?2`)
    .bind(storeId, auth.orgId)
    .first<Record<string, unknown>>();
}

/** GET /merchant/stores — stores in the caller's org. */
merchantRoutes.get('/stores', async (c) => {
  const auth = c.get('auth')!;
  const rows = await c.env.DB.prepare(
    `SELECT id, name, domain, store_type, connection_health, plugin_version, woo_version,
            hpos_enabled, last_sync_at, last_seen_at FROM stores WHERE org_id = ?1`,
  )
    .bind(auth.orgId)
    .all();
  return ok(c, { stores: rows.results ?? [] });
});

/**
 * POST /merchant/stores — register a store + mint its signing secret.
 * Returns the licenseKey + storeId + signingSecret ONCE for the plugin wizard.
 */
merchantRoutes.post('/stores', async (c) => {
  const auth = c.get('auth')!;
  const body = await c.req.json<{ name?: string; domain?: string; storeType?: string }>().catch(() => null);
  if (!body?.domain) return errors.badRequest(c, 'domain is required.');
  const storeType: StoreType = isStoreType(body.storeType ?? '') ? (body.storeType as StoreType) : 'general';

  const license = await c.env.DB.prepare(
    `SELECT id, license_key FROM licenses WHERE org_id = ?1 ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(auth.orgId)
    .first<{ id: string; license_key: string }>();
  if (!license) return errors.badRequest(c, 'No license found for this organization.');

  const ts = now();
  const storeId = prefixedId('str');
  const seed = randomToken(16);
  const signingSecret = await deriveStoreSecret(seed, c.env.LICENSE_SIGNING_PEPPER);

  await c.env.DB.prepare(
    `INSERT INTO stores (id, org_id, license_id, name, domain, store_type, signing_secret, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)`,
  )
    .bind(storeId, auth.orgId, license.id, body.name ?? body.domain, body.domain, storeType, signingSecret, ts)
    .run();

  return ok(
    c,
    {
      storeId,
      licenseKey: license.license_key,
      signingSecret, // shown once; plugin stores it locally
      storeType,
    },
    201,
  );
});

/** GET /merchant/stores/:id/overview — the home dashboard hero metrics. */
merchantRoutes.get('/stores/:id/overview', async (c) => {
  const store = await ownedStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const storeId = store.id as string;

  const [recovered, abandoned, automations, attributed] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) v FROM orders WHERE store_id=?1 AND recovered=1`).bind(storeId).first<{ n: number; v: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(value_cents),0) v FROM abandoned_carts WHERE store_id=?1 AND recovered_at IS NULL`).bind(storeId).first<{ n: number; v: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM automations WHERE store_id=?1 AND status='active'`).bind(storeId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE store_id=?1`).bind(storeId).first<{ v: number }>(),
  ]);

  return ok(c, {
    recoveredRevenueCents: recovered?.v ?? 0,
    recoveredCarts: recovered?.n ?? 0,
    abandonedRevenueCents: abandoned?.v ?? 0,
    abandonedCarts: abandoned?.n ?? 0,
    activeAutomations: automations?.n ?? 0,
    trackedRevenueCents: attributed?.v ?? 0,
  });
});

/** GET /merchant/stores/:id/segments */
merchantRoutes.get('/stores/:id/segments', async (c) => {
  const store = await ownedStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(
    `SELECT id, name, kind, member_count, is_excluded_default FROM segments WHERE store_id=?1`,
  )
    .bind(store.id as string)
    .all();
  return ok(c, { segments: rows.results ?? [] });
});

/** GET /merchant/stores/:id/coupons */
merchantRoutes.get('/stores/:id/coupons', async (c) => {
  const store = await ownedStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const rows = await c.env.DB.prepare(
    `SELECT id, code, type, amount, status, source, used_count, expires_at, ai_rationale
       FROM coupons WHERE store_id=?1 ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(store.id as string)
    .all();
  return ok(c, { coupons: rows.results ?? [] });
});

/** PATCH /merchant/stores/:id/toggles — local feature toggles. */
merchantRoutes.patch('/stores/:id/toggles', async (c) => {
  const store = await ownedStore(c, c.req.param('id'));
  if (!store) return errors.notFound(c, 'Store not found.');
  const body = await c.req.json<{ toggles?: Record<string, boolean> }>().catch(() => null);
  if (!body?.toggles) return errors.badRequest(c, 'toggles map required.');
  await c.env.DB.prepare(`UPDATE stores SET feature_toggles=?2, updated_at=?3 WHERE id=?1`)
    .bind(store.id as string, JSON.stringify(body.toggles), now())
    .run();
  return ok(c, { toggles: body.toggles });
});

/** GET /merchant/license — the org's current license/entitlements view. */
merchantRoutes.get('/license', async (c) => {
  const auth = c.get('auth')!;
  const lic = await c.env.DB.prepare(
    `SELECT id, license_key, status, plan_id, period_ends_at, trial_ends_at, is_test, max_stores
       FROM licenses WHERE org_id=?1 ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(auth.orgId)
    .first();
  if (!lic) return errors.notFound(c, 'No license.');
  return ok(c, { license: lic });
});
