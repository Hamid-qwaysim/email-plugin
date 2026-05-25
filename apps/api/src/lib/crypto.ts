/** Web Crypto helpers for the Worker runtime. */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(sig);
}

/**
 * Derive a store's signing secret from a stable per-store seed + server pepper.
 * The plugin stores the same derived secret (returned once at activation), so
 * the raw pepper never leaves the server.
 */
export async function deriveStoreSecret(seed: string, pepper: string): Promise<string> {
  return hmacSha256Hex(pepper, `store-secret:${seed}`);
}

/** Cryptographically random token, hex-encoded. */
export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Generate a human-friendly license key: ARRE-XXXX-XXXX-XXXX-XXXX.
 * Uses an unambiguous alphabet (no 0/O/1/I).
 */
export function generateLicenseKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const idx = buf[g * 4 + i]! % alphabet.length;
      s += alphabet[idx];
    }
    groups.push(s);
  }
  return `ARRE-${groups.join('-')}`;
}
