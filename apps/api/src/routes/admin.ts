import { Hono } from 'hono';
import { FEATURES, isPlanId, type LicenseStatus, PLANS, type PlanId } from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { prefixedId, now } from '../lib/ids.js';
import { generateLicenseKey } from '../lib/crypto.js';
import { setKillSwitch, setLicenseStatus } from '../lib/license.js';

/** Super-admin / staff control plane. */
export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminRoutes.use('*', requireAuth, requireStaff);

async function audit(c: { env: Env }, adminId: string, action: string, target: string, reason?: string) {
  await c.env.DB.prepare(
    `INSERT INTO admin_actions (id, admin_id, action, target, reason, created_at) VALUES (?1,?2,?3,?4,?5,?6)`,
  )
    .bind(prefixedId('adm'), adminId, action, target, reason ?? null, now())
    .run();
}

/** GET /admin/overview — platform KPIs. */
adminRoutes.get('/overview', async (c) => {
  const [subs, stores, emails, lic] = await Promise.all([
    c.env.DB.prepare(`SELECT status, COUNT(*) n FROM subscriptions GROUP BY status`).all(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM stores`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM emails WHERE status='sent'`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT status, COUNT(*) n FROM licenses GROUP BY status`).all(),
  ]);
  return ok(c, {
    subscriptionsByStatus: subs.results ?? [],
    licensesByStatus: lic.results ?? [],
    storesConnected: stores?.n ?? 0,
    emailsSent: emails?.n ?? 0,
  });
});

/** GET /admin/licenses */
adminRoutes.get('/licenses', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, org_id, license_key, status, plan_id, period_ends_at, trial_ends_at,
            kill_switch, bound_domain, is_test, max_stores, created_at
       FROM licenses ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return ok(c, { licenses: rows.results ?? [] });
});

/**
 * POST /admin/licenses — issue a license (incl. free/test/beta).
 * body: { orgId, planId, isTest?, trialDays?, maxStores?, gracePeriodSeconds? }
 */
adminRoutes.post('/licenses', async (c) => {
  const admin = c.get('auth')!;
  const body = await c.req.json<{
    orgId?: string;
    planId?: string;
    isTest?: boolean;
    trialDays?: number;
    maxStores?: number;
    gracePeriodSeconds?: number;
  }>().catch(() => null);

  if (!body?.orgId) return errors.badRequest(c, 'orgId is required.');
  const planId: PlanId = isPlanId(body.planId ?? '') ? (body.planId as PlanId) : 'free_test';

  const ts = now();
  const id = prefixedId('lic');
  const key = generateLicenseKey();
  const isTest = body.isTest || planId === 'free_test' ? 1 : 0;
  const status: LicenseStatus = body.trialDays ? 'trialing' : 'active';
  const trialEndsAt = body.trialDays ? ts + body.trialDays * 86_400_000 : null;
  const maxStores = body.maxStores ?? PLANS[planId].limits.maxStores ?? 1;

  await c.env.DB.prepare(
    `INSERT INTO licenses (id, org_id, license_key, status, plan_id, period_ends_at, trial_ends_at,
        grace_period_seconds, cache_ttl_seconds, max_stores, kill_switch, is_test, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,900,?9,0,?10,?11,?11)`,
  )
    .bind(
      id, body.orgId, key, status, planId,
      null, trialEndsAt,
      body.gracePeriodSeconds ?? 259200,
      maxStores, isTest, ts,
    )
    .run();

  await audit(c, admin.userId, 'issue_license', id, `plan=${planId} test=${isTest}`);
  return ok(c, { id, licenseKey: key, status, planId, isTest: !!isTest }, 201);
});

/** POST /admin/licenses/:id/kill — emergency kill switch (immediate). */
adminRoutes.post('/licenses/:id/kill', async (c) => {
  const admin = c.get('auth')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ killed?: boolean; reason?: string }>().catch(() => null);
  const killed = body?.killed !== false;
  await setKillSwitch(c.env, id, killed);
  await audit(c, admin.userId, killed ? 'kill_switch_on' : 'kill_switch_off', id, body?.reason);
  return ok(c, { id, killed });
});

/** POST /admin/licenses/:id/status — set status (suspend/cancel/reactivate). */
adminRoutes.post('/licenses/:id/status', async (c) => {
  const admin = c.get('auth')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: LicenseStatus; periodEndsAt?: number | null }>().catch(() => null);
  if (!body?.status) return errors.badRequest(c, 'status is required.');
  await setLicenseStatus(c.env, id, body.status, body.periodEndsAt);
  await audit(c, admin.userId, 'set_status', id, body.status);
  return ok(c, { id, status: body.status });
});

/** POST /admin/licenses/:id/entitlements — per-feature override. */
adminRoutes.post('/licenses/:id/entitlements', async (c) => {
  const admin = c.get('auth')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ overrides?: Record<string, boolean> }>().catch(() => null);
  if (!body?.overrides) return errors.badRequest(c, 'overrides map is required.');
  await c.env.DB.prepare(`UPDATE licenses SET entitlement_overrides=?2, updated_at=?3 WHERE id=?1`)
    .bind(id, JSON.stringify(body.overrides), now())
    .run();
  await c.env.LICENSE_KV.delete(`decision:${id}`);
  await audit(c, admin.userId, 'set_entitlements', id);
  return ok(c, { id, overrides: body.overrides });
});

/** GET /admin/stores — connected WooCommerce sites + health. */
adminRoutes.get('/stores', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, org_id, name, domain, plugin_version, wp_version, woo_version, hpos_enabled,
            connection_health, last_sync_at, last_seen_at FROM stores ORDER BY last_seen_at DESC LIMIT 200`,
  ).all();
  return ok(c, { stores: rows.results ?? [] });
});

/** GET /admin/audit — recent admin actions. */
adminRoutes.get('/audit', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, admin_id, action, target, reason, created_at FROM admin_actions ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return ok(c, { actions: rows.results ?? [] });
});

/** GET /admin/merchants — merchant orgs with license status. */
adminRoutes.get('/merchants', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.name, o.type, o.created_at,
            (SELECT email FROM users u JOIN org_members m ON m.user_id=u.id WHERE m.org_id=o.id ORDER BY m.created_at ASC LIMIT 1) owner_email,
            (SELECT status FROM licenses l WHERE l.org_id=o.id ORDER BY l.created_at DESC LIMIT 1) license_status,
            (SELECT plan_id FROM licenses l WHERE l.org_id=o.id ORDER BY l.created_at DESC LIMIT 1) plan_id
       FROM organizations o ORDER BY o.created_at DESC LIMIT 300`,
  ).all();
  return ok(c, { merchants: rows.results ?? [] });
});

/** GET /admin/billing — subscriptions + recent webhooks. */
adminRoutes.get('/billing', async (c) => {
  const [subs, hooks] = await Promise.all([
    c.env.DB.prepare(`SELECT id, org_id, plan_id, status, provider, current_period_end FROM subscriptions ORDER BY created_at DESC LIMIT 200`).all(),
    c.env.DB.prepare(`SELECT id, provider, event_type, signature_ok, processed, created_at FROM billing_webhooks ORDER BY created_at DESC LIMIT 100`).all(),
  ]);
  return ok(c, { subscriptions: subs.results ?? [], webhooks: hooks.results ?? [] });
});

/** GET /admin/ai-jobs — recent AI generations + token cost. */
adminRoutes.get('/ai-jobs', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, store_id, kind, model, provider, status, cost_tokens, created_at FROM ai_jobs ORDER BY created_at DESC LIMIT 200`,
  ).all();
  const cost = await c.env.DB.prepare(`SELECT COALESCE(SUM(cost_tokens),0) tokens, COUNT(*) n FROM ai_jobs`).first<{ tokens: number; n: number }>();
  return ok(c, { jobs: rows.results ?? [], totalTokens: cost?.tokens ?? 0, totalJobs: cost?.n ?? 0 });
});

/** GET /admin/diagnostics — recent plugin diagnostic bundles. */
adminRoutes.get('/diagnostics', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.store_id, s.domain, d.created_at FROM plugin_diagnostics d JOIN stores s ON s.id=d.store_id ORDER BY d.created_at DESC LIMIT 100`,
  ).all();
  return ok(c, { diagnostics: rows.results ?? [] });
});

/** GET /admin/feature-flags — global feature catalog + plan entitlements. */
adminRoutes.get('/feature-flags', async (c) => {
  return ok(c, {
    features: Object.values(FEATURES).map((f) => ({ id: f.id, name: f.name, category: f.category, premium: f.premium })),
    plans: Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, entitlements: p.entitlements.length })),
  });
});

/** GET /admin/plugin-releases — plugin version/update channel. */
adminRoutes.get('/plugin-releases', async (c) => {
  const versions = await c.env.DB.prepare(
    `SELECT plugin_version, COUNT(*) n FROM stores WHERE plugin_version IS NOT NULL GROUP BY plugin_version`,
  ).all();
  return ok(c, {
    latestVersion: '0.1.0',
    minimumVersion: '0.1.0',
    changelogUrl: 'https://airevenuerecovery.com/changelog',
    installedVersions: versions.results ?? [],
  });
});
