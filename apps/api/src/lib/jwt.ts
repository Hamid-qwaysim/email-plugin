import { sign, verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import type { Role } from '@arre/shared';

export interface SessionClaims {
  sub: string; // user id
  org: string; // org id
  role: Role;
  exp: number; // unix seconds
  iat: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
const ALG = 'HS256' as const;

export async function issueSession(
  secret: string,
  user: { id: string; orgId: string; role: Role },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    sub: user.id,
    org: user.orgId,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return sign(claims as unknown as JWTPayload, secret, ALG);
}

export async function verifySession(
  secret: string,
  token: string,
): Promise<SessionClaims | null> {
  try {
    const payload = (await verify(token, secret, ALG)) as unknown as SessionClaims;
    return payload;
  } catch {
    return null;
  }
}
