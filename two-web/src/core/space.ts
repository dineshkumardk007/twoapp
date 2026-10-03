// Space identity & key derivation for Two.
//
// A couple's entire connection is bootstrapped from ONE shared secret: the
// pairing code. From it we deterministically derive both
//
//   * spaceId  - the relay room name (public; the server sees this)
//   * spaceKey - the AES-GCM key protecting every record (private; never sent)
//
// Because both are derived client-side from the same code, two devices that
// type the same words land in the same room holding the same key, and the
// relay operator only ever sees an opaque room id and ciphertext.

import { BIP39_WORDS } from './crypto';

const SESSION_KEY = 'two_space_session_v1';

// 8 words from the wordlist. Brute-forcing this offline means paying the
// PBKDF2 cost below for every guess.
const PAIRING_WORD_COUNT = 8;
const PBKDF2_ITERATIONS = 210_000;

const SALT_SPACE_ID = 'two.space.id.v1';
const SALT_SPACE_KEY = 'two.space.key.v1';

/** Which side of the pair this device represents. Drives `authorId` on the wire. */
export type SpaceRole = 'user' | 'partner';

export interface SpaceSession {
  /** The shared pairing code, normalised to `TWO-XXXX` or words. */
  code: string;
  /**
   * Words the couple speak aloud, never sent anywhere.
   *
   * An invite carries the pairing code through the server, so the code alone no
   * longer keeps the operator out. Mixing this into the content key does: the
   * server can see the room and the ciphertext, but cannot derive the key
   * without words that were only ever spoken.
   */
  joinPhrase?: string;
  role: SpaceRole;
  userName?: string;
  partnerName?: string;
}

export interface SpaceCredentials {
  spaceId: string;
  key: CryptoKey;
  role: SpaceRole;
  /**
   * What this connection calls itself when authoring records.
   *
   * A couple has two seats, so the role is a usable author label. A group has
   * one seat that everybody sits in, which made every member's records look
   * like they came from the same author - and the relay skips replaying a
   * space's history back to its own author, so a new member was replayed
   * nothing at all. Groups pass their device id here instead.
   */
  authorLabel?: string;
}

// Ambiguity is the enemy of a code you read aloud over the phone, so 0/O, 1/I/L
// and U are all absent. 30 symbols -> just under 5 bits each.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12; // ~58.9 bits
const CODE_GROUP = 4;

const JOIN_PHRASE_WORDS = 4; // ~31 bits from the 220-word list

/** Four words that are easy to say down a phone line and hard to guess. */
export function generateJoinPhrase(): string {
  const picks = new Uint32Array(JOIN_PHRASE_WORDS);
  window.crypto.getRandomValues(picks);

  const words: string[] = [];
  for (let i = 0; i < JOIN_PHRASE_WORDS; i++) {
    words.push(BIP39_WORDS[picks[i] % BIP39_WORDS.length]);
  }
  return words.join(' ');
}

/** Every word the phrase may be built from, for checking what was typed. */
const JOIN_PHRASE_WORDS_SET = new Set(BIP39_WORDS.map(w => w.toLowerCase()));

export interface JoinPhraseCheck {
  words: string[];
  /** Words that are not in the list - almost always a mistyping. */
  unknown: string[];
  /** True when this is usable: the right number of words, all of them real. */
  complete: boolean;
}

/**
 * Inspects a typed phrase so the interface can object before it is too late.
 *
 * A wrong phrase does not fail loudly - it derives a different room, and the
 * two of you simply never see each other. Catching a bad word while it is being
 * typed is the difference between "that word is not one of them" and an evening
 * spent wondering why the app is broken.
 */
export function checkJoinPhrase(raw: string): JoinPhraseCheck {
  const words = normalizeJoinPhrase(raw).split(' ').filter(Boolean);
  const unknown = words.filter(w => !JOIN_PHRASE_WORDS_SET.has(w));
  return {
    words,
    unknown,
    complete: words.length === JOIN_PHRASE_WORDS && unknown.length === 0
  };
}

/** Forgiving about spacing, case and punctuation, so speaking it works. */
export function normalizeJoinPhrase(raw: string): string {
  return raw.toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ');
}

/**
 * Draws an unbiased index into CODE_ALPHABET.
 *
 * `% alphabet.length` on a random byte would quietly favour the first few
 * symbols (256 is not a multiple of 30), so values landing in the short tail
 * are rejected and redrawn.
 */
