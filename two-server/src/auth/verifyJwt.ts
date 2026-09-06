// Verifying Supabase access tokens on the relay.
//
// Without this, the login page is only a curtain: the relay accepts any socket
// that knows a spaceId, so anyone could skip the UI entirely. Supabase signs
// access tokens with the project's JWT secret (HS256 by default), which is
// enough to check here with node's crypto - no dependency needed.
//
// Set SUPABASE_JWT_SECRET to enable. Left unset, the relay stays open, which
// keeps local development and older clients working.

import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.SUPABASE_JWT_SECRET || '';

export const isAuthEnforced = SECRET.length > 0;

export interface VerifiedUser {
  sub: string;
  phone?: string;
  email?: string;
}

function base64UrlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='), 'base64');
}

/**
 * Returns the token's claims, or null if it is missing, malformed, expired or
 * not signed by this project.
 */
export function verifyAccessToken(token: unknown): VerifiedUser | null {
  if (!isAuthEnforced) return null;
  if (typeof token !== 'string' || token.length === 0) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: any;
  let payload: any;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  // Only the algorithm we actually verify. Accepting "none", or trusting the
  // header's choice, is the classic JWT bypass.
  if (header?.alg !== 'HS256') return null;

  const expected = createHmac('sha256', SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = base64UrlDecode(signatureB64);

  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null;
  if (!payload.sub) return null;

  return { sub: payload.sub, phone: payload.phone, email: payload.email };
}
