// Voice calls with everyone in a group.
//
// Every phone in the call talks straight to every other phone - a mesh - so
// there is no call server and the voices stay end-to-end encrypted, exactly
// as in the couple's calls (core/call). The cost is that each phone sends its
// voice once for each other person, which is why a call holds at most
// MAX_IN_CALL people: past that an ordinary phone on mobile data cannot keep
// up, and everyone's sound suffers.
//
// Setting up rides the group's own encrypted SIGNAL channel, the one that
// carries "typing": nothing is stored, nothing replayed. Who is in a call is
// known from a "here" each phone in it repeats every few seconds - the same
// beat lets a phone that missed the ring show "Join", and lets two phones
// that have not met yet in the call find each other. Of each pair, the phone
// with the smaller id makes the offer, so two never cross.

import { playSound, type Playing } from './sounds';
import { headsetConnected, keepAlive, loudness, preferRed, routeAudio, steadyPlayout, tuneOpus } from './call';
import { noiseReductionOn } from './callNet';

/** The signal type every group call message travels under. */
export const GROUP_CALL_SIGNAL = 'GCALL';

/** The most people in one call, you included. */
export const MAX_IN_CALL = 6;

/** How often each phone in a call says it is there. */
const HERE_EVERY_MS = 4_000;
/** Not heard from for this long: no longer in the call. */
const GONE_AFTER_MS = 13_000;
/** A ring nobody answers stops after this; a call nobody joins ends after it. */
const RING_MS = 45_000;
/** How long the end is shown before the screen goes. */
const ENDED_LINGER_MS = 2_200;
/**
 * Each voice, in kbps. Lower than the couple's call because it is sent once
 * per person: five of them at this rate is still less than a phone's upload
 * on mobile data, and Opus at forty is a clear voice.
 */
const KBPS_EACH = 40;

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export type GroupCallPhase = 'idle' | 'incoming' | 'active' | 'ended';

export type GroupCallEnd = 'left' | 'everyone-left' | 'nobody-joined' | 'full' | 'mic-denied' | 'missed';

export interface GroupCallPeer {
  id: string;
  name: string;
  /** Their voice is reaching this phone. */
  connected: boolean;
}

export interface GroupCallState {
  phase: GroupCallPhase;
  groupId: string | null;
  callId: string | null;
  /** Who rang, for the ringing screen. */
  caller: string;
  /** When this phone joined; 0 until then. */
  joinedAt: number;
  endedAt: number;
  endReason: GroupCallEnd | null;
  muted: boolean;
  speaker: boolean;
  headset: boolean;
  noiseReduction: boolean;
  /** Everyone else known to be in the call. */
  peers: GroupCallPeer[];
}

export const IDLE_GROUP_CALL: GroupCallState = {
  phase: 'idle',
  groupId: null,
  callId: null,
  caller: '',
  joinedAt: 0,
  endedAt: 0,
  endReason: null,
  muted: false,
  speaker: true,
  headset: false,
  noiseReduction: true,
  peers: []
};

/** A call going on in a group this phone is not in: for the group's Join bar. */
export interface GroupCallSeen {
  callId: string;
  /** Who is in it, by id, with their name and when last heard. */
  members: Record<string, { name: string; at: number }>;
}

export interface GroupCallSignal {
  kind: 'ring' | 'here' | 'join' | 'leave' | 'offer' | 'answer' | 'ice' | 'full';
  callId: string;
  from: string;
  name?: string;
  /** For offers, answers and candidates: the one phone it is meant for. */
  to?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface GroupCallOptions {
  /** This phone's id in its groups, and the name it goes by there. */
  me: () => { id: string; name: string };
  /** Sends one call message to everyone in the group, encrypted. */
  send: (groupId: string, signal: GroupCallSignal) => void;
  onChange: (state: GroupCallState) => void;
  /** Calls seen in groups this phone is not in changed (the Join bars). */
  onSeen: (seen: Record<string, GroupCallSeen>) => void;
  /** Whether a ring may show now: not behind the calculator, not on another call. */
  canRing: () => boolean;
  iceServers?: () => Promise<RTCIceServer[] | null>;
}

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  retry: ReturnType<typeof setTimeout> | null;
}

function newCallId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Who is in the call now, from the "here" beats heard: everyone heard from
 * lately, oldest first, so the circles keep their places.
 */
