import type { Context, Next } from 'hono';
import type { Env, Variables } from '../env.js';
import { errors } from '../lib/response.js';

/**
 * Fixed-window rate limiter backed by KV. Not perfectly precise across edge
 * locations, but cheap and good enough to blunt abuse. Keyed by an identifier
 * derived per-call (IP for public routes, store/org for authed routes).
 */
export function rateLimit(opts: {
  limit: number;
  windowSeconds: number;
  key: (c: Context<{ Bindings: Env; Variables: Variables }>) => string;
}) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const bucket = Math.floor(Date.now() / 1000 / opts.windowSeconds);
    const kvKey = `rl:${opts.key(c)}:${bucket}`;
    const current = Number((await c.env.NONCE_KV.get(kvKey)) ?? '0');

    if (current >= opts.limit) {
      c.header('Retry-After', String(opts.windowSeconds));
      return errors.rateLimited(c);
    }

    await c.env.NONCE_KV.put(kvKey, String(current + 1), {
      expirationTtl: opts.windowSeconds + 1,
    });
    await next();
  };
}

export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
}
