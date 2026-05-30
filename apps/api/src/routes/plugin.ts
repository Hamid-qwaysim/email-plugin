import { Hono } from 'hono';
import {
  type EventBatch,
  FEATURES,
  type FeatureId,
  isEventType,
} from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { signedRequest, signedJson } from '../middleware/signed.js';
import { rateLimit } from '../middleware/ratelimit.js';
import { errors, ok } from '../lib/response.js';
import { getCachedDecision, loadLicenseRecord, validateLicense } from '../lib/license.js';
import { prefixedId, now } from '../lib/ids.js';
import { evaluateLicense } from '@arre/shared';
import { applyCartEvents } from '../lib/carts.js';

/**
 * Plugin-facing API. Every route here is HMAC-signed (signedRequest). The
 * plugin calls these from the WordPress server side, never the browser.
 */
export const pluginRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

pluginRoutes.use('*', signedRequest);
pluginRoutes.use(
  '*',
  rateLimit({
    limit: 600,
    windowSeconds: 60,
    key: (c) => `store:${c.get('signedStore')!.storeId}`,
  }),
);

/**
 * GET /plugin/license/validate
 * The plugin's heartbeat. Returns the authoritative decision + a TTL telling
 * the plugin how long it may cache the *positive* result. The kill switch is
 * read fresh on the server so an admin flip propagates within the short
 * inactive-decision TTL even against a cached positive result.
 */
pluginRoutes.get('/license/validate', async (c) => {
  const { licenseId, storeId } = c.get('signedStore')!;
  const decision = await validateLicense(c.env, licenseId);
  if (!decision) return errors.notFound(c, 'License not found.');

  // Audit (best-effort, non-blocking semantics in queue normally).
  await c.env.DB.prepare(
    `INSERT INTO license_validation_logs (id, license_id, store_id, decision, reason, created_at)
     VALUES (?1,?2,?3,?4,?5,?6)`,
  )
    .bind(prefixedId('val'), licenseId, storeId, decision.active ? 'active' : 'inactive', decision.reason, now())
    .run();

  return ok(c, {
    active: decision.active,
    status: decision.status,
    reason: decision.reason,
    inGracePeriod: decision.inGracePeriod,
    cacheTtlSeconds: decision.cacheTtlSeconds,
    entitlements: decision.entitlements,
    // Map entitlements to the plugin's premium-feature gating list.
    features: decision.entitlements.map((id) => ({
      id,
      name: FEATURES[id]?.name ?? id,
      premium: FEATURES[id]?.premium ?? true,
    })),
  });
});

/**
 * GET /plugin/killswitch
 * Ultra-cheap endpoint the plugin polls frequently. Returns only whether the
 * site must stop NOW. Reads the fast KV/D1 kill state without recomputing the
 * full decision.
 */
pluginRoutes.get('/killswitch', async (c) => {
  const { licenseId } = c.get('signedStore')!;
  const loaded = await loadLicenseRecord(c.env, licenseId);
  if (!loaded) return ok(c, { kill: true, reason: 'License not found.' });
  const decision = evaluateLicense(loaded.record);
  return ok(c, {
    kill: !decision.active,
    reason: decision.active ? null : decision.reason,
    recheckInSeconds: decision.active ? 300 : 120,
  });
});

/** POST /plugin/license/activate — bind this domain to the license. */
pluginRoutes.post('/license/activate', async (c) => {
  const { licenseId, storeId } = c.get('signedStore')!;
  const body = await signedJson<{ domain: string }>(c);
  if (!body?.domain) return errors.badRequest(c, 'domain is required.');

  const loaded = await loadLicenseRecord(c.env, licenseId);
  if (!loaded) return errors.notFound(c, 'License not found.');

  // Enforce activation/store limit.
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM license_activations WHERE license_id = ?1 AND status = 'active'`,
  )
    .bind(licenseId)
    .first<{ n: number }>();
  const active = countRow?.n ?? 0;

  const existing = await c.env.DB.prepare(
    `SELECT id FROM license_activations WHERE license_id = ?1 AND domain = ?2 AND status = 'active'`,
  )
    .bind(licenseId, body.domain)
    .first<{ id: string }>();

  const maxRow = await c.env.DB.prepare(`SELECT max_stores FROM licenses WHERE id = ?1`)
    .bind(licenseId)
    .first<{ max_stores: number }>();
  if (!existing && active >= (maxRow?.max_stores ?? 1)) {
    return errors.forbidden(c, 'Activation limit reached for this license.');
  }

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO license_activations (id, license_id, store_id, domain, status, activated_at, ip)
       VALUES (?1,?2,?3,?4,'active',?5,?6)`,
    )
      .bind(prefixedId('act'), licenseId, storeId, body.domain, now(), c.req.header('cf-connecting-ip') ?? null)
      .run();
  }

  const decision = await validateLicense(c.env, licenseId);
  return ok(c, { activated: true, decision });
});

/** POST /plugin/license/deactivate — release this domain. */
pluginRoutes.post('/license/deactivate', async (c) => {
  const { licenseId } = c.get('signedStore')!;
  const body = await signedJson<{ domain: string }>(c);
  if (!body?.domain) return errors.badRequest(c, 'domain is required.');
  await c.env.DB.prepare(
    `UPDATE license_activations SET status='deactivated', deactivated_at=?3
       WHERE license_id=?1 AND domain=?2 AND status='active'`,
  )
    .bind(licenseId, body.domain, now())
    .run();
  return ok(c, { deactivated: true });
});

