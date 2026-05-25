/** Sortable, URL-safe unique ids (ULID-style: time prefix + randomness). */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

export function ulid(now: number = Date.now()): string {
  let time = now;
  const timeChars: string[] = [];
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = ENCODING[time % 32]!;
    time = Math.floor(time / 32);
  }
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  let randStr = '';
  for (let i = 0; i < 16; i++) randStr += ENCODING[rand[i]! % 32];
  return timeChars.join('') + randStr;
}

export function prefixedId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}

export const now = (): number => Date.now();