export function inCallNow(members: Record<string, { name: string; at: number }>, now: number): { id: string; name: string }[] {
  return Object.entries(members)
    .filter(([, m]) => now - m.at < GONE_AFTER_MS)
    .map(([id, m]) => ({ id, name: m.name }));
}

/** Of two phones, the one that makes the offer: the smaller id. */
export function offersTo(me: string, other: string): boolean {
  return me < other;
}

export class GroupCallEngine {
  private state: GroupCallState = IDLE_GROUP_CALL;
  private seen: Record<string, GroupCallSeen> = {};
  private peers = new Map<string, Peer>();
  /** Everyone heard in this phone's call, by id: name and when. */
  private roster: Record<string, { name: string; at: number }> = {};
  private local: MediaStream | null = null;
  private servers: RTCIceServer[] = ICE_SERVERS;
  private beat: ReturnType<typeof setInterval> | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;
  private ringing: { stop: () => void } | null = null;
  /** Someone has been in the call with this phone; once they all go, it ends. */
  private hadCompany = false;
  private noiseChoice: boolean | null = null;

  constructor(private readonly opts: GroupCallOptions) {
    // Calls seen in other groups age out by themselves; checked on a slow beat.
    this.beat = setInterval(() => this.tick(), HERE_EVERY_MS);
  }

  get snapshot(): GroupCallState {
    return this.state;
  }

  /** From the ring until the call has fully ended. */
  get busy(): boolean {
    return this.state.phase === 'incoming' || this.state.phase === 'active';
  }

  private set(patch: Partial<GroupCallState>) {
    this.state = { ...this.state, ...patch };
    this.opts.onChange(this.state);
  }

  /** Rings the group and is in the call at once, waiting for others. */
  async start(groupId: string) {
    if (this.busy) return;
    const callId = newCallId();
    this.roster = {};
    this.set({ ...IDLE_GROUP_CALL, phase: 'active', groupId, callId, caller: this.opts.me().name });
    if (!(await this.openMic())) return;
    if (this.state.callId !== callId) return;
    this.set({ joinedAt: Date.now() });
    const me = this.opts.me();
    this.opts.send(groupId, { kind: 'ring', callId, from: me.id, name: me.name });
    this.sayHere();
    // Nobody came: the call ends rather than waiting for ever.
    this.ringTimer = setTimeout(() => {
      if (this.state.callId === callId && !this.hadCompany) this.finish('nobody-joined');
    }, RING_MS);
  }

  /** Joins a call: the one ringing, or one seen going on in the group. */
  async join(groupId: string, callId?: string) {
    const id = callId || this.seen[groupId]?.callId || (this.state.groupId === groupId ? this.state.callId : null);
    if (!id) return;
    if (this.state.phase === 'active') return;
    const known = this.seen[groupId]?.callId === id ? this.seen[groupId].members : {};
    const now = Date.now();
    if (inCallNow(known, now).length >= MAX_IN_CALL) {
      this.stopRinging();
      this.set({ ...IDLE_GROUP_CALL, phase: 'ended', groupId, callId: id, endReason: 'full', endedAt: now });
      this.lingerThenIdle(id);
      return;
    }
    this.stopRinging();
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.roster = { ...known };
    const caller = this.state.caller;
    this.set({ ...IDLE_GROUP_CALL, phase: 'active', groupId, callId: id, caller });
    if (!(await this.openMic())) return;
    if (this.state.callId !== id) return;
    this.set({ joinedAt: Date.now() });
    const me = this.opts.me();
    this.opts.send(groupId, { kind: 'join', callId: id, from: me.id, name: me.name });
    this.sayHere();
    this.meetEveryone();
  }

  /** Not answering this one; the group's Join bar stays for as long as the call does. */
  decline() {
    if (this.state.phase !== 'incoming') return;
    this.stopRinging();
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.set({ ...IDLE_GROUP_CALL });
  }

  leave() {
    if (this.state.phase !== 'active') return;
    this.finish('left');
  }

  toggleMute() {
    const muted = !this.state.muted;
    this.local?.getAudioTracks().forEach(t => {
      t.enabled = !muted;
    });
    this.set({ muted });
  }

  toggleSpeaker() {
    const speaker = !this.state.speaker;
    this.set({ speaker, noiseReduction: noiseReductionOn(this.noiseChoice, speaker) });
    routeAudio(true, speaker, this.state.headset);
    void this.reopenMic();
  }

