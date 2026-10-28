import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketRelayClient, MAX_REACHED_ENTRIES, reachedByTime, readReached } from './ws';
import { encryptText } from './crypto';
import { getDeviceId, type SpaceCredentials } from './space';

// Just enough of a WebSocket for the relay client: what it sends is kept, and
// the test says when it opens and what arrives.
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const SPACE = 'ab12cd34';

async function makeCreds(role: 'user' | 'partner' = 'user'): Promise<SpaceCredentials> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { spaceId: SPACE, key, role };
}

/** Waits for the client's own asynchronous work: encrypting, decrypting. */
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise(r => setTimeout(r, 5));
  expect(check()).toBe(true);
}

async function connected(role: 'user' | 'partner' = 'user') {
  const creds = await makeCreds(role);
  const client = new WebSocketRelayClient();
  const heard: any[] = [];
  client.subscribe(m => heard.push(m));
  client.connect(creds);
  const socket = FakeSocket.all[FakeSocket.all.length - 1];
  socket.open();
  return { client, creds, socket, heard };
}

/** Lets every inbound message already handed over be handled. */
const settled = (client: WebSocketRelayClient) => (client as unknown as { inboundChain: Promise<void> }).inboundChain;

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  // resolveRelayUrl reads this before it would look at window.location.
  localStorage.setItem('two_custom_relay_url', 'ws://relay.test/relay');
});

describe('readReached', () => {
  it('keeps entries with an id and a time, and drops the rest', () => {
    expect(
      readReached([
        { id: 'r1', at: 10 },
        { id: '', at: 10 },
        { id: 'x'.repeat(65), at: 10 },
        { id: 'r2', at: 'soon' },
        { id: 7, at: 10 },
        null,
        { id: 'r3', at: '20' }
      ])
    ).toEqual([
      { id: 'r1', at: 10 },
      { id: 'r3', at: 20 }
    ]);
  });

  it('takes anything but a list, or a list longer than the relay sends, as nothing', () => {
    expect(readReached(undefined)).toEqual([]);
    expect(readReached({ id: 'r1', at: 1 })).toEqual([]);
    const tooMany = Array.from({ length: MAX_REACHED_ENTRIES + 1 }, (_, i) => ({ id: `r${i}`, at: i }));
    expect(readReached(tooMany)).toEqual([]);
    expect(readReached(tooMany.slice(1))).toHaveLength(MAX_REACHED_ENTRIES);
  });

  it('groups by time, one applyDelivered each', () => {
    const byTime = reachedByTime([
      { id: 'm1', at: 5 },
      { id: 'm2', at: 9 },
      { id: 'm3', at: 5 }
    ]);
    expect([...byTime.entries()]).toEqual([
      [5, ['m1', 'm3']],
      [9, ['m2']]
    ]);
    expect(reachedByTime('nonsense').size).toBe(0);
  });
});

