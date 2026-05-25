import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { errors, ok } from '../lib/response.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { issueSession } from '../lib/jwt.js';
import { prefixedId, now } from '../lib/ids.js';
import { rateLimit, clientIp } from '../middleware/ratelimit.js';
import { requireAuth } from '../middleware/auth.js';
import type { Role } from '@arre/shared';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

authRoutes.use(
  '*',
  rateLimit({ limit: 20, windowSeconds: 60, key: (c) => `auth:${clientIp(c)}` }),
);

function validEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254;
}

/** POST /auth/register — creates a merchant org + owner user. */
authRoutes.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string; orgName?: string }>().catch(() => null);
  if (!body || !validEmail(body.email)) return errors.badRequest(c, 'A valid email is required.');
  if (!body.password || body.password.length < 10) {
    return errors.badRequest(c, 'Password must be at least 10 characters.');
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`).bind(body.email).first();
  if (existing) return errors.badRequest(c, 'An account with that email already exists.');

  const ts = now();
  const userId = prefixedId('usr');
  const orgId = prefixedId('org');
  const role: Role = 'merchant_owner';

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO organizations (id, name, type, created_at, updated_at) VALUES (?1,?2,'merchant',?3,?3)`,
    ).bind(orgId, body.orgName ?? `${body.name ?? 'My'} Store`, ts),
    c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?5)`,
    ).bind(userId, body.email, await hashPassword(body.password), body.name ?? null, ts),
    c.env.DB.prepare(
      `INSERT INTO org_members (id, org_id, user_id, role, created_at) VALUES (?1,?2,?3,?4,?5)`,
    ).bind(prefixedId('mem'), orgId, userId, role, ts),
  ]);

  const token = await issueSession(c.env.JWT_SECRET, { id: userId, orgId, role });
  return ok(c, { token, user: { id: userId, email: body.email, role, orgId } }, 201);
});

/** POST /auth/login */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  if (!body || !validEmail(body.email) || !body.password) {
    return errors.badRequest(c, 'Email and password are required.');
  }

  const user = await c.env.DB.prepare(
    `SELECT id, password_hash, status FROM users WHERE email = ?1`,
  )
    .bind(body.email)
    .first<{ id: string; password_hash: string; status: string }>();

  // Always run a verify to keep timing roughly constant.
  const okPass = user
    ? await verifyPassword(body.password, user.password_hash)
    : await verifyPassword(body.password, 'pbkdf2$100000$00$00');

  if (!user || !okPass || user.status !== 'active') {
    return errors.unauthorized(c, 'Invalid email or password.');
  }

  const member = await c.env.DB.prepare(
    `SELECT org_id, role FROM org_members WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(user.id)
    .first<{ org_id: string; role: Role }>();
  if (!member) return errors.forbidden(c, 'No organization membership.');

  await c.env.DB.prepare(`UPDATE users SET last_seen_at = ?2 WHERE id = ?1`).bind(user.id, now()).run();

  const token = await issueSession(c.env.JWT_SECRET, {
    id: user.id,
    orgId: member.org_id,
    role: member.role,
  });
  return ok(c, { token, user: { id: user.id, email: body.email, role: member.role, orgId: member.org_id } });
});

/** GET /auth/me */
authRoutes.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth')!;
  const user = await c.env.DB.prepare(`SELECT id, email, name FROM users WHERE id = ?1`)
    .bind(auth.userId)
    .first<{ id: string; email: string; name: string | null }>();
  return ok(c, { user: { ...user, role: auth.role, orgId: auth.orgId } });
});
