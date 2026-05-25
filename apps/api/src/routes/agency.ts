import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { prefixedId, now } from '../lib/ids.js';

/**
 * White-label / Agency foundation (#22). Agencies own client organizations
 * (organizations.parent_org_id = agency org) and see per-client metrics +
 * white-label branding. Scoped to agency roles.
 */
export const agencyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agencyRoutes.use('*', requireAuth, requireRole('agency_owner', 'agency_member'));

/** GET /agency/clients — client orgs + their stores + recovered revenue. */
agencyRoutes.get('/clients', async (c) => {
  const auth = c.get('auth')!;
  const clients = await c.env.DB.prepare(
    `SELECT id, name, created_at FROM organizations WHERE parent_org_id = ?1 ORDER BY created_at DESC`,
  ).bind(auth.orgId).all<{ id: string; name: string; created_at: number }>();

  const result = [];
  for (const client of clients.results ?? []) {
    const stores = await c.env.DB.prepare(
      `SELECT id, name, domain, connection_health FROM stores WHERE org_id = ?1`,
    ).bind(client.id).all();
    const recovered = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(o.total_cents),0) v FROM orders o
        JOIN stores s ON s.id = o.store_id WHERE s.org_id = ?1 AND o.recovered = 1`,
    ).bind(client.id).first<{ v: number }>();
    result.push({ ...client, stores: stores.results ?? [], recoveredRevenueCents: recovered?.v ?? 0 });
  }
  return ok(c, { clients: result });
});

/** POST /agency/clients — create a client org under the agency. */
agencyRoutes.post('/clients', async (c) => {
  const auth = c.get('auth')!;
  if (auth.role !== 'agency_owner') return errors.forbidden(c, 'Only the agency owner can add clients.');
  const body = await c.req.json<{ name?: string }>().catch(() => null);
  if (!body?.name) return errors.badRequest(c, 'name is required.');
  const id = prefixedId('org');
  await c.env.DB.prepare(
    `INSERT INTO organizations (id, name, type, parent_org_id, created_at, updated_at) VALUES (?1,?2,'merchant',?3,?4,?4)`,
  ).bind(id, body.name, auth.orgId, now()).run();
  return ok(c, { id, name: body.name }, 201);
});

/** PATCH /agency/branding — white-label settings stored on the agency org. */
agencyRoutes.patch('/branding', async (c) => {
  const auth = c.get('auth')!;
  if (auth.role !== 'agency_owner') return errors.forbidden(c);
  const body = await c.req.json<{ name?: string; logoUrl?: string; primaryColor?: string; reportFooter?: string }>().catch(() => null);
  if (!body) return errors.badRequest(c, 'Invalid body.');
  const branding = {
    name: body.name ?? null,
    logoUrl: body.logoUrl ?? null,
    primaryColor: /^#[0-9a-fA-F]{3,8}$/.test(body.primaryColor ?? '') ? body.primaryColor : null,
    reportFooter: body.reportFooter ?? null,
  };
  await c.env.DB.prepare(`UPDATE organizations SET branding = ?2, updated_at = ?3 WHERE id = ?1`)
    .bind(auth.orgId, JSON.stringify(branding), now()).run();
  return ok(c, { branding });
});

/** GET /agency/branding */
agencyRoutes.get('/branding', async (c) => {
  const auth = c.get('auth')!;
  const row = await c.env.DB.prepare(`SELECT branding FROM organizations WHERE id = ?1`).bind(auth.orgId).first<{ branding: string | null }>();
  return ok(c, { branding: row?.branding ? JSON.parse(row.branding) : null });
});

/** GET /agency/overview — aggregated metrics across all client stores. */
agencyRoutes.get('/overview', async (c) => {
  const auth = c.get('auth')!;
  const agg = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT s.id) stores, COALESCE(SUM(CASE WHEN o.recovered=1 THEN o.total_cents ELSE 0 END),0) recovered
       FROM organizations c
       LEFT JOIN stores s ON s.org_id = c.id
       LEFT JOIN orders o ON o.store_id = s.id
      WHERE c.parent_org_id = ?1`,
  ).bind(auth.orgId).first<{ stores: number; recovered: number }>();
  return ok(c, { clientStores: agg?.stores ?? 0, recoveredRevenueCents: agg?.recovered ?? 0 });
});