describe('REACHED: our messages on her phone while Two was closed there', () => {
  it('asks for the ones after the last it heard when it joins', async () => {
    const first = await connected();
    expect(first.socket.sent[0]).toMatchObject({ type: 'JOIN', reachedSince: 0 });
    first.socket.receive({ type: 'REACHED', reached: [{ id: 'not-ours', at: 1_730_000_000_000 }] });
    await settled(first.client);
    // Kept even though nothing mapped: the same ones are not asked for again.
    expect(localStorage.getItem(`two_relay_reached_${SPACE}`)).toBe('1730000000000');
    first.client.disconnect();

    const again = await connected();
    expect(again.socket.sent[0]).toMatchObject({ type: 'JOIN', reachedSince: 1_730_000_000_000 });
    again.client.disconnect();
  });

  it('turns the record id back into the message id it was sent with', async () => {
    const { client, socket, heard } = await connected();
    client.broadcastUpdate('CHAT', { id: 'msg-1', text: 'hi' }, 'msg-1');
    await until(() => socket.sent.some(m => m.type === 'RECORD'));
    const recordId = socket.sent.find(m => m.type === 'RECORD').record.id;

    // Before the relay's acknowledgement: her phone can be quicker.
    socket.receive({ type: 'REACHED', reached: [{ id: recordId, at: 2_000 }, { id: 'someone-elses', at: 3_000 }] });
    await settled(client);
    expect(heard.filter(m => m.type === 'REACHED')).toEqual([{ type: 'REACHED', reached: [{ id: 'msg-1', at: 2_000 }] }]);
    // The cursor is the newest time, mapped or not; it never goes back.
    expect(localStorage.getItem(`two_relay_reached_${SPACE}`)).toBe('3000');
    socket.receive({ type: 'REACHED', reached: [{ id: 'old', at: 1_000 }] });
    await settled(client);
    expect(localStorage.getItem(`two_relay_reached_${SPACE}`)).toBe('3000');

    // Kept across a reload: written when it was sent.
    expect(JSON.parse(localStorage.getItem(`two_relay_sent_${SPACE}`) || '[]')).toEqual([[recordId, 'msg-1']]);
    client.disconnect();
  });

  it('remembers only chat messages, not the rest of what is sent', async () => {
    const { client, socket } = await connected();
    client.broadcastUpdate('WEATHER', { id: 'w1' }, 'w1');
    client.broadcastUpdate('CHAT', { id: 'c1' });
    await until(() => socket.sent.filter(m => m.type === 'RECORD').length === 2);
    expect(localStorage.getItem(`two_relay_sent_${SPACE}`)).toBeNull();
    client.disconnect();
  });

  it('knows my own messages from my other device, and not hers', async () => {
    const { client, creds, socket, heard } = await connected('user');
    const arriving = async (id: string, authorId: string, messageId: string) => {
      const { ciphertext, nonce } = await encryptText(JSON.stringify({ id: messageId }), creds.key, id, SPACE, 'CHAT');
      socket.receive({
        type: 'REMOTE_RECORD',
        record: { id, spaceId: SPACE, authorId, type: 'CHAT', payload: ciphertext, nonce, lamportClock: 5, seq: 1 }
      });
    };
    await arriving('rec-mine', 'user', 'msg-from-tablet');
    await arriving('rec-hers', 'partner', 'msg-from-her');
    await settled(client);

    socket.receive({ type: 'REACHED', reached: [{ id: 'rec-mine', at: 50 }, { id: 'rec-hers', at: 50 }] });
    await settled(client);
    expect(heard.filter(m => m.type === 'REACHED')).toEqual([
      { type: 'REACHED', reached: [{ id: 'msg-from-tablet', at: 50 }] }
    ]);
    client.disconnect();
  });

  it('is forgotten with the room', async () => {
    const { client, socket } = await connected();
    client.broadcastUpdate('CHAT', { id: 'msg-1' }, 'msg-1');
    await until(() => socket.sent.some(m => m.type === 'RECORD'));
    socket.receive({ type: 'REACHED', reached: [{ id: 'x', at: 9 }] });
    await settled(client);
    client.forgetPersisted();
    expect(localStorage.getItem(`two_relay_sent_${SPACE}`)).toBeNull();
    expect(localStorage.getItem(`two_relay_reached_${SPACE}`)).toBeNull();
    client.disconnect();
  });
});

describe('roomDetails: what the phone keeps outside the PIN vault', () => {
  it('is nothing without a room', () => {
    expect(new WebSocketRelayClient().roomDetails()).toBeNull();
  });

  it('is the room id, this device, its seat and how far it has read - never the key', async () => {
    const { client } = await connected('partner');
    localStorage.setItem(`two_relay_seen_${SPACE}`, '1730000000000');
    localStorage.setItem(`two_relay_seq_${SPACE}`, '42');
    const room = client.roomDetails();
    expect(room).toEqual({
      spaceId: SPACE,
      deviceId: getDeviceId(),
      seat: 'partner',
      since: 1_730_000_000_000,
      sinceSeq: 42
    });
    expect(Object.keys(room || {}).sort()).toEqual(['deviceId', 'seat', 'since', 'sinceSeq', 'spaceId']);
    expect(Object.values(room || {}).some(v => typeof v === 'object')).toBe(false);
    client.disconnect();
    expect(client.roomDetails()).toBeNull();
  });
});
