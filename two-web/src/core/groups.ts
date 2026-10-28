// Group spaces: the same room, opened by more than two people.
//
// A group is not a new kind of thing. It is a space, derived from a code and an
// optional spoken phrase exactly as a couple's space is, which is why this file
// is short: deriveSpaceCredentials already does the cryptography, and reusing it
// means a group is protected by the same key derivation that has been carrying
// the couple's messages all along.
//
// What a group does need is an identity per member. A couple's records are
// authored by a role - 'user' or 'partner' - and that binary is wired through
// hundreds of call sites. Rather than widen it, group records carry a member id
// of their own, so nothing about the couple's space changes to make room.

import { deriveSpaceCredentials, getDeviceId, SpaceCredentials } from './space';
import { newId } from './ids';

/** Ten people, which is what the dock and the read list are shaped for. */
export const MAX_GROUP_MEMBERS = 10;

/**
 * How much of a group's conversation one device keeps.
 *
 * Was 500, and dropped the oldest without a word, so a busy group quietly ate
 * its own history. Two thousand short messages is a few hundred kilobytes -
 * cheap enough that the limit is now about not growing without bound rather
 * than about saving space - and the chat says so once it is reached.
 */
export const MAX_GROUP_MESSAGES = 2000;

/**
 * The point past which the roster stops growing at all.
 *
 * Not a product limit - a guard. Everyone holding the code can announce
 * themselves, so without a ceiling the member list is a list anybody in the
 * room can lengthen indefinitely.
 */
export const HARD_CEILING = 40;

/** True when a group holds more people than it is meant to. */
export function isOverCapacity(members: GroupMember[]): boolean {
  return members.length > MAX_GROUP_MEMBERS;
}

export interface GroupMember {
  /**
   * The member's device id.
   *
   * Stable per device and already generated for every install. Two devices
   * belonging to the same person are two members here, which is honest: the
   * relay counts sockets, not people.
   */
  id: string;
  /** The name they entered when they set the app up. Self-reported, unverified. */
  name: string;
  /** Server-independent: when we last had word from them. */
  lastSeen: number;
  /** Newest message this member has confirmed reading, by sentAt. */
  readUpTo: number;
}

export interface GroupMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  sentAt: number;
  /**
   * False until the relay acknowledges it; absent on anything received, and on
   * anything sent before this field existed.
   *
   * Only `false` means "still going". A message from before the field was
   * added has no value here and must not be shown as though it were stuck, so
   * every reader tests for `=== false` rather than for falsiness.
   */
  delivered?: boolean;
  /**
   * A voice note: the recording travels inside the message, as in the
   * couple's chat (see core/voice.ts), and `text` carries its label
   * ("Voice note · 0:12") for the notification and for a phone on an older
   * version.
   */
  isVoiceMemo?: boolean;
  audioDataUrl?: string;
  audioDurationSeconds?: number;
  /** The note's waveform, 0-100 each. */
  audioPeaks?: number[];
  /**
   * This device has played the voice note. Local only: a group has no
   * per-note receipts, so it is never sent and never taken from the wire -
   * it only clears the "new" dot and decides what plays next by itself.
   */
  heard?: boolean;
  /**
   * The relay's id for the record it travelled in. Local: learnt from the
   * record on arrival, and from the relay's acknowledgement for your own. A
   * phone that got the message on a version before `mid` filed it under this,
   * so every change names it too (core/groupActions).
   */
  rid?: string;
  /**
   * Sent by this phone with its id inside (`mid`), so every phone holds it
   * under the same one and it can be changed or taken back. Local, never
   * read from the wire: your messages from before have no such id elsewhere.
   */
  sharedId?: true;
  /** The message it answers. */
  replyTo?: GroupReplyRef;
  /** Member id to emoji: one from each member, set or taken off by them. */
  reactions?: Record<string, string>;
  /** When its author last changed its words, on the author's clock. */
  editedAt?: number;
  /** Taken back by its author: a line that says so stays in its place. */
  unsent?: true;
  /** A photo: the picture travels inside the message, as in the couple's chat. */
  isPhoto?: true;
  photoDataUrl?: string;
  photoWidth?: number;
  photoHeight?: number;
  /**
   * When it arrived here, by this phone's clock, for its Info. Local: never
   * sent, and not for history being restored, which is not news.
   */
  receivedAt?: number;
  /**
   * On your own: when each member's read of it was heard here, member id to
   * time (stampGroupRead), for its Info. Local, never sent.
   */
  readTimes?: Record<string, number>;
}

