// The line under her name in the chat's header: one fact at a time, the way a
// messenger has it - "online", "typing…", "last seen today at 4:45 pm".

import { tr } from './i18n';
import type { RelayStatus } from './ws';

export type PresenceKind = 'connecting' | 'offline' | 'typing' | 'online' | 'lastSeen' | 'none';

export interface PresenceFacts {
  /** This phone's own link to the relay. */
  relayStatus: RelayStatus;
  typing: boolean;
  online: boolean;
  /** formatLastSeen's words; '' when there is none to show. */
  lastSeen: string;
}

/**
 * What the line says, and which kind of fact it is (for its colour).
 *
 * While this phone is cut off, nothing it knows about her is current, so the
 * line says that and only that. With no last seen to show - either of you has
 * it off - the line is empty, as WhatsApp leaves it, and the name sits alone.
 */
export function presenceLine(f: PresenceFacts): { kind: PresenceKind; text: string } {
  if (f.relayStatus === 'connecting' || f.relayStatus === 'reconnecting') return { kind: 'connecting', text: tr('Connecting…') };
  if (f.relayStatus !== 'connected') return { kind: 'offline', text: tr('Offline') };
  if (f.typing) return { kind: 'typing', text: tr('typing…') };
  if (f.online) return { kind: 'online', text: tr('online') };
  if (f.lastSeen) return { kind: 'lastSeen', text: f.lastSeen };
  return { kind: 'none', text: '' };
}
