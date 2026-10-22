// Web addresses and phone numbers in a message, made tappable.
//
// Messages were plain text: an address had to be copied out of the menu and
// pasted into a browser, and a number typed into the dialer by hand. Now a
// tap opens it - the address in the browser, the number in the phone's dialer
// (which only fills it in; nothing is called until you press call).
//
// Nothing is fetched to show a preview: a preview means both phones asking
// the website for the page, which tells it who is reading the link.

export interface TextPart {
  text: string;
  /** Where a tap goes; absent for plain words. */
  href?: string;
}

// An address: http(s):// or www., up to the next space or bracket.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
// A phone number: 10 to 13 digits, optionally with + and spaces or dashes
// between groups, standing on its own.
const PHONE_RE = /(?<![\w+])\+?\d(?:[ -]?\d){9,12}(?![\w])/g;

/** Punctuation that ends a sentence rather than an address. */
const TRAILING = /[.,!?;:'"]+$/;

function trimAddress(raw: string): string {
  let url = raw.replace(TRAILING, '');
  // A closing bracket belongs to the address only when it opened one.
  while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
    url = url.slice(0, -1).replace(TRAILING, '');
  }
  return url;
}

/** The message's words, with each address and phone number as its own part. */
export function linkParts(text: string): TextPart[] {
  if (!text) return [{ text: '' }];
  const found: { start: number; end: number; href: string }[] = [];

  for (const m of text.matchAll(URL_RE)) {
    const url = trimAddress(m[0]);
    if (url.length < 5) continue;
    const start = m.index ?? 0;
    found.push({ start, end: start + url.length, href: /^www\./i.test(url) ? `https://${url}` : url });
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // Inside an address already found (a number in a link) stays part of it.
    if (found.some(f => start < f.end && end > f.start)) continue;
    const digits = m[0].replace(/[ -]/g, '');
    const count = digits.replace('+', '').length;
    if (count < 10 || count > 13) continue;
    found.push({ start, end, href: `tel:${digits}` });
  }

  if (!found.length) return [{ text }];
  found.sort((a, b) => a.start - b.start);
  const parts: TextPart[] = [];
  let at = 0;
  for (const f of found) {
    if (f.start < at) continue;
    if (f.start > at) parts.push({ text: text.slice(at, f.start) });
    parts.push({ text: text.slice(f.start, f.end), href: f.href });
    at = f.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