/**
 * A reply's quote in a group. `rid` is the record id of what it answers, for
 * a phone that filed that message under it; the name is the author's as it
 * was then, for a member who has since gone quiet.
 */
export interface GroupReplyRef {
  id: string;
  rid?: string;
  authorId: string;
  authorName?: string;
  snippet: string;
}

export interface GroupSpace {
  /** Local identifier for this membership, not the room id. */
  id: string;
  /** What the group is called. Chosen by whoever created it. */
  name: string;
  /** The code that derives the room; the whole secret. */
  code: string;
  /** Optional spoken words, folded into the room and the key. */
  joinPhrase?: string;
  /** True for the device that created it. Only a founder names the group. */
  founder: boolean;
  /**
   * False on a device that joined and has not yet heard the founder say what
   * the group is called.
   *
   * Joining used to ask for a name, which meant the same room could be called
   * three different things on three phones. The creator's name is now the
   * group's name everywhere, and this marks the gap between joining and
   * learning it.
   */
  nameConfirmed: boolean;
  createdAt: number;
  members: GroupMember[];
  messages: GroupMessage[];
  /**
   * Messages deleted on this phone only, by id and by record id, to when:
   * kept so a replay or a reconnect cannot bring one back. Never sent.
   */
  deletedForMe?: Record<string, number>;
}

/**
 * Group records are authored by a member, never by a role.
 *
 * The relay stamps a record's author with the role the sender joined as, which
 * for a group is meaningless - everyone joins the same way. So the member id
 * travels inside the encrypted payload, where the relay cannot see it and
 * cannot get it wrong.
 */
export const GROUP_CHAT = 'GROUP_CHAT';
export const GROUP_HELLO = 'GROUP_HELLO';
export const GROUP_READ = 'GROUP_READ';
/**
 * What can happen to a group message after it is sent, each a record of its
 * own naming the message (core/groupActions), as in the couple's chat. A
 * phone on a version without them stores and passes them over.
 */
export const GROUP_CHAT_EDIT = 'GROUP_CHAT_EDIT';
export const GROUP_CHAT_UNSEND = 'GROUP_CHAT_UNSEND';
export const GROUP_CHAT_REACTION = 'GROUP_CHAT_REACTION';

/**
 * Everyone in a group joins in the same seat.
 *
 * deriveSpaceCredentials takes a role because a couple has two, and the role
 * decides nothing about the key - it is carried along to label what this device
 * authors. A group has no such distinction, so every member derives with the
 * same value and identifies itself by member id instead.
 */
export async function deriveGroupCredentials(
  code: string,
  joinPhrase?: string
): Promise<SpaceCredentials> {
  const creds = await deriveSpaceCredentials(code, 'user', joinPhrase);
  // Authorship is per device here, not per seat - see SpaceCredentials.
  return { ...creds, authorLabel: getDeviceId() };
}

export function newGroup(name: string, code: string, joinPhrase: string | undefined, founder: boolean): GroupSpace {
  return {
    id: newId('group'),
    name: name.trim().slice(0, 40) || (founder ? 'Our group' : 'Group'),
    nameConfirmed: founder,
    code,
    joinPhrase: joinPhrase || undefined,
    founder,
    createdAt: Date.now(),
    members: [],
    messages: []
  };
}

/** This device's own member id, shared with the couple space's device id. */
export function myMemberId(): string {
  return getDeviceId();
}

/**
 * Folds an announcement into the roster.
 *
 * Members are only ever learned from what they say about themselves, so this
 * is additive: nobody is removed because they went quiet, and a name changes
 * only when its owner sends a new one.
 */