function randomSymbol(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  const buf = new Uint8Array(1);
  for (;;) {
    window.crypto.getRandomValues(buf);
    if (buf[0] < limit) return CODE_ALPHABET[buf[0] % CODE_ALPHABET.length];
  }
}

/**
 * Generates a fresh pairing code, e.g. `TWO-7K2M-9XQP-R4TN`.
 *
 * The code is the ONLY secret protecting a space: both the room id and the
 * AES key derive from it, so its entropy is the ceiling on the whole system's
 * security. At 12 symbols the keyspace is ~5.8e17, which combined with the
 * PBKDF2 cost below puts an offline sweep far out of reach. Math.random() is
 * unsuitable here at any length - it is predictable, not merely short.
 */
export function generatePairingCode(): string {
  let symbols = '';
  for (let i = 0; i < CODE_LENGTH; i++) symbols += randomSymbol();

  const groups: string[] = [];
  for (let i = 0; i < symbols.length; i += CODE_GROUP) {
    groups.push(symbols.slice(i, i + CODE_GROUP));
  }
  return `TWO-${groups.join('-')}`;
}

/**
 * True for codes from the old `PREFIX-NNNN` scheme (~16 bits), whose entire
 * keyspace can be swept in minutes. Such a space should be re-paired.
 */
export function isWeakPairingCode(raw: string): boolean {
  const symbols = normalizePairingCode(raw).replace(/-/g, '');
  return symbols.length < 12;
}

/**
 * Accepts whatever the joining partner typed and reduces it to canonical form,
 * so "two 8492", "TWO-8492" and "two-8492" derive the same space.
 */
/**
 * Shapes a code as it is typed: upper case, grouped, dashes supplied for you.
 *
 * A phone keyboard offers lower case and hides the dash behind a symbols page,
 * so entering a code meant three deliberate detours per attempt.
 *
 * The shape is not cosmetic. normalizePairingCode turns each run of
 * punctuation into a single dash and the key is derived from that string, so
 * TWO-ABCD-EFGH-IJKL and TWOABCDEFGHIJKL are different codes deriving
 * different rooms. Rebuilding the canonical grouping here is what stops a
 * pasted code, a spoken one and a typed one from landing in three rooms.
 */
export function formatCodeInput(raw: string): string {
  const symbols = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Someone part-way through typing the prefix is left alone. Formatting "T"
  // as "TWO-T" would mean their next two keystrokes produced "TWO-TWO".
  if ('TWO'.startsWith(symbols)) return symbols;

  const body = (symbols.startsWith('TWO') ? symbols.slice(3) : symbols).slice(0, CODE_LENGTH);
  if (!body) return 'TWO';

  const groups = body.match(new RegExp(`.{1,${CODE_GROUP}}`, 'g')) || [];
  return `TWO-${groups.join('-')}`;
}

export function normalizePairingCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
}

export function isPlausiblePairingCode(raw: string): boolean {
  return extractPairingCode(raw) !== null;
}

/** One symbol of a current code, as a character class: CODE_ALPHABET exactly. */
const CODE_SYMBOL = '[2-9A-HJKMNP-TV-Z]';

/** The prefixes the short legacy codes were made with, always followed by four digits. */
const LEGACY_PREFIXES = ['TWO', 'LOVE', 'HEART', 'MOON', 'SOUL', 'STAR', 'DEAR', 'EDEN'];

/**
 * A current-format code anywhere in `raw`, canonically grouped - or null.
 *
 * Finds it inside whatever was pasted: "Send to Partner" shares a whole
 * sentence, and a phone pastes all of it. Separators are optional, so a code
 * typed without its dashes is found too.
 *
 * Only the symbols a code can contain are matched. Without that, a group
 * invite for "Two Moms Book Club" offered TWO-MOMS-BOOK-CLUB before the real
 * code; with it, O, I, L, U, 0 and 1 rule such words out. Where several still
 * match, the last is taken, because an invite names the group first and gives
 * the code after it.
 *
 * No lookbehind: Safari before 16.4 cannot parse one, and the join screen
 * calls this while it renders.
 */
export function findTwoCode(raw: string): string | null {
  const pattern = new RegExp(
    `(?:^|[^A-Z0-9])TWO[\\s_-]*(${CODE_SYMBOL}{4})[\\s_-]*(${CODE_SYMBOL}{4})[\\s_-]*(${CODE_SYMBOL}{4})(?![A-Z0-9])`,
    'g'
  );
  let found: string | null = null;
  for (const match of (raw || '').toUpperCase().matchAll(pattern)) {
    found = `TWO-${match[1]}-${match[2]}-${match[3]}`;
  }
  return found;
}