  toggleNoiseReduction() {
    this.noiseChoice = !this.state.noiseReduction;
    this.set({ noiseReduction: this.noiseChoice });
    void this.reopenMic();
  }

  /** How loud each person is, 0..1, by id - for their circles. */
  voiceLevels(): Record<string, number> {
    const out: Record<string, number> = {};
    this.peers.forEach((peer, id) => {
      try {
        const receiver = peer.pc.getReceivers().find(r => r.track?.kind === 'audio');
        const sources = receiver?.getSynchronizationSources?.() ?? [];
        out[id] = loudness(sources.reduce((m, s) => Math.max(m, s.audioLevel ?? 0), 0));
      } catch {
        out[id] = 0;
      }
    });
    return out;
  }

  /** Everything that arrives on a group's call channel. */
  handleSignal(groupId: string, signal: GroupCallSignal) {
    const me = this.opts.me();
    if (!signal || typeof signal !== 'object' || !signal.callId || !signal.from || signal.from === me.id) return;
    if (signal.to && signal.to !== me.id) return;
    const name = String(signal.name || '').slice(0, 40) || 'Someone';
    const now = Date.now();

    // Who is in which call, for the Join bar and the circles.
    if (signal.kind === 'ring' || signal.kind === 'here' || signal.kind === 'join') {
      const current = this.seen[groupId];
      const members = current && current.callId === signal.callId ? { ...current.members } : {};
      members[signal.from] = { name, at: now };
      this.seen = { ...this.seen, [groupId]: { callId: signal.callId, members } };
      this.opts.onSeen(this.seen);
    } else if (signal.kind === 'leave') {
      const current = this.seen[groupId];
      if (current && current.callId === signal.callId && current.members[signal.from]) {
        const { [signal.from]: _gone, ...rest } = current.members;
        this.seen = { ...this.seen, [groupId]: { callId: signal.callId, members: rest } };
        this.opts.onSeen(this.seen);
        // Ringing for a call everyone has already left: it stops.
        if (
          this.state.phase === 'incoming' &&
          this.state.callId === signal.callId &&
          inCallNow(rest, now).length === 0
        ) {
          this.stopRinging();
          this.set({ ...IDLE_GROUP_CALL });
        }
      }
    }

    const mine = this.state.groupId === groupId && this.state.callId === signal.callId;

    if (signal.kind === 'ring') {
      if (this.busy || !this.opts.canRing()) return;
      this.set({ ...IDLE_GROUP_CALL, phase: 'incoming', groupId, callId: signal.callId, caller: name });
      this.startRinging();
      if (this.ringTimer) clearTimeout(this.ringTimer);
      const callId = signal.callId;
      this.ringTimer = setTimeout(() => {
        if (this.state.phase === 'incoming' && this.state.callId === callId) {
          this.stopRinging();
          this.set({ ...IDLE_GROUP_CALL });
        }
      }, RING_MS);
      return;
    }

    if (!mine || this.state.phase !== 'active') return;

    switch (signal.kind) {
      case 'here':
      case 'join': {
        const fresh = !this.roster[signal.from] || now - this.roster[signal.from].at >= GONE_AFTER_MS;
        this.roster[signal.from] = { name, at: now };
        this.hadCompany = true;
        if (this.ringTimer) {
          clearTimeout(this.ringTimer);
          this.ringTimer = null;
        }
        this.syncPeers();
        if (fresh || !this.peers.has(signal.from)) this.meet(signal.from);
        // Someone new is told at once, rather than at the next beat.
        if (signal.kind === 'join') this.sayHere();
        break;
      }
      case 'leave':
        delete this.roster[signal.from];
        this.dropPeer(signal.from);
        this.syncPeers();
        this.endIfAlone();
        break;
      case 'offer':
        void this.onOffer(signal);
        break;
      case 'answer':
        void this.onAnswer(signal);
        break;
      case 'ice':
        void this.onIce(signal);
        break;
    }
  }

  destroy() {
    if (this.state.phase === 'active') this.finish('left');
    this.teardown();
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
  }

  // ------------------------------------------------------------------ inside

  private sayHere() {
    const { groupId, callId } = this.state;
    if (!groupId || !callId || this.state.phase !== 'active') return;
    const me = this.opts.me();
    this.opts.send(groupId, { kind: 'here', callId, from: me.id, name: me.name });
  }

