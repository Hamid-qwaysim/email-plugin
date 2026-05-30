import type { Context } from 'hono';

export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
  requestId?: string;
}

export function ok<T>(c: Context, data: T, status = 200): Response {
  const body: ApiOk<T> = { ok: true, data, requestId: c.get('requestId') };
  return c.json(body, status as 200);
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): Response {
  const body: ApiError = {
    ok: false,
    error: { code, message, details },
    requestId: c.get('requestId'),
  };
  return c.json(body, status as 400);
}

export const errors = {
  unauthorized: (c: Context, msg = 'Authentication required.') =>
    fail(c, 'unauthorized', msg, 401),
  forbidden: (c: Context, msg = 'You do not have permission to do that.') =>
    fail(c, 'forbidden', msg, 403),
  notFound: (c: Context, msg = 'Not found.') => fail(c, 'not_found', msg, 404),
  badRequest: (c: Context, msg: string, details?: unknown) =>
    fail(c, 'bad_request', msg, 400, details),
  rateLimited: (c: Context, msg = 'Too many requests.') =>
    fail(c, 'rate_limited', msg, 429),
  licenseInactive: (c: Context, msg: string) => fail(c, 'license_inactive', msg, 402),
  internal: (c: Context, msg = 'Something went wrong.') =>
    fail(c, 'internal_error', msg, 500),
};