/**
 * The pairing code in what somebody typed or pasted, or null if there is none.
 *
 * Getting this wrong never fails loudly. The room is derived from the exact
 * string, so a pasted sentence ("Hey, here is our link code for Two: TWO-...")
 * became a room named after the sentence, and a code typed without its dashes
 * became a different room from the same code with them. Both were accepted,
 * and both left the two of you in separate empty rooms with nothing on screen
 * to say why.
 *
 * So only the shapes a code has ever had are accepted, each returned in the
 * exact form it was made in - which is the form its room was derived from:
 *
 *   - current codes, TWO-XXXX-XXXX-XXXX, found anywhere in the text, and also
 *     without the TWO, since that part never changes and is easy to leave off;
 *   - short legacy codes, a word from LEGACY_PREFIXES and four digits;
 *   - legacy eight-word codes, every word from the code word list.
 *
 * Everything else - a sentence, a code with symbols missing or extra, a 0
 * typed for an O - is refused, rather than becoming a room nobody else is in.
 */
export function extractPairingCode(raw: string): string | null {
  const modern = findTwoCode(raw);
  if (modern) return modern;

  const trimmed = (raw || '').trim();
  // A code is letters and digits in groups. Punctuation means a sentence.
  if (!/^[A-Za-z0-9]+([\s_-]+[A-Za-z0-9]+)*$/.test(trimmed)) return null;
  const upper = trimmed.toUpperCase();
  const symbols = upper.replace(/[\s_-]/g, '');

  // A current code with its constant TWO left off.
  if (new RegExp(`^${CODE_SYMBOL}{12}$`).test(symbols)) {
    return `TWO-${symbols.slice(0, 4)}-${symbols.slice(4, 8)}-${symbols.slice(8, 12)}`;
  }

  // PREFIX-NNNN, the form the short legacy generator always produced.
  const short = symbols.match(/^([A-Z]+)([0-9]{4})$/);
  if (short && LEGACY_PREFIXES.includes(short[1])) return `${short[1]}-${short[2]}`;

  // Eight words from the list, dash-joined: the legacy word code.
  const words = upper.split(/[\s_-]+/).filter(Boolean);
  if (words.length === PAIRING_WORD_COUNT && words.every(w => CODE_WORDS.has(w))) {
    return words.join('-');
  }

  return null;
}

/** The code word list, upper case, for recognising legacy word codes. */
const CODE_WORDS = new Set(BIP39_WORDS.map(w => w.toUpperCase()));

async function importCodeMaterial(code: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

/**
 * Derives the room id and content key from the pairing code.
 *
 * The two derivations use different salts, so the spaceId the server learns
 * reveals nothing usable about the key that protects the content.
 */
export async function deriveSpaceCredentials(
  rawCode: string,
  role: SpaceRole,
  rawJoinPhrase?: string
): Promise<SpaceCredentials> {
  const code = normalizePairingCode(rawCode);
  const phrase = normalizeJoinPhrase(rawJoinPhrase || '');
  const enc = new TextEncoder();

  // The phrase folds into BOTH the room and the key.
  //
  // It used to fold into the key alone, so the room was found from the code by
  // itself. That protected what was said but not the fact of saying it: anyone
  // holding the code still joined, still received every encrypted record, and
  // still occupied a socket in the count. Putting the phrase in the room id
  // means a wrong phrase is a different room, and someone with only the code
  // cannot reach you at all.
  //
  // The cost is that a mismatch is silent - two people who type it differently
  // sit in separate rooms with nothing to tell them why - which is why the
  // phrase is generated rather than invented, and why every word is checked
  // against the list before it is ever used.
  //
  // An empty phrase must reproduce the original derivation byte for byte, or
  // every space created before this change would move rooms and lose its
  // history.
  const material = phrase
    ? await importCodeMaterial(`${code}::${phrase}`)
    : await importCodeMaterial(code);

  const idMaterial = material;
  const keyMaterial = material;

  const idBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_SPACE_ID),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    idMaterial,
    128
  );

  const spaceId = Array.from(new Uint8Array(idBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_SPACE_KEY),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { spaceId, key, role };
}

