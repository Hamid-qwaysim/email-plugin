import type { Context, Next } from 'hono';
import { isStaff, type Role } from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { verifySession } from '../lib/jwt.js';
import { errors } from '../lib/response.js';

function bearer(c: Context): string | null {
  const header = c.req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Requires a valid session; populates c.get('auth'). */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const token = bearer(c);
  if (!token) return errors.unauthorized(c);

  const claims = await verifySession(c.env.JWT_SECRET, token);
  if (!claims) return errors.unauthorized(c, 'Invalid or expired session.');

  c.set('auth', { userId: claims.sub, orgId: claims.org, role: claims.role });
  await next();
}

/** Requires one of the given roles (use after requireAuth). */
export function requireRole(...roles: Role[]) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const auth = c.get('auth');
    if (!auth) return errors.unauthorized(c);
    if (!roles.includes(auth.role)) return errors.forbidden(c);
    await next();
  };
}

/** Requires platform staff (super_admin/support). */
export async function requireStaff(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const auth = c.get('auth');
  if (!auth) return errors.unauthorized(c);
  if (!isStaff(auth.role)) return errors.forbidden(c, 'Staff access required.');
  await next();
}
