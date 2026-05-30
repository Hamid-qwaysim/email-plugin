import type { Context, Next } from 'hono';
import {
  buildCanonicalString,
  isTimestampFresh,
  SIGNATURE_HEADERS,
  SIGNATURE_VERSION,
  timingSafeEqual,
} from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { hmacSha256Hex, sha256Hex } from '../lib/crypto.js';
import { errors } from '../lib/response.js';

interface StoreAuthRow {
  store_id: string;
  license_id: string;
  org_id: string;
  signing_secret: string;
  license_key: string;
}

/**
 * Verifies a signed plugin request:
 *  1. all signature headers present
 *  2. signature version supported
 *  3. timestamp within clock-skew window (replay-resistance window)
 *  4. nonce unseen (hard replay protection via KV, TTL = skew window)
 *  5. HMAC over the canonical string matches the store's signing secret
 *  6. store ↔ license binding is correct
 *
 * On success it stashes { storeId, licenseId, orgId } on the context. It does
 * NOT check license activity — that is the route's job (some endpoints, like
 * license validation and diagnostics, must work even when inactive).
 */
export async function signedRequest(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const h = c.req.header.bind(c.req);
  const storeId = h(SIGNATURE_HEADERS.storeId);
  const licenseKey = h(SIGNATURE_HEADERS.licenseKey);
  const tsRaw = h(SIGNATURE_HEADERS.timestamp);
  const nonce = h(SIGNATURE_HEADERS.nonce);
  const signature = h(SIGNATURE_HEADERS.signature);
  const version = h(SIGNATURE_HEADERS.version) ?? SIGNATURE_VERSION;

  if (!storeId || !licenseKey || !tsRaw || !nonce || !signature) {
    return errors.unauthorized(c, 'Missing request signature headers.');
  }
  if (version !== SIGNATURE_VERSION) {
    return errors.badRequest(c, `Unsupported signature version: ${version}`);
  }

  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp) || !isTimestampFresh(timestamp)) {
    return errors.unauthorized(c, 'Request timestamp is stale or invalid.');
  }

  // Replay protection: a nonce may be used once within the skew window.
  const nonceKey = `nonce:${storeId}:${nonce}`;
  const seen = await c.env.NONCE_KV.get(nonceKey);
  if (seen) {
    return errors.unauthorized(c, 'Replay detected (nonce already used).');
  }

  const row = await c.env.DB.prepare(
    `SELECT s.id AS store_id, s.license_id, s.org_id, s.signing_secret, l.license_key
       FROM stores s JOIN licenses l ON l.id = s.license_id
      WHERE s.id = ?1`,
  )
    .bind(storeId)
    .first<StoreAuthRow>();

  if (!row) {
    return errors.unauthorized(c, 'Unknown store.');
  }
  if (!timingSafeEqual(row.license_key, licenseKey)) {
    return errors.unauthorized(c, 'License key does not match store.');
  }

  // Recompute the body hash from the raw bytes the route will also read.
  const bodyBuf = await c.req.arrayBuffer();
  const bodyHashHex = await sha256Hex(bodyBuf.byteLength ? bodyBuf : '');

  const canonical = buildCanonicalString({
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    storeId,
    licenseKey,
    timestamp,
    nonce,
    bodyHashHex,
  });

  const expected = await hmacSha256Hex(row.signing_secret, canonical);
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return errors.unauthorized(c, 'Invalid request signature.');
  }

  // Record the nonce so it cannot be replayed within the freshness window.
  await c.env.NONCE_KV.put(nonceKey, '1', { expirationTtl: 360 });

  c.set('signedStore', {
    storeId: row.store_id,
    licenseId: row.license_id,
    orgId: row.org_id,
  });

  // Re-expose the already-consumed body to downstream handlers.
  c.set('requestId', c.get('requestId'));
  (c.req.raw as unknown as { _arreBody?: ArrayBuffer })._arreBody = bodyBuf;

  await next();
}

/** Read the body buffer captured during signature verification. */
export function signedBody(c: Context): ArrayBuffer | undefined {
  return (c.req.raw as unknown as { _arreBody?: ArrayBuffer })._arreBody;
}

export async function signedJson<T>(c: Context): Promise<T | null> {
  const buf = signedBody(c);
  if (!buf || buf.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(buf)) as T;
  } catch {
    return null;
  }
}
