// One live connection per group, held alongside the couple's.
//
// The couple's space keeps the wsRelay singleton exactly as it was - same
// object, same code path, nothing rerouted through here - because a group
// feature must not be able to break the conversation the app exists for. This
// module owns only the extra connections.

import {
  WebSocketRelayClient,
  registerRelayClient,
  unregisterRelayClient,
  RelayStatus
} from './ws';
import { deriveGroupCredentials, GroupSpace } from './groups';

interface LiveGroup {
  client: WebSocketRelayClient;
  /** The code and phrase this connection was opened for. */
  code: string;
  joinPhrase: string;
}

const live = new Map<string, LiveGroup>();

/** Status per group, so the UI can say which one is still connecting. */
const statuses = new Map<string, RelayStatus>();
type StatusListener = (groupId: string, status: RelayStatus) => void;
const statusListeners = new Set<StatusListener>();

export function subscribeGroupStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  statuses.forEach((status, groupId) => listener(groupId, status));
  return () => {
    statusListeners.delete(listener);
  };
}

export function groupStatus(groupId: string): RelayStatus {
  return statuses.get(groupId) || 'idle';
}

/**
 * Opens - or re-opens - the connection for one group.
 *
 * Deriving the key is asynchronous and a group's code can change underneath
 * us, so the credentials are checked against the group still being wanted
 * before the socket is opened. Without that, editing a group twice quickly
 * could leave the older derivation winning.
 */
export async function connectGroup(
  group: GroupSpace,
  onMessage: (groupId: string, msg: any) => void
): Promise<void> {
  const phrase = group.joinPhrase || '';
  const existing = live.get(group.id);

  // Already connected on the same code and phrase: nothing to do.
  if (existing && existing.code === group.code && existing.joinPhrase === phrase) return;

  if (existing) disconnectGroup(group.id);

  const client = new WebSocketRelayClient();
  live.set(group.id, { client, code: group.code, joinPhrase: phrase });
  registerRelayClient(client);

  client.subscribe(msg => onMessage(group.id, msg));
  client.subscribeStatus(status => {
    statuses.set(group.id, status);
    statusListeners.forEach(l => {
      try {
        l(group.id, status);
      } catch {
        /* one listener must not stop the rest */
      }
    });
  });

  const creds = await deriveGroupCredentials(group.code, group.joinPhrase);

  // The group may have been left, or re-pointed at another code, while the
  // key was being derived.
  const current = live.get(group.id);
  if (!current || current.client !== client) return;

  client.connect(creds);
}

export function disconnectGroup(groupId: string) {
  const entry = live.get(groupId);
  if (!entry) return;
  live.delete(groupId);
  statuses.delete(groupId);
  unregisterRelayClient(entry.client);
  try {
    entry.client.disconnect();
  } catch {
    /* already gone */
  }
}

/** Closes every group connection. Used when the app locks or wipes. */
export function disconnectAllGroups() {
  [...live.keys()].forEach(disconnectGroup);
}

/** The client for a group, or null when it is not connected. */
export function groupClient(groupId: string): WebSocketRelayClient | null {
  return live.get(groupId)?.client || null;
}

/** Encrypted broadcast into one group. Silently ignored when not connected. */
export function sendToGroup(groupId: string, type: string, data: any) {
  live.get(groupId)?.client.broadcastUpdate(type, data);
}

/** Transient signal into one group - typing, and nothing stored. */
export function signalToGroup(groupId: string, type: string, data: any) {
  live.get(groupId)?.client.sendSignal(type, data);
}
