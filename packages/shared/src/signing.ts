/**
 * Canonical request-signing spec for all plugin → SaaS calls.
 *
 * Both ends MUST build the exact same canonical string. The plugin (PHP) signs
 * it with the store's signing secret via hash_hmac('sha256', ...); the Worker
 * (TS) verifies with Web Crypto. Keeping the canonical-string builder here as
 * the documented source of truth prevents the two implementations from drifting.
 *
 * Canonical string (newline-joined):
 *   v1
 *   <HTTP METHOD upper-case>
 *   <PATH, no query>
 *   <store_id>
 *   <license_key>
 *   <timestamp seconds>
 *   <nonce>
 *   <sha256 hex of raw request body, or sha256 of "" for empty>
 */

export const SIGNATURE_VERSION = 'v1';

/** Reject requests whose timestamp is more than this many seconds off. */
export const MAX_CLOCK_SKEW_SECONDS = 300;

export interface SignatureParts {
  method: string;
  /** Path only, without query string. */
  path: string;
  storeId: string;
  licenseKey: string;
  /** Unix seconds. */
  timestamp: number;
  /** Random per-request nonce (replay protection). */
  nonce: string;
  /** Lower-case hex sha256 of the raw request body. */
  bodyHashHex: string;
}

export function buildCanonicalString(parts: SignatureParts): string {
  return [
    SIGNATURE_VERSION,
    parts.method.toUpperCase(),
    parts.path,
    parts.storeId,
    parts.licenseKey,
    String(parts.timestamp),
    parts.nonce,
    parts.bodyHashHex,
  ].join('\n');
}

/** Header names used to transport the signature material. */
export const SIGNATURE_HEADERS = {
  storeId: 'x-arre-store',
  licenseKey: 'x-arre-license',
  timestamp: 'x-arre-timestamp',
  nonce: 'x-arre-nonce',
  signature: 'x-arre-signature',
  version: 'x-arre-sig-version',
} as const;

export function isTimestampFresh(
  timestampSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return Math.abs(nowSeconds - timestampSeconds) <= MAX_CLOCK_SKEW_SECONDS;
}

/** Constant-time string comparison to avoid timing oracles on signatures. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