/** The code alone, as earlier builds kept it. Read for compatibility, never written. */
const LEGACY_LAST_CODE_KEY = 'two_last_space_code_v1';
const LAST_SPACE_KEY = 'two_last_space_v2';

/** What this device needs to find its way back into the space it last left. */
export interface LastSpace {
  code: string;
  /** Unknown for a device last used before it was recorded. */
  role?: SpaceRole;
  joinPhrase?: string;
}

/**
 * The space to offer "Rejoin" for.
 *
 * Only the code used to be kept, and the code is not enough: the spoken phrase
 * is part of the room's address, and the role decides which seat this device
 * takes. Rejoining with the code alone landed in a different room whenever
 * there was a phrase, and in the creator's seat whenever the session was gone.
 */
export function getLastSpace(): LastSpace | null {
  try {
    const raw = localStorage.getItem(LAST_SPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LastSpace>;
      if (parsed && typeof parsed.code === 'string' && parsed.code) {
        return {
          code: parsed.code,
          role: parsed.role === 'user' || parsed.role === 'partner' ? parsed.role : undefined,
          joinPhrase: typeof parsed.joinPhrase === 'string' && parsed.joinPhrase ? parsed.joinPhrase : undefined
        };
      }
    }
    const legacy = localStorage.getItem(LEGACY_LAST_CODE_KEY);
    return legacy ? { code: legacy } : null;
  } catch {
    return null;
  }
}

/**
 * Forgets the space offered for rejoining, in both the current and old form.
 *
 * Exported for unlocking: a device that turned on a PIN under an older build
 * still has the code sitting in plain storage under the old key, and nothing
 * else would ever remove it.
 */
export function forgetLastSpace() {
  try {
    localStorage.removeItem(LAST_SPACE_KEY);
    localStorage.removeItem(LEGACY_LAST_CODE_KEY);
  } catch {
    /* storage unavailable; nothing was kept */
  }
}

const DEVICE_ID_KEY = 'two_device_id_v1';

/**
 * A stable random id for this device.
 *
 * The relay must route between two *devices*, which is not the same thing as
 * the couple's chosen roles: both partners can legitimately hold the role
 * 'user' (reinstalling and picking "I created this space", or both tapping
 * Rejoin). Routing on the role in that case makes the relay treat them as the
 * same participant and silently forward nothing. The role still labels who
 * wrote a record; only delivery keys off this id.
 */
/** A short human label for this device, so a roster entry is recognisable. */
export function describeThisDevice(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;

  const os =
    /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' :
    /Android/i.test(ua) ? 'Android' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS X/i.test(ua) ? 'Mac' :
    /Linux/i.test(ua) ? 'Linux' : 'Unknown';

  // Order matters: Edge and Opera both claim to be Chrome.
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\//i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'Browser';

  return `${browser} on ${os}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const bytes = new Uint8Array(new ArrayBuffer(16));
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Private mode: a per-session id still beats colliding on the role.
    return `eph-${Math.random().toString(36).slice(2)}`;
  }
}

export function loadSpaceSession(): SpaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SpaceSession>;
    if (!parsed.code || (parsed.role !== 'user' && parsed.role !== 'partner')) {
      return null;
    }
    return {
      code: parsed.code,
      role: parsed.role,
      userName: parsed.userName,
      partnerName: parsed.partnerName,
      joinPhrase: parsed.joinPhrase
    };
  } catch {
    return null;
  }
}

export function saveSpaceSession(session: SpaceSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session.code) {
      const last: LastSpace = {
        code: session.code,
        role: session.role,
        joinPhrase: session.joinPhrase || undefined
      };
      localStorage.setItem(LAST_SPACE_KEY, JSON.stringify(last));
      localStorage.removeItem(LEGACY_LAST_CODE_KEY);
    }
  } catch (e) {
    console.error('[Space] Could not persist session', e);
  }
}

/**
 * Removes the stored session - and, unless told to keep it, the record that
 * offers to rejoin.
 *
 * Every caller but one is getting rid of the code on purpose: the panic
 * button, starting fresh, and turning on a PIN, which moves the session into
 * the encrypted vault precisely so the code is not sitting here in the clear.
 * All three left the rejoin record behind, so the code was still in plain
 * storage - and after the panic button the welcome screen offered it back to
 * whoever picked the phone up. Leaving a space is the one case that keeps it,
 * because offering a way back is the point.
 */
export function clearSpaceSession(options: { keepRejoin?: boolean } = {}) {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
  if (!options.keepRejoin) forgetLastSpace();
}
