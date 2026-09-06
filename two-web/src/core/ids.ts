// Identifiers for records that two people can create at the same time.

/**
 * A fresh identifier, optionally prefixed for readability.
 *
 * Records used to be identified by `Date.now()` alone, sometimes with a prefix:
 * `whisper-1757160000123`. Two of anything created in the same millisecond
 * therefore shared an identifier - and the two of you are on separate devices
 * doing things at once, which is the entire point of the app. Drawing together
 * on the shared canvas is the obvious way to hit it, but a fast double tap on
 * one device does just as well.
 *
 * The relay itself was never at risk: it puts a UUID on every record it sends.
 * The damage was local, where roughly twenty places delete or update an item by
 * matching `x.id !== id`. Two items sharing an identifier means removing one
 * removes both, and React quietly renders duplicate keys wrong in the meantime.
 *
 * Sixty-four bits of randomness, hex encoded. At a million records the chance of
 * any two colliding is about three in a hundred million, and the sixteen
 * characters cost a third of what a UUID would in a store already tight on
 * space.
 */
export function newId(prefix?: string): string {
  const token = randomToken();
  return prefix ? `${prefix}-${token}` : token;
}

function randomToken(): string {
  try {
    const bytes = new Uint8Array(new ArrayBuffer(8));
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // No Web Crypto at all is not a situation this app can really be in - it
    // derives its keys with it - but an id is not a secret, and returning
    // something unique matters more here than returning something unguessable.
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }
}