  /** The slow beat: say we are here, forget who has gone quiet, age the Join bars. */
  private tick() {
    const now = Date.now();
    if (this.state.phase === 'active') {
      this.sayHere();
      let changed = false;
      for (const [id, m] of Object.entries(this.roster)) {
        if (now - m.at >= GONE_AFTER_MS) {
          delete this.roster[id];
          this.dropPeer(id);
          changed = true;
        }
      }
      if (changed) {
        this.syncPeers();
        this.endIfAlone();
      }
    }
    let seenChanged = false;
    const next: Record<string, GroupCallSeen> = {};
    for (const [groupId, call] of Object.entries(this.seen)) {
      const live = inCallNow(call.members, now);
      if (live.length === 0) {
        seenChanged = true;
        continue;
      }
      next[groupId] = call;
    }
    if (seenChanged) {
      this.seen = next;
      this.opts.onSeen(this.seen);
    }
  }

  private endIfAlone() {
    if (this.state.phase === 'active' && this.hadCompany && Object.keys(this.roster).length === 0) {
      this.finish('everyone-left');
    }
  }

  /** The circles: everyone heard from, and whether their voice is here yet. */
  private syncPeers() {
    const peers = Object.entries(this.roster).map(([id, m]) => ({
      id,
      name: m.name,
      connected: this.peers.get(id)?.pc.connectionState === 'connected'
    }));
    this.set({ peers });
  }

  /** Starts a connection with everyone already known, where it is this phone's to offer. */
  private meetEveryone() {
    for (const id of Object.keys(this.roster)) this.meet(id);
    this.syncPeers();
  }

  private meet(id: string) {
    const me = this.opts.me();
    if (this.peers.has(id) || !offersTo(me.id, id)) return;
    void this.makeOffer(id);
  }

