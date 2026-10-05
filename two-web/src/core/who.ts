// Who wrote something, as this phone should say it.
//
// Records carry the seat of whoever made them ('user' or 'partner'), and that
// is all a name should be worked out from - on the phone showing it. A name
// worked out on the phone that wrote it ("You", "Partner") is right there
// and wrong everywhere else: the other phone would read "From You" on a
// letter it never wrote.

/**
 * 'You' for this phone's own seat, the partner's name for the other one.
 *
 * `author` is the seat stored on the record. Records from before the seat was
 * stored fall back to `storedName`, the name they were saved with.
 */
export function who(
  author: string | undefined | null,
  activeUser: string,
  partnerName?: string | null,
  storedName?: string
): string {
  const partner = partnerName?.trim() || 'Partner';
  if (author === activeUser) return 'You';
  if (author === 'user' || author === 'partner') return partner;
  return storedName?.trim() || partner;
}

/** The possessive form: "Your", "Priya's". */
export function whose(
  author: string | undefined | null,
  activeUser: string,
  partnerName?: string | null,
  storedName?: string
): string {
  const name = who(author, activeUser, partnerName, storedName);
  return name === 'You' ? 'Your' : `${name}'s`;
}
