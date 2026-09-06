// Verifying Supabase access tokens on the relay.
//
// Without this, the login page is only a curtain: the relay accepts any socket
// that knows a spaceId, so anyone could skip the UI entirely.
//
// Supabase signs tokens one of two ways, and a project can be on either:
//
//   * ES256/RS256 - asymmetric, the current default. Public keys are published
//     at /auth/v1/.well-known/jwks.json and there is no shared secret at all.
//     Configure SUPABASE_URL.
//   * HS256 - the legacy shared secret, now deprecated by Supabase.
//     Configure SUPABASE_JWT_SECRET.
//
// Setting neither leaves the relay open, which keeps local development and
// older clients working. Setting the WRONG one is the dangerous case: every
// token fails to verify and every device is silently locked out, so the two
// paths are kept independent and either is sufficient.

import { createHmac, timingSafeEqual, createPublicKey, verify as cryptoVerify, KeyObject } from 'crypto';

const HS256_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const JWKS_URL =
  process.env.SUPABASE_JWKS_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : '');

export const isAuthEnforced = HS256_SECRET.length > 0 || JWKS_URL.length > 0;

export interface VerifiedUser {
  sub: string;
  phone?: string;
  email?: string;
}

// Signing keys rotate, so an unknown `kid` triggers a refetch - rate limited so
// a stream of junk tokens cannot turn into a stream of outbound requests.
const jwks = new Map<string, KeyObject>();
let lastFetchAt = 0;
const MIN_REFETCH_MS = 60_000;

function base64UrlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='), 'base64');
}

async function refreshJwks(): Promise<void> {
  if (!JWKS_URL) return;
  if (Date.now() - lastFetchAt < MIN_REFETCH_MS) return;
  lastFetchAt = Date.now();

  try {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`[Auth] JWKS fetch failed: HTTP ${res.status}`);
      return;
    }

    const body = (await res.json()) as { keys?: any[] };
    if (!Array.isArray(body.keys)) return;

    for (const jwk of body.keys) {
      if (!jwk?.kid) continue;
      try {
        jwks.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      } catch (e: any) {
        console.error('[Auth] Unusable JWK', jwk.kid, e?.message || e);
      }
    }
    console.log(`[Auth] Loaded ${jwks.size} signing key(s) from Supabase.`);
  } catch (e: any) {
    console.error('[Auth] JWKS fetch error:', e?.message || e);
  }
}

/** Warms the key cache so the first sign-in does not pay for the fetch. */
export async function primeJwks(): Promise<void> {
  if (JWKS_URL) await refreshJwks();
}

async function keyFor(kid: string): Promise<KeyObject | null> {
  const cached = jwks.get(kid);
  if (cached) return cached;
  await refreshJwks();
  return jwks.get(kid) ?? null;
}

function verifyHs256(signingInput: string, signature: Buffer): boolean {
  if (!HS256_SECRET) return false;
  const expected = createHmac('sha256', HS256_SECRET).update(signingInput).digest();
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(expected, signature);
}

async function verifyAsymmetric(
  alg: string,
  kid: string | undefined,
  signingInput: string,
  signature: Buffer
): Promise<boolean> {
  if (!kid) return false;
  const key = await keyFor(kid);
  if (!key) return false;

  const digest = alg.endsWith('512') ? 'sha512' : alg.endsWith('384') ? 'sha384' : 'sha256';

  try {
    if (alg.startsWith('ES')) {
      // JWT carries ECDSA signatures as raw r||s; node defaults to DER.
      return cryptoVerify(digest, Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' }, signature);
    }
    if (alg.startsWith('RS')) {
      return cryptoVerify(digest, Buffer.from(signingInput), key, signature);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Returns the token's claims, or null if it is missing, malformed, expired or
 * not signed by this project.
 */
export async function verifyAccessToken(token: unknown): Promise<VerifiedUser | null> {
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

  const alg = header?.alg;
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);

  // Only algorithms we actually verify. Trusting the header's choice outright,
  // or honouring "none", is the classic JWT bypass.
  let signatureValid = false;
  if (alg === 'HS256') {
    signatureValid = verifyHs256(signingInput, signature);
  } else if (alg === 'ES256' || alg === 'ES384' || alg === 'ES512' ||
             alg === 'RS256' || alg === 'RS384' || alg === 'RS512') {
    signatureValid = await verifyAsymmetric(alg, header?.kid, signingInput, signature);
  }
  if (!signatureValid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null;
  if (!payload.sub) return null;

  return { sub: payload.sub, phone: payload.phone, email: payload.email };
}