  private peerFor(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: this.servers, bundlePolicy: 'max-bundle' });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    const peer: Peer = { pc, audio, pendingIce: [], retry: null };
    this.peers.set(id, peer);

    const { groupId, callId } = this.state;
    pc.onicecandidate = e => {
      if (e.candidate && groupId && callId && this.state.callId === callId) {
        this.opts.send(groupId, { kind: 'ice', callId, from: this.opts.me().id, to: id, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = e => {
      steadyPlayout(e.receiver);
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
        audio.play().catch(() => undefined);
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(id)?.pc !== pc) return;
      this.syncPeers();
      if (pc.connectionState === 'failed' && this.roster[id] && offersTo(this.opts.me().id, id)) {
        // Lost them: a fresh connection, a moment later, if they are still here.
        peer.retry = setTimeout(() => {
          this.dropPeer(id);
          if (this.roster[id] && this.state.phase === 'active') this.meet(id);
        }, 2_000);
      }
    };
    this.local?.getTracks().forEach(t => pc.addTrack(t, this.local!));
    preferRed(pc);
    return peer;
  }

  private dropPeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    if (peer.retry) clearTimeout(peer.retry);
    try {
      peer.pc.close();
    } catch {
      /* already closed */
    }
    peer.audio.srcObject = null;
    peer.audio.remove();
  }

  private send(signal: Omit<GroupCallSignal, 'from' | 'callId'>) {
    const { groupId, callId } = this.state;
    if (!groupId || !callId) return;
    this.opts.send(groupId, { ...signal, callId, from: this.opts.me().id } as GroupCallSignal);
  }

  private limit(pc: RTCPeerConnection) {
    const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = KBPS_EACH * 1000;
      (params.encodings[0] as RTCRtpEncodingParameters & { networkPriority?: string }).networkPriority = 'high';
      sender.setParameters(params).catch(() => undefined);
    } catch {
      /* its own rate, then */
    }
  }

  private async makeOffer(id: string) {
    const peer = this.peerFor(id);
    try {
      const offer = await peer.pc.createOffer();
      const sdp = tuneOpus(offer.sdp || '', KBPS_EACH);
      await peer.pc.setLocalDescription({ type: 'offer', sdp });
      this.limit(peer.pc);
      this.send({ kind: 'offer', to: id, sdp });
    } catch {
      this.dropPeer(id);
    }
  }

  private async onOffer(signal: GroupCallSignal) {
    if (!signal.sdp) return;
    // A fresh offer from someone already connected is a reconnection: start clean.
    if (this.peers.has(signal.from)) this.dropPeer(signal.from);
    const peer = this.peerFor(signal.from);
    try {
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      await this.flushIce(peer);
      const answer = await peer.pc.createAnswer();
      const sdp = tuneOpus(answer.sdp || '', KBPS_EACH);
      await peer.pc.setLocalDescription({ type: 'answer', sdp });
      this.limit(peer.pc);
      this.send({ kind: 'answer', to: signal.from, sdp });
    } catch {
      this.dropPeer(signal.from);
    }
  }

  private async onAnswer(signal: GroupCallSignal) {
    const peer = this.peers.get(signal.from);
    if (!peer || !signal.sdp || peer.pc.signalingState !== 'have-local-offer') return;
    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      await this.flushIce(peer);
    } catch {
      /* the failed state brings a retry */
    }
  }

  private async onIce(signal: GroupCallSignal) {
    const peer = this.peers.get(signal.from);
    if (!peer || !signal.candidate) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingIce.push(signal.candidate);
      return;
    }
    try {
      await peer.pc.addIceCandidate(signal.candidate);
    } catch {
      /* a candidate that does not fit is skipped */
    }
  }

  private async flushIce(peer: Peer) {
    const queued = peer.pendingIce;
    peer.pendingIce = [];
    for (const c of queued) {
      try {
        await peer.pc.addIceCandidate(c);
      } catch {
        /* skipped */
      }
    }
  }

  /** The microphone, and TURN logins asked for alongside. False when refused. */
  private async openMic(): Promise<boolean> {
    const servers = this.opts.iceServers?.().catch(() => null) ?? Promise.resolve(null);
    const headset = headsetConnected();
    const speaker = !headset;
    const quiet = noiseReductionOn(this.noiseChoice, speaker);
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: quiet, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
        video: false
      });
    } catch {
      this.finish('mic-denied');
      return false;
    }
    const extra = await Promise.race([servers, new Promise<null>(r => setTimeout(() => r(null), 2_500))]);
    this.servers = extra && extra.length ? [...ICE_SERVERS, ...extra] : ICE_SERVERS;
    this.set({ headset, speaker, noiseReduction: quiet, muted: false });
    // A group call is heard round the phone, not at the ear: the speaker by
    // default, unless earphones are in.
    routeAudio(true, speaker, headset);
    keepAlive(true);
    return true;
  }

  /** A fresh microphone with the noise setting as it now is, on every connection. */
  private async reopenMic() {
    if (this.state.phase !== 'active' || !this.local) return;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: this.state.noiseReduction,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });
      const track = fresh.getAudioTracks()[0];
      track.enabled = !this.state.muted;
      await Promise.all(
        [...this.peers.values()].map(p => p.pc.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(track))
      );
      this.local.getTracks().forEach(t => t.stop());
      this.local = fresh;
    } catch {
      /* keep the one that works */
    }
  }

  private startRinging() {
    this.stopRinging();
    let current: Playing | null = null;
    const pulse = () => {
      try {
        navigator.vibrate?.([350, 180, 350]);
      } catch {
        /* no vibrator */
      }
      current = playSound('ringtone');
    };
    pulse();
    const id = setInterval(pulse, 2_200);
    this.ringing = {
      stop: () => {
        clearInterval(id);
        try {
          navigator.vibrate?.(0);
        } catch {
          /* no vibrator */
        }
        current?.stop();
      }
    };
  }

  private stopRinging() {
    this.ringing?.stop();
    this.ringing = null;
  }

  private finish(reason: GroupCallEnd) {
    const { groupId, callId } = this.state;
    if (reason !== 'mic-denied' && groupId && callId && this.state.phase === 'active') {
      this.opts.send(groupId, { kind: 'leave', callId, from: this.opts.me().id });
    }
    this.teardown();
    this.set({ phase: 'ended', endReason: reason, endedAt: Date.now(), peers: [] });
    if (callId) this.lingerThenIdle(callId);
  }

  private lingerThenIdle(callId: string) {
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    this.lingerTimer = setTimeout(() => {
      if (this.state.phase === 'ended' && this.state.callId === callId) this.set({ ...IDLE_GROUP_CALL });
    }, ENDED_LINGER_MS);
  }

  private teardown() {
    this.stopRinging();
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    this.local?.getTracks().forEach(t => t.stop());
    this.local = null;
    this.roster = {};
    this.hadCompany = false;
    this.noiseChoice = null;
    routeAudio(false, false, false);
    keepAlive(false);
  }
}
