/**
 * TURN logins for calls, from Cloudflare.
 *
 * A call connects the two phones directly, and each phone learns its public
 * address from a STUN server so the other can reach it. That fails when a
 * mobile carrier puts the phone behind a NAT that only lets the phone's own
 * outgoing connections back in - common on mobile data - and the call rings,
 * is answered, and never connects. TURN is the fallback: both phones send
 * their audio to a relay that forwards it. The audio is still encrypted end to
 * end by WebRTC; the TURN server carries it without being able to hear it.
 *
 * Two ways to set it up, from this server's environment - never from the app,
 * so a login is only ever handed to a phone that has joined a space. Unset,
 * calls work exactly as they did before: STUN only.
 *
 * Cloudflare, whose logins are short-lived and minted here from a key:
 *
 *   CLOUDFLARE_TURN_KEY_ID      the TURN key's id
 *   CLOUDFLARE_TURN_API_TOKEN   that key's API token
 *
 * Or any provider that gives one fixed login (ExpressTURN's free plan, which
 * needs no card, is one):
 *
 *   TURN_URLS         comma-separated, e.g. turn:relay1.expressturn.com:3478
 *   TURN_USERNAME
 *   TURN_CREDENTIAL
 *
 * Cloudflare wins if both are set.
 */

const KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
const API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
const cloudflareConfigured = Boolean(KEY_ID && API_TOKEN);

const STATIC_URLS = (process.env.TURN_URLS || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);
const STATIC_USERNAME = process.env.TURN_USERNAME?.trim();
const STATIC_CREDENTIAL = process.env.TURN_CREDENTIAL?.trim();

/** A fixed login, checked the same way as one from Cloudflare. */
const staticServers: IceServer[] =
  STATIC_URLS.length && STATIC_USERNAME && STATIC_CREDENTIAL
    ? normalizeIceServers({
        iceServers: [{ urls: STATIC_URLS, username: STATIC_USERNAME, credential: STATIC_CREDENTIAL }]
      })
    : [];
if (STATIC_URLS.length && staticServers.length === 0) {
  console.error('[TURN] TURN_URLS is set but unusable - check the addresses start with turn: and the login is set');
}

/** How long one set of logins lasts. */
const CREDENTIAL_TTL_S = 48 * 60 * 60;
/**
 * Replaced once less than this is left, so any login handed to a phone is
 * still good for at least a day - longer than a phone keeps one connection.
 */
const REFRESH_WHEN_LEFT_MS = 24 * 60 * 60 * 1000;
/** After a failure, how long before Cloudflare is asked again. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServerSet {
  iceServers: IceServer[];
  /** Epoch ms after which the logins stop working. */
  expiresAt: number;
}

export const turnConfigured = cloudflareConfigured || staticServers.length > 0;

let cached: IceServerSet | null = null;
let inFlight: Promise<IceServerSet | null> | null = null;
let lastFailureAt = 0;

// A declaration rather than an arrow: the fixed login above is checked with
// this as the module loads, before a `const` down here would exist.
function isIceUrl(u: unknown): u is string {
  return (
    typeof u === 'string' &&
    /^(stun|turn|turns):/.test(u) &&
    // Browsers refuse port 53, so an address on it only costs a timeout before
    // the next one is tried. Cloudflare's own guidance is to drop them.
    !/:53(\?|$)/.test(u)
  );
}

/**
 * Accepts both shapes Cloudflare has returned - a list of servers, or a single
 * server object - and keeps only well-formed entries.
 */
export function normalizeIceServers(body: unknown): IceServer[] {
  const raw = (body as { iceServers?: unknown } | null)?.iceServers;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: IceServer[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const urls = (Array.isArray(e.urls) ? e.urls : [e.urls]).filter(isIceUrl);
    if (urls.length === 0) continue;
    const needsLogin = urls.some(u => u.startsWith('turn'));
    if (needsLogin && (typeof e.username !== 'string' || typeof e.credential !== 'string')) continue;
    out.push(
      needsLogin ? { urls, username: e.username as string, credential: e.credential as string } : { urls }
    );
  }
  return out;
}

async function mint(): Promise<IceServerSet | null> {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(KEY_ID!)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_S }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
  );
  if (!response.ok) {
    throw new Error(`Cloudflare answered ${response.status}`);
  }
  const iceServers = normalizeIceServers(await response.json());
  if (!iceServers.some(s => [s.urls].flat().some(u => u.startsWith('turn')))) {
    throw new Error('Cloudflare returned no TURN servers');
  }
  // A little short of the real expiry, so a login is never offered in its
  // final seconds.
  return { iceServers, expiresAt: Date.now() + CREDENTIAL_TTL_S * 1000 - 60_000 };
}

/**
 * The current logins, minted or refreshed as needed; null when TURN is not set
 * up or Cloudflare cannot be reached. Never throws.
 */
export async function getIceServers(): Promise<IceServerSet | null> {
  if (!turnConfigured) return null;
  if (!cloudflareConfigured) {
    // A fixed login does not expire; the date only tells a phone how long it
    // may keep this copy before asking again.
    return { iceServers: staticServers, expiresAt: Date.now() + CREDENTIAL_TTL_S * 1000 };
  }

  const now = Date.now();
  if (cached && cached.expiresAt - now > REFRESH_WHEN_LEFT_MS) return cached;
  if (now - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return cached && cached.expiresAt > now ? cached : null;
  }

  // Two phones joining at once share one request.
  if (!inFlight) {
    inFlight = mint()
      .then(set => {
        cached = set;
        return set;
      })
      .catch(err => {
        lastFailureAt = Date.now();
        console.error('[TURN] Could not get call relay logins:', err instanceof Error ? err.message : err);
        return cached && cached.expiresAt > Date.now() ? cached : null;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