/** GET /plugin/entitlements — features the plugin should enable locally. */
pluginRoutes.get('/entitlements', async (c) => {
  const { licenseId } = c.get('signedStore')!;
  const decision = (await getCachedDecision(c.env, licenseId)) ?? (await validateLicense(c.env, licenseId));
  if (!decision) return errors.notFound(c, 'License not found.');
  return ok(c, {
    active: decision.active,
    entitlements: decision.active ? decision.entitlements : [],
  });
});

/**
 * POST /plugin/events — batched, retry-safe event ingest. Refuses ingest when
 * the license is inactive (tracking is a premium surface). Events are written
 * and a scoring job is enqueued; heavy work happens off the request path.
 */
pluginRoutes.post('/events', async (c) => {
  const { licenseId, storeId } = c.get('signedStore')!;
  const decision = (await getCachedDecision(c.env, licenseId)) ?? (await validateLicense(c.env, licenseId));
  if (!decision?.active) return errors.licenseInactive(c, decision?.reason ?? 'License inactive.');
  if (!decision.entitlements.includes('visitor_tracking' as FeatureId)) {
    return errors.forbidden(c, 'Visitor tracking is not included in your plan.');
  }

  const batch = await signedJson<EventBatch>(c);
  if (!batch || !Array.isArray(batch.events)) {
    return errors.badRequest(c, 'Invalid event batch.');
  }
  if (batch.events.length > 200) {
    return errors.badRequest(c, 'Batch too large (max 200 events).');
  }

  const stmts = [];
  for (const ev of batch.events) {
    if (!isEventType(ev.type)) continue;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO events (id, store_id, visitor_id, session_id, type, props, cart_token, client_ts, received_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
      ).bind(
        prefixedId('evt'),
        storeId,
        ev.visitorId ?? null,
        ev.sessionId ?? null,
        ev.type,
        ev.props ? JSON.stringify(ev.props) : null,
        ev.cartToken ?? null,
        ev.ts ?? null,
        now(),
      ),
    );
  }
  if (stmts.length) await c.env.DB.batch(stmts);

  // Maintain cart lifecycle from cart-affecting events.
  await applyCartEvents(
    c.env,
    storeId,
    batch.events.map((e) => ({ type: e.type, visitorId: e.visitorId, cartToken: e.cartToken, props: e.props })),
  );

  // Enqueue async visitor scoring for the affected visitors.
  const visitorIds = [...new Set(batch.events.map((e) => e.visitorId).filter(Boolean))];
  for (const vid of visitorIds.slice(0, 50)) {
    await c.env.JOBS_QUEUE.send({ kind: 'score_visitor', visitorId: vid!, storeId });
  }

  return ok(c, { accepted: stmts.length });
});

/** GET /plugin/onsite — popups/top-bars/recommendation blocks to render. */
pluginRoutes.get('/onsite', async (c) => {
  const { licenseId, storeId } = c.get('signedStore')!;
  const decision = (await getCachedDecision(c.env, licenseId)) ?? (await validateLicense(c.env, licenseId));
  if (!decision?.active) return ok(c, { popups: [], topBars: [] });

  const popups = await c.env.DB.prepare(
    `SELECT id, kind, targeting, design, content, frequency_cap FROM popups
       WHERE store_id = ?1 AND status = 'active'`,
  )
    .bind(storeId)
    .all();
  return ok(c, { popups: popups.results ?? [] });
});

/** POST /plugin/diagnostics — store the plugin's self-report. */
pluginRoutes.post('/diagnostics', async (c) => {
  const { storeId } = c.get('signedStore')!;
  const body = await signedJson<Record<string, unknown>>(c);
  await c.env.DB.prepare(
    `INSERT INTO plugin_diagnostics (id, store_id, payload, created_at) VALUES (?1,?2,?3,?4)`,
  )
    .bind(prefixedId('diag'), storeId, JSON.stringify(body ?? {}), now())
    .run();

  // Update store health snapshot from the diagnostic.
  if (body && typeof body === 'object') {
    const d = body as Record<string, string | number | boolean>;
    await c.env.DB.prepare(
      `UPDATE stores SET plugin_version=?2, wp_version=?3, woo_version=?4, hpos_enabled=?5,
         last_seen_at=?6, connection_health='healthy', updated_at=?6 WHERE id=?1`,
    )
      .bind(
        storeId,
        String(d.pluginVersion ?? ''),
        String(d.wpVersion ?? ''),
        String(d.wooVersion ?? ''),
        d.hposEnabled ? 1 : 0,
        now(),
      )
      .run();
  }
  return ok(c, { received: true });
});

/** GET /plugin/update-meta — plugin update channel metadata. */
pluginRoutes.get('/update-meta', async (c) => {
  return ok(c, {
    latestVersion: '0.1.0',
    minimumVersion: '0.1.0',
    downloadUrl: null, // set by release pipeline
    changelogUrl: 'https://airevenuerecovery.com/changelog',
  });
});