export function withMember(
  members: GroupMember[],
  incoming: { id: string; name: string; at?: number }
): GroupMember[] {
  const at = incoming.at || Date.now();
  const existing = members.find(m => m.id === incoming.id);

  if (!existing) {
    // Deliberately not dropped at MAX_GROUP_MEMBERS.
    //
    // It used to be, which produced the worst of both worlds: an eleventh
    // person's messages appeared in the conversation while they were missing
    // from the roster, so the read list quietly stopped accounting for
    // everyone actually in the room. A group being over its intended size is
    // something to say out loud, not something to half-record. HARD_CEILING
    // is only there so a hostile room cannot grow this list without end.
    if (members.length >= HARD_CEILING) return members;
    return [...members, { id: incoming.id, name: incoming.name, lastSeen: at, readUpTo: 0 }];
  }

  return members.map(m =>
    m.id === incoming.id
      ? { ...m, name: incoming.name || m.name, lastSeen: Math.max(m.lastSeen, at) }
      : m
  );
}

/**
 * Your messages a member's read position has just moved past (`before` to
 * `upTo`), with when it was heard (`at`) kept for their Info - never before
 * the message was sent nor after now. Only on the move, so a message read
 * before this was kept gets no time. Null when none changes.
 */
export function stampGroupRead(
  messages: GroupMessage[],
  myId: string,
  readerId: string,
  before: number,
  upTo: number,
  at: number,
  now: number = Date.now()
): GroupMessage[] | null {
  if (!(upTo > before) || readerId === myId) return null;
  const t = Number.isFinite(at) && at > 0 ? at : now;
  let changed = false;
  const next = messages.map(m => {
    if (m.authorId !== myId || m.sentAt <= before || m.sentAt > upTo || m.readTimes?.[readerId]) return m;
    changed = true;
    return { ...m, readTimes: { ...m.readTimes, [readerId]: Math.min(now, Math.max(t, m.sentAt)) } };
  });
  return changed ? next : null;
}

/** Records that a member has read everything up to a moment. */
export function withRead(members: GroupMember[], memberId: string, upTo: number): GroupMember[] {
  return members.map(m =>
    m.id === memberId ? { ...m, readUpTo: Math.max(m.readUpTo, upTo), lastSeen: Math.max(m.lastSeen, upTo) } : m
  );
}

export interface ReadBreakdown {
  read: GroupMember[];
  unread: GroupMember[];
  /** True when every other member has read it - what the double tick means. */
  allRead: boolean;
}

/**
 * Who has read a given message, and who has not.
 *
 * The author is excluded from both lists: asking whether you have read your own
 * message is noise. A member who has never announced a read position simply
 * appears as unread, which is also what a member with receipts switched off
 * looks like - the two are indistinguishable from here, deliberately, because
 * the alternative is disclosing that somebody has them off.
 */
export function readBreakdown(
  members: GroupMember[],
  message: { authorId: string; sentAt: number }
): ReadBreakdown {
  const others = members.filter(m => m.id !== message.authorId);
  const read = others.filter(m => m.readUpTo >= message.sentAt);
  const unread = others.filter(m => m.readUpTo < message.sentAt);
  return { read, unread, allRead: others.length > 0 && unread.length === 0 };
}

/**
 * Messages this device has not read in a group.
 *
 * Derived from the read position it already publishes, so nothing has to be
 * counted as it arrives or reset when a group is opened - the same number the
 * others see for you is the number shown on the dock.
 */
export function unreadCount(group: GroupSpace, myId: string): number {
  const me = group.members.find(m => m.id === myId);
  const readUpTo = me?.readUpTo || 0;
  // One taken back is not there to read.
  return group.messages.filter(m => m.authorId !== myId && m.sentAt > readUpTo && !m.unsent).length;
}

/** How long since a beat still counts as being here. */
export const MEMBER_ONLINE_MS = 75_000;

/** Members other than this device that are here right now. */
export function membersOnline(group: GroupSpace, myId: string, now = Date.now()): GroupMember[] {
  return group.members.filter(m => m.id !== myId && now - m.lastSeen < MEMBER_ONLINE_MS);
}
