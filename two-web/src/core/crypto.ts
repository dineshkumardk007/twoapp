// Web Crypto API implementation for Two

export const BIP39_WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
  "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
  "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
  "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
  "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
  "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake",
  "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon", "badge",
  "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain",
  "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
  "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit",
  "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology",
  "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless",
  "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
  "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss",
  "bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread"
];

const EMOJI_SET = [
  "🌸", "🌿", "🌙", "🌊", "✨", "☕", "🏔️", "🕊️",
  "🕯️", "🍁", "🦊", "🪐", "🌻", "⛵", "🎨", "🌲"
];

export function generate12WordPhrase(): string[] {
  const result: string[] = [];
  const array = new Uint32Array(12);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    result.push(BIP39_WORDS[array[i] % BIP39_WORDS.length]);
  }
  return result;
}

export async function computeSafetyNumber(keyA: string, keyB: string) {
  const sorted = [keyA, keyB].sort().join("::");
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", enc.encode(sorted));
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 12 Words
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = (hashArray[i * 2] * 256 + hashArray[i * 2 + 1]) % BIP39_WORDS.length;
    words.push(BIP39_WORDS[idx]);
  }

  // 4 Emojis
  const emojis = [
    EMOJI_SET[hashArray[28] % EMOJI_SET.length],
    EMOJI_SET[hashArray[29] % EMOJI_SET.length],
    EMOJI_SET[hashArray[30] % EMOJI_SET.length],
    EMOJI_SET[hashArray[31] % EMOJI_SET.length],
  ].join(" ");

  const hexDisplay = hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join("-");

  return { words, emojis, hexDisplay };
}

export async function deriveKeyFromPassphrase(passphrase: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(
  text: string,
  key: CryptoKey,
  recordId: string,
  spaceId: string,
  recordType: string
): Promise<{ ciphertext: string; nonce: string }> {
  const enc = new TextEncoder();
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));
  const aad = enc.encode(`${recordId}|${spaceId}|${recordType}`);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: aad
    },
    key,
    enc.encode(text)
  );

  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  const nonceBase64 = btoa(String.fromCharCode(...nonce));

  return { ciphertext, nonce: nonceBase64 };
}

export async function decryptText(
  ciphertextBase64: string,
  nonceBase64: string,
  key: CryptoKey,
  recordId: string,
  spaceId: string,
  recordType: string
): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const nonce = Uint8Array.from(atob(nonceBase64), c => c.charCodeAt(0));
  const aad = enc.encode(`${recordId}|${spaceId}|${recordType}`);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: aad
    },
    key,
    ciphertext
  );

  return dec.decode(decryptedBuffer);
}
