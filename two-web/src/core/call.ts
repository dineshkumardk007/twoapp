// Audio calls between the two of you.
//
// WhatsApp tunes a call for a stranger on a bad train: very little data, heavy
// noise suppression, aggressive gain control. The voice comes through clear and
// flat - the room is gone, the breathing is gone, the pause before an answer is
// gated into silence. This is tuned for two people who want to hear each other:
// a fuller Opus stream, and the processing that strips a voice down left off.
//
// Nothing here is new infrastructure. Call setup rides the relay's SIGNAL
// channel - encrypted, never stored, never replayed - which already carries
// "typing", so the relay sees that a signal passed and nothing about the call.
// The audio itself is WebRTC, DTLS-SRTP encrypted end to end.
//
// Two limits worth knowing, and said again where they bite:
// - It cannot ring a closed app. There are no push notifications yet, so both
//   of you need the app open.
// - It cannot always connect. Mobile carriers often sit phones behind a NAT
//   that a direct connection cannot cross, and there is no TURN relay yet to
//   carry the audio when that happens.

/** The signal type every call message travels under. */
export const CALL_SIGNAL = 'CALL';

/**
 * A persistent record left when a call went unanswered.
 *
 * Signals are dropped when nobody is listening, so a call to a closed app, or
 * to a phone showing the calculator, would otherwise vanish without trace. The
 * caller writes this when the ringing stops, and it reaches the other side the
 * next time they open the app, through the same "while you were away" card as
 * everything else.
 */
export const CALL_MISSED = 'CALL_MISSED';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export type EndReason =
  | 'hangup'
  | 'remote-hangup'
  | 'declined'
  | 'no-answer'
  | 'cancelled'
  | 'missed'
  | 'failed'
  /** Connected, then lost and not recovered - distinct from never connecting. */
  | 'dropped'
  | 'busy'
  | 'mic-denied'
  | 'answered-elsewhere';

/** How the network is treating the call right now, from what arrives. */
export type LinkQuality = 'excellent' | 'good' | 'poor';

/**
 * How much audio a call is allowed to spend.
 *
 * Per device, because the data belongs to whoever is holding the phone. If
 * either side asks for the saver, both directions use it: the voice you send
 * is data the other phone has to receive.
 */
export type CallQuality = 'high' | 'saver';

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  direction: 'in' | 'out' | null;
  /** When audio actually started flowing; 0 until then. */
  connectedAt: number;
  endedAt: number;
  endReason: EndReason | null;
  muted: boolean;
  speaker: boolean;
  /** Earphones of any kind, which is what decides echo cancellation. */
  headset: boolean;
  /** The ceiling this side is sending at. */
  kbps: number;
  /** What is actually arriving, measured; 0 until the first sample. */
  measuredKbps: number;
  link: LinkQuality | null;
  /** Connected before, lost the network, and trying to get it back. */
  reconnecting: boolean;
}

export const IDLE_CALL: CallState = {
  phase: 'idle',
  callId: null,
  direction: null,
  connectedAt: 0,
  endedAt: 0,
  endReason: null,
  muted: false,
  speaker: false,
  headset: false,
  kbps: 0,
  measuredKbps: 0,
  link: null,
  reconnecting: false
};

export interface CallSignal {
  /**
   * An 'offer' or 'answer' carrying the callId of the call already under way
   * is a reconnection, not a new call. 'restart' asks the caller to make one.
   */
  kind: 'offer' | 'answer' | 'ice' | 'hangup' | 'decline' | 'cancel' | 'restart';
  callId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  /** The sender's data preference, so both ends settle on the same rate. */
  quality?: CallQuality;
  busy?: boolean;
}

/** Long enough to find a phone in another room; short enough to give up. */
export const RING_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 20_000;
/**
 * A lost connection gets this long to come back before the call ends.
 *
 * Long enough to walk out of the house onto mobile data: the phone has to
 * notice the Wi-Fi is gone, the relay has to reconnect to carry the new
 * route, and the two phones then have to find each other again.
 */
const RECOVER_MS = 20_000;
/** How often a reconnection is tried again while the connection is down. */
const RESTART_EVERY_MS = 4_000;
const ENDED_LINGER_MS = 2_500;

/**
 * What the call sends at.
 *
 * Ninety-six kilobits is the ceiling on purpose, not a compromise. Opus carries
 * a single speaking voice at full band essentially transparently well before
 * that; past it, extra bits buy nothing a person can hear and cost the phone
 * on mobile data twice over - once for the voice it sends, once for the voice
 * it receives. Forty-eight is still a fuller voice than a WhatsApp call.
 */
const KBPS_HIGH = 96;
const KBPS_SAVER = 48;

/**
 * A floor under the receiving jitter buffer.
 *
 * On mobile data packets arrive unevenly, and a buffer that runs too close to
 * empty plays the gaps as crackles and robotic stretches. Sixty milliseconds
 * of standing room removes most of that for a delay nobody notices in
 * conversation. The buffer still grows by itself when the network gets worse.
 */
const JITTER_BUFFER_MS = 60;

const QUALITY_KEY = 'two_call_quality_v1';

export function readCallQuality(): CallQuality {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'saver' ? 'saver' : 'high';
  } catch {
    return 'high';
  }
}

export function writeCallQuality(quality: CallQuality) {
  try {
    localStorage.setItem(QUALITY_KEY, quality);
  } catch {
    /* storage unavailable; the call falls back to high */
  }
}

/**
 * STUN only, for now.
 *
 * Enough when at least one side has an ordinary home router. Not enough when
 * both sides sit behind carrier NAT, and a call between two such phones will
 * reach "Couldn't connect". The fix is a TURN server, which is infrastructure
 * with a bill, and deliberately not pretended into existence here.
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
];

/**
 * Whether earphones of any kind are connected.
 *
 * Asked of Android itself, because a WebView cannot see audio outputs reliably.
 * Without the bridge - in a browser - the answer is "no", which keeps echo
 * cancellation on: the worse-sounding choice, and the one that never lets
 * somebody hear their own voice come back at them.
 */
function headsetConnected(): boolean {
  try {
    const bridge = (window as any).AndroidBridge;
    if (typeof bridge?.isHeadsetConnected === 'function') return !!bridge.isHeadsetConnected();
  } catch {
    /* no bridge */
  }
  return false;
}

/**
 * Tells Android where the call's audio should go.
 *
 * With earphones the call stays off the phone's voice-call path, which many
 * phones process and band-limit the way they would a cellular call - the very
 * sound this is trying to get away from. That path is only needed for the
 * earpiece, and for the phone's own echo cancellation on speaker.
 */
function routeAudio(active: boolean, speaker: boolean, headset: boolean) {
  try {
    const bridge = (window as any).AndroidBridge;
    if (typeof bridge?.setCallAudioRoute === 'function') {
      bridge.setCallAudioRoute(active, speaker, headset);
    } else {
      bridge?.setCallAudio?.(active, speaker);
    }
  } catch {
    /* no bridge: the browser routes audio on its own */
  }
  // At the ear, the screen goes dark so a cheek cannot press End or Mute.
  // Not on speaker or with earphones, where the phone is in a hand.
  try {
    (window as any).AndroidBridge?.setProximityLock?.(active && !speaker && !headset);
  } catch {
    /* no proximity sensor, or an older app without the method */
  }
}

/**
 * Keeps the microphone alive while the call is off screen.
 *
 * Android gives an app that is not on screen a silent microphone: lock the
 * phone mid-call and the other person would hear nothing. The app runs a
 * service for the length of the call to prevent that, which Android shows as
 * an ongoing notification.
 */
function keepAlive(on: boolean) {
  try {
    (window as any).AndroidBridge?.setCallKeepAlive?.(on);
  } catch {
    /* no bridge: a browser tab has no such restriction to work around */
  }
}

/** Gives received audio room to arrive unevenly without breaking up. */
function steadyPlayout(receiver: RTCRtpReceiver) {
  const r = receiver as any;
  try {
    if ('jitterBufferTarget' in r) r.jitterBufferTarget = JITTER_BUFFER_MS;
    else if ('playoutDelayHint' in r) r.playoutDelayHint = JITTER_BUFFER_MS / 1000;
  } catch {
    /* an older engine without either knob manages its own buffer */
  }
}

/**
 * Rewrites the Opus line of a session description.
 *
 * - useinbandfec=1: redundancy inside the stream, so a lost packet on her
 *   mobile connection is rebuilt rather than heard as a click.
 * - usedtx=0: keep sending through silence. Discontinuous transmission saves
 *   data by sending nothing when nobody speaks, which is exactly how the
 *   quiet in a conversation stops sounding like a room.
 * - stereo=0: a phone microphone is mono; a stereo stream spends bits on a
 *   second copy of the same voice.
 * - 48 kHz both ways: full band, rather than the narrow band a phone call
 *   squeezes a voice into.
 * - maxaveragebitrate: the ceiling this side would like to receive at.
 */
export function tuneOpus(sdp: string, kbps: number): string {
  const rtpmap = /a=rtpmap:(\d+) opus\/48000(?:\/2)?/i.exec(sdp);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1];
  const params = [
    'minptime=10',
    'useinbandfec=1',
    'usedtx=0',
    'stereo=0',
    'sprop-stereo=0',
    'maxplaybackrate=48000',
    'sprop-maxcapturerate=48000',
    `maxaveragebitrate=${Math.round(kbps * 1000)}`
  ].join(';');

  const fmtp = new RegExp(`a=fmtp:${pt} [^\\r\\n]*`, 'i');
  if (fmtp.test(sdp)) return sdp.replace(fmtp, `a=fmtp:${pt} ${params}`);

  const line = new RegExp(`(a=rtpmap:${pt} opus\\/48000(?:\\/2)?[^\\r\\n]*)`, 'i');
  return sdp.replace(line, `$1\r\na=fmtp:${pt} ${params}`);
}

/** A microphone opened for a call, and the conditions it was opened under. */
interface OpenedMic {
  stream: MediaStream;
  echoCancellation: boolean;
  headset: boolean;
}

function newCallId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface CallEngineOptions {
  /** Sends one call message to the other side, encrypted. */
  send: (signal: CallSignal) => void;
  onChange: (state: CallState) => void;
  /** An outgoing call stopped ringing without being answered. */
  onMissed: (callId: string) => void;
  /**
   * Whether an incoming call may be shown right now.
   *
   * False while the calculator is up. The call is then simply not answered:
   * nothing rings, nothing appears over the disguise, and the caller's missed
   * call record is what tells this side later.
   */
  canRing: () => boolean;
  /**
   * The call's connection was lost. Reconnecting needs the relay to carry the
   * new route, and after a network change the relay may itself still be
   * waiting out a backoff.
   */
  nudgeRelay?: () => void;
}

/**
 * One call at a time, from ring to hang-up.
 *
 * Deliberately not a React component. It holds a peer connection, a
 * microphone and an audio element that must outlive whatever screen happens
 * to be showing - the dock switching tabs, the calculator coming up - so it
 * lives beside the app rather than inside its render tree.
 */
export class CallEngine {
  private state: CallState = IDLE_CALL;
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private pendingOffer: CallSignal | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteQuality: CallQuality = 'high';
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setInterval> | null = null;
  /** Microphone requests still waiting on an answer, possibly a permission prompt. */
  private micRequests = 0;
  private headsetPoll: ReturnType<typeof setInterval> | null = null;
  private statsPoll: ReturnType<typeof setInterval> | null = null;
  private lastStats: { at: number; bytes: number; lost: number; received: number } | null = null;
  private ringing: { stop: () => void } | null = null;
  /** Whether the live microphone track was opened with echo cancellation. */
  private echoCancelling = true;

  constructor(private readonly opts: CallEngineOptions) {
    // A fresh page has no call. A notification left over from one the page
    // was reloaded out of - the panic button, a lock - is cleared here.
    keepAlive(false);
  }

  /** True from the first ring until the call has fully ended. */
  get busy(): boolean {
    return this.state.phase !== 'idle' && this.state.phase !== 'ended';
  }

  get snapshot(): CallState {
    return this.state;
  }

  /**
   * True while the microphone is being asked for.
   *
   * The first call on a phone raises Android's permission dialog, which takes
   * focus from the app exactly like leaving it does. Anything that reacts to
   * leaving - the disguise - must not treat that as leaving, or the very first
   * call would hang itself up.
   */
  get askingForMic(): boolean {
    return this.micRequests > 0;
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.opts.onChange(this.state);
  }

  /** Rings the other side. */
  async start() {
    if (this.busy) return;
    const callId = newCallId();
    this.remoteQuality = 'high';
    this.set({ ...IDLE_CALL, phase: 'outgoing', callId, direction: 'out' });

    let mic: OpenedMic;
    try {
      mic = await this.openMic();
    } catch {
      // Only if this is still the call being made: a glare while the prompt
      // was up may have replaced it with the other side's call.
      if (this.snapshot.callId === callId) this.finish('mic-denied', false);
      return;
    }
    // Cancelled, or replaced, while the microphone prompt was up.
    if (this.snapshot.callId !== callId || this.snapshot.phase !== 'outgoing') {
      mic.stream.getTracks().forEach(t => t.stop());
      return;
    }
    const stream = this.adoptMic(mic);

    try {
      const pc = this.createPeer(callId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      const sdp = tuneOpus(offer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'offer', sdp });
      this.opts.send({ kind: 'offer', callId, sdp, quality: readCallQuality() });
    } catch {
      // A glare that yielded closed this peer on purpose; that is not a
      // failure of the call that replaced it.
      if (this.snapshot.callId === callId) this.finish('failed', false);
      return;
    }
    if (this.snapshot.callId !== callId) return;

    this.ringTimer = setTimeout(() => {
      if (this.state.phase !== 'outgoing' || this.state.callId !== callId) return;
      this.opts.send({ kind: 'cancel', callId });
      this.opts.onMissed(callId);
      this.finish('no-answer', false);
    }, RING_TIMEOUT_MS);
  }

  /** Picks up the call that is ringing. */
  async accept() {
    const offer = this.pendingOffer;
    if (!offer?.sdp || this.state.phase !== 'incoming' || offer.callId !== this.state.callId) return;
    const callId = offer.callId;

    this.stopRinging();
    this.set({ phase: 'connecting' });

    let mic: OpenedMic;
    try {
      mic = await this.openMic();
    } catch {
      if (this.snapshot.callId !== callId) return;
      this.opts.send({ kind: 'decline', callId });
      this.finish('mic-denied', false);
      return;
    }
    // Read through the snapshot: `this.state` was narrowed to 'incoming' by the
    // guard above, and TypeScript cannot see that set() has moved it on since.
    if (this.snapshot.callId !== callId || this.snapshot.phase !== 'connecting') {
      mic.stream.getTracks().forEach(t => t.stop());
      return;
    }
    const stream = this.adoptMic(mic);

    try {
      const pc = this.createPeer(callId);
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await this.flushIce();
      const answer = await pc.createAnswer();
      const sdp = tuneOpus(answer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'answer', sdp });
      this.opts.send({ kind: 'answer', callId, sdp, quality: readCallQuality() });
      this.pendingOffer = null;
      this.armConnectTimeout(callId);
    } catch {
      if (this.snapshot.callId === callId) this.finish('failed', true);
    }
  }

  decline() {
    const { phase, callId } = this.state;
    if (phase !== 'incoming' || !callId) return;
    this.opts.send({ kind: 'decline', callId });
    this.finish('declined', false);
  }

  /** Ends whatever is happening, from whichever side of it this is. */
  hangup() {
    const { phase, callId } = this.state;
    if (!callId) return;
    if (phase === 'outgoing') {
      this.opts.send({ kind: 'cancel', callId });
      this.opts.onMissed(callId);
      this.finish('cancelled', false);
    } else if (phase === 'incoming') {
      this.decline();
    } else if (phase === 'connecting' || phase === 'active') {
      this.opts.send({ kind: 'hangup', callId });
      this.finish('hangup', false);
    }
  }

  /**
   * The disguise went up. Nothing about a call may carry on behind it - no
   * voice from a phone that is showing a calculator.
   *
   * A call still ringing here is stopped without a word, the same as one that
   * arrives while the disguise is already up: the caller rings out and leaves
   * a missed call, rather than hearing that it was declined.
   */
  endForDisguise() {
    const { phase, callId } = this.state;
    if (!callId) return;
    if (phase === 'incoming') this.finish('missed', false);
    else this.hangup();
  }

  toggleMute() {
    const muted = !this.state.muted;
    this.local?.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
    this.set({ muted });
  }

  toggleSpeaker() {
    const speaker = !this.state.speaker;
    this.set({ speaker });
    routeAudio(this.busy, speaker, this.state.headset);
    void this.reconcileEcho();
  }

  /**
   * Everything that arrives on the call channel.
   *
   * `fromSelf` is a message from another device on this same side of the
   * couple. Its offers are not calls to us, but its answer or refusal means a
   * call we are still ringing for has been dealt with elsewhere.
   */
  handleSignal(signal: CallSignal, fromSelf: boolean) {
    if (!signal || typeof signal.callId !== 'string' || !signal.kind) return;

    if (fromSelf) {
      if (
        (signal.kind === 'answer' || signal.kind === 'decline') &&
        this.state.phase === 'incoming' &&
        signal.callId === this.state.callId
      ) {
        this.finish('answered-elsewhere', false);
      }
      return;
    }

    switch (signal.kind) {
      case 'offer':
        this.onOffer(signal);
        return;
      case 'answer':
        void this.onAnswer(signal);
        return;
      case 'ice':
        void this.onIce(signal);
        return;
      case 'decline':
        if (signal.callId === this.state.callId && this.state.phase === 'outgoing') {
          this.finish(signal.busy ? 'busy' : 'declined', false);
        }
        return;
      case 'cancel':
        if (signal.callId === this.state.callId && this.state.phase === 'incoming') {
          this.finish('missed', false);
        }
        return;
      case 'restart':
        // The other side lost the connection and cannot reconnect on its own:
        // only the caller makes offers, so the two never offer across each other.
        if (
          signal.callId === this.state.callId &&
          this.state.direction === 'out' &&
          this.state.phase === 'active' &&
          this.pc
        ) {
          void this.restartIce(this.pc, signal.callId);
        }
        return;
      case 'hangup':
        if (
          signal.callId === this.state.callId &&
          (this.state.phase === 'connecting' || this.state.phase === 'active')
        ) {
          this.finish('remote-hangup', false);
        }
        return;
    }
  }

  /** Called when the app itself is going away. */
  destroy() {
    if (this.busy) this.hangup();
    this.teardown();
  }

  private onOffer(signal: CallSignal) {
    if (!signal.sdp) return;

    if (this.busy) {
      if (signal.callId === this.state.callId) {
        // The caller reconnecting a call already under way.
        const pc = this.pc;
        if (pc?.remoteDescription && (this.state.phase === 'active' || this.state.phase === 'connecting')) {
          void this.onReoffer(pc, signal);
        }
        return;
      }

      // Both of you pressed call at the same moment. Exactly one call must
      // survive, and both sides have to agree which without talking about it,
      // so the larger id yields - and the call it yields to is answered at
      // once, because both of you had just asked for it.
      if (this.state.phase === 'outgoing' && (this.state.callId || '') > signal.callId) {
        this.teardown();
        this.pendingOffer = signal;
        this.remoteQuality = signal.quality === 'saver' ? 'saver' : 'high';
        this.set({ ...IDLE_CALL, phase: 'incoming', callId: signal.callId, direction: 'in' });
        void this.accept();
        return;
      }
      if (this.state.phase === 'outgoing') return; // theirs yields to ours

      this.opts.send({ kind: 'decline', callId: signal.callId, busy: true });
      return;
    }

    // Disguised: say nothing, show nothing. See canRing.
    if (!this.opts.canRing()) return;

    this.pendingOffer = signal;
    this.pendingIce = [];
    this.remoteQuality = signal.quality === 'saver' ? 'saver' : 'high';
    this.set({ ...IDLE_CALL, phase: 'incoming', callId: signal.callId, direction: 'in' });
    this.startRinging();

    // A caller who vanished without cancelling - a dead battery, a tunnel -
    // must not leave this side ringing forever.
    const callId = signal.callId;
    this.timers.push(
      setTimeout(() => {
        if (this.state.phase === 'incoming' && this.state.callId === callId) this.finish('missed', false);
      }, RING_TIMEOUT_MS + 5_000)
    );
  }

  /** Answers the caller's reconnection offer on the same connection. */
  private async onReoffer(pc: RTCPeerConnection, signal: CallSignal) {
    const callId = signal.callId;
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp! });
      await this.flushIce();
      const answer = await pc.createAnswer();
      const sdp = tuneOpus(answer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'answer', sdp });
      if (this.pc === pc && this.state.callId === callId) {
        this.opts.send({ kind: 'answer', callId, sdp, quality: readCallQuality() });
      }
    } catch {
      /* superseded by a newer attempt, which the caller is already sending */
    }
  }

  private async onAnswer(signal: CallSignal) {
    const pc = this.pc;
    if (!pc || !signal.sdp || signal.callId !== this.state.callId) return;

    // The answer to a reconnection. Only one that matches an offer still
    // waiting counts; a late answer to an attempt already rolled back does not.
    if (this.state.phase === 'active' || this.state.phase === 'connecting') {
      if (pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.flushIce();
      } catch {
        /* the next attempt tries again */
      }
      return;
    }

    if (this.state.phase !== 'outgoing') return;
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    this.remoteQuality = signal.quality === 'saver' ? 'saver' : 'high';
    this.set({ phase: 'connecting' });
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      await this.flushIce();
      this.armConnectTimeout(signal.callId);
    } catch {
      this.finish('failed', true);
    }
  }

  private async onIce(signal: CallSignal) {
    if (!signal.candidate || signal.callId !== this.state.callId) return;
    // Candidates can arrive before the description they belong to. Adding one
    // early throws, and a dropped candidate can be the only route that works.
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(signal.candidate);
      return;
    }
    // The same during a reconnection: a candidate for the new route can
    // overtake the offer that introduces it, and would be rejected as
    // belonging to nothing. It waits for that offer instead.
    const ufrag = /a=ice-ufrag:(\S+)/.exec(this.pc.remoteDescription.sdp)?.[1];
    const theirs = signal.candidate.usernameFragment;
    if (ufrag && theirs && theirs !== ufrag) {
      this.pendingIce.push(signal.candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(signal.candidate);
    } catch {
      /* a stale candidate for a route already abandoned */
    }
  }

  private async flushIce() {
    const pc = this.pc;
    if (!pc) return;
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* as above */
      }
    }
  }

  private createPeer(callId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' });
    this.pc = pc;

    pc.onicecandidate = event => {
      if (event.candidate && this.state.callId === callId) {
        this.opts.send({ kind: 'ice', callId, candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = event => {
      steadyPlayout(event.receiver);
      this.playRemote(event.streams[0] || new MediaStream([event.track]));
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.onConnected();
      } else if (this.state.phase === 'active' && (s === 'disconnected' || s === 'failed')) {
        // A call that was working: a lift, a tunnel, or walking out of the
        // house onto mobile data. Worth getting back rather than ending.
        this.recover(pc);
      } else if (s === 'failed') {
        // Never connected in the first place. The connect timeout covers a
        // connection that is merely slow.
        this.finish('failed', true);
      }
    };

    return pc;
  }

  /**
   * Gets a lost call back.
   *
   * A network change - Wi-Fi to mobile data - gives a phone a new address, and
   * the old route will never work again however long it waits. Only an ICE
   * restart finds a new one. The caller makes the offers, so the two phones
   * never cross offers; the other side asks the caller to, in case only it
   * noticed the loss. Both repeat, because right after a network change the
   * relay carrying these messages is often still reconnecting itself.
   */
  private recover(pc: RTCPeerConnection) {
    if (this.recoverTimer || this.pc !== pc) return;
    const callId = this.state.callId;
    if (!callId) return;

    this.set({ reconnecting: true });
    this.opts.nudgeRelay?.();

    this.recoverTimer = setTimeout(() => {
      if (this.pc === pc && pc.connectionState !== 'connected') this.finish('dropped', true);
    }, RECOVER_MS);

    const attempt = () => {
      if (this.pc !== pc || this.state.callId !== callId) return;
      if (this.state.direction === 'out') void this.restartIce(pc, callId);
      else this.opts.send({ kind: 'restart', callId });
    };
    attempt();
    if (this.restartTimer) clearInterval(this.restartTimer);
    this.restartTimer = setInterval(attempt, RESTART_EVERY_MS);
  }

  /** One reconnection offer. A previous one still unanswered is withdrawn. */
  private async restartIce(pc: RTCPeerConnection, callId: string) {
    if (this.pc !== pc || this.state.callId !== callId) return;
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setLocalDescription({ type: 'rollback' });
      }
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer({ iceRestart: true });
      const sdp = tuneOpus(offer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'offer', sdp });
      if (this.pc === pc && this.state.callId === callId) {
        this.opts.send({ kind: 'offer', callId, sdp, quality: readCallQuality() });
      }
    } catch {
      /* the next attempt tries again */
    }
  }

  private stopRecovering() {
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
    this.recoverTimer = null;
    if (this.restartTimer) clearInterval(this.restartTimer);
    this.restartTimer = null;
  }

  private onConnected() {
    this.stopRecovering();
    if (this.state.phase === 'active') {
      if (this.state.reconnecting) this.set({ reconnecting: false });
      return;
    }
    this.set({ phase: 'active', connectedAt: Date.now() });
    this.applySendParameters();
    routeAudio(true, this.state.speaker, this.state.headset);
    this.startHeadsetPoll();
    this.startStatsPoll();
  }

  /**
   * What this side sends at, and how the network should treat it.
   *
   * The rate drops to the saver if either phone asked for it. Priority high
   * marks the packets for networks that honour it - home Wi-Fi mostly - so a
   * download running in the next room does not get to shove a voice aside.
   */
  private applySendParameters() {
    const kbps = readCallQuality() === 'high' && this.remoteQuality === 'high' ? KBPS_HIGH : KBPS_SAVER;
    const sender = this.pc?.getSenders().find(s => s.track?.kind === 'audio');
    if (sender) {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      const encoding = params.encodings[0] as RTCRtpEncodingParameters & { networkPriority?: string };
      encoding.maxBitrate = kbps * 1000;
      encoding.priority = 'high';
      encoding.networkPriority = 'high';
      sender.setParameters(params).catch(() => undefined);
    }
    this.set({ kbps });
  }

  /** What this side would like to receive at, by what it is paying. */
  private receiveKbps(): number {
    return readCallQuality() === 'high' ? KBPS_HIGH : KBPS_SAVER;
  }

  /**
   * Opens the microphone.
   *
   * Noise suppression and gain control are off in every case: they are what
   * makes a call voice sound processed, and turning them off costs nothing in
   * data. Echo cancellation is the exception. Off, a voice played through a
   * speaker goes straight back into the microphone and the other person hears
   * themselves a moment late - so it is off only with earphones, where there is
   * no speaker to leak from.
   */
  private async openMic(): Promise<OpenedMic> {
    const headset = headsetConnected();
    const echoCancellation = this.state.speaker || !headset;
    this.micRequests++;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });
      return { stream, echoCancellation, headset };
    } finally {
      this.micRequests--;
    }
  }

  /**
   * Makes an opened microphone the call's own.
   *
   * Separate from opening it, and done only once the caller has checked that
   * its call is still the current one. When both of you press call in the same
   * second, two microphone requests are in flight at once; whichever finished
   * last used to become the one mute and hang-up acted on, even if it belonged
   * to the call that had just been abandoned - leaving the live microphone
   * unmutable, and still open after the call ended.
   */
  private adoptMic(mic: OpenedMic): MediaStream {
    if (this.local && this.local !== mic.stream) this.local.getTracks().forEach(t => t.stop());
    this.local = mic.stream;
    this.echoCancelling = mic.echoCancellation;
    mic.stream.getAudioTracks().forEach(track => {
      track.enabled = !this.state.muted;
    });
    this.set({ headset: mic.headset });
    // From the moment the microphone is the call's: while ringing out counts,
    // since a phone put down to wait for an answer is often locked.
    keepAlive(true);
    return mic.stream;
  }

  /**
   * Swaps the microphone track when echo cancellation needs to change.
   *
   * Plugging in earphones or reaching for the speaker mid-call changes what is
   * safe. A live track cannot reliably be reconfigured, so a new one replaces it
   * on the same sender - the other side hears no gap and no renegotiation.
   */
  private async reconcileEcho() {
    const want = this.state.speaker || !this.state.headset;
    const pc = this.pc;
    if (!pc || want === this.echoCancelling) return;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: want,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });
      const track = fresh.getAudioTracks()[0];
      track.enabled = !this.state.muted;
      await pc.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(track);
      this.local?.getTracks().forEach(t => t.stop());
      this.local = fresh;
      this.echoCancelling = want;
      // Say the route again. Opening a microphone can make Android's WebView
      // put the phone back into call mode on its own, which with earphones
      // would undo the full-quality media path chosen a moment ago.
      if (this.busy) routeAudio(true, this.state.speaker, this.state.headset);
    } catch {
      /* keep the track that is working */
    }
  }

  private startHeadsetPoll() {
    if (this.headsetPoll) clearInterval(this.headsetPoll);
    this.headsetPoll = setInterval(() => {
      const headset = headsetConnected();
      if (headset !== this.state.headset) {
        this.set({ headset });
        routeAudio(true, this.state.speaker, headset);
        void this.reconcileEcho();
      }
    }, 2_000);
  }

  /**
   * Measures the call every two seconds.
   *
   * What arrives, not what was asked for: a ceiling of ninety-six says nothing
   * about a train going under a bridge. Loss, jitter and round-trip time turn
   * into one word on the call screen, so a bad moment can be told apart from a
   * fault - a weak connection is the network, and the saver may help it.
   */
  private startStatsPoll() {
    if (this.statsPoll) clearInterval(this.statsPoll);
    this.lastStats = null;
    this.statsPoll = setInterval(() => void this.sampleStats(), 2_000);
  }

  private async sampleStats() {
    const pc = this.pc;
    if (!pc || this.state.phase !== 'active') return;

    let inbound: any = null;
    let rttSeconds = 0;
    try {
      const report = await pc.getStats();
      report.forEach((r: any) => {
        if (r.type === 'inbound-rtp' && r.kind === 'audio') inbound = r;
        if (
          r.type === 'candidate-pair' &&
          r.state === 'succeeded' &&
          r.nominated &&
          typeof r.currentRoundTripTime === 'number'
        ) {
          rttSeconds = r.currentRoundTripTime;
        }
      });
    } catch {
      return;
    }
    if (!inbound || this.pc !== pc) return;

    const now = Date.now();
    const previous = this.lastStats;
    const current = {
      at: now,
      bytes: inbound.bytesReceived || 0,
      lost: inbound.packetsLost || 0,
      received: inbound.packetsReceived || 0
    };
    this.lastStats = current;
    if (!previous) return;

    const seconds = Math.max(0.5, (now - previous.at) / 1000);
    const measuredKbps = Math.round(((current.bytes - previous.bytes) * 8) / seconds / 1000);
    const lost = Math.max(0, current.lost - previous.lost);
    const received = Math.max(0, current.received - previous.received);
    const lossPct = lost + received > 0 ? (lost / (lost + received)) * 100 : 0;
    const jitterMs = (inbound.jitter || 0) * 1000;
    const rttMs = rttSeconds * 1000;

    const link: LinkQuality =
      lossPct < 1 && jitterMs < 30 && rttMs < 250
        ? 'excellent'
        : lossPct < 5 && jitterMs < 60 && rttMs < 500
          ? 'good'
          : 'poor';

    this.set({ measuredKbps, link });
  }

  private armConnectTimeout(callId: string) {
    this.timers.push(
      setTimeout(() => {
        if (this.state.phase === 'connecting' && this.state.callId === callId) this.finish('failed', true);
      }, CONNECT_TIMEOUT_MS)
    );
  }

  private playRemote(stream: MediaStream) {
    if (!this.audioEl) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.audioEl = el;
    }
    if (this.audioEl.srcObject !== stream) {
      this.audioEl.srcObject = stream;
      this.audioEl.play().catch(() => undefined);
    }
  }

  /** A soft two-note ring and a vibration, repeating. */
  private startRinging() {
    this.stopRinging();
    let ctx: AudioContext | null = null;
    const pulse = () => {
      try {
        navigator.vibrate?.([350, 180, 350]);
      } catch {
        /* no vibrator */
      }
      try {
        ctx = ctx || new AudioContext();
        const now = ctx.currentTime;
        [
          { at: 0, hz: 523.25 },
          { at: 0.45, hz: 659.25 }
        ].forEach(({ at, hz }) => {
          const osc = ctx!.createOscillator();
          const gain = ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.value = hz;
          gain.gain.setValueAtTime(0.0001, now + at);
          gain.gain.exponentialRampToValueAtTime(0.12, now + at + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.38);
          osc.connect(gain).connect(ctx!.destination);
          osc.start(now + at);
          osc.stop(now + at + 0.4);
        });
      } catch {
        /* audio not allowed yet; the vibration still says it */
      }
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
        try {
          void ctx?.close();
        } catch {
          /* already closed */
        }
      }
    };
  }

  private stopRinging() {
    this.ringing?.stop();
    this.ringing = null;
  }

  private finish(reason: EndReason, notifyRemote: boolean) {
    const { phase, callId } = this.state;
    if (phase === 'idle' || phase === 'ended') return;
    if (notifyRemote && callId && (phase === 'connecting' || phase === 'active')) {
      this.opts.send({ kind: 'hangup', callId });
    }
    this.teardown();
    this.set({ phase: 'ended', endReason: reason, endedAt: Date.now() });

    // The end is shown briefly, then the screen gets out of the way.
    this.timers.push(
      setTimeout(() => {
        if (this.state.phase === 'ended' && this.state.callId === callId) this.set({ ...IDLE_CALL });
      }, ENDED_LINGER_MS)
    );
  }

  private teardown() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
    this.stopRecovering();
    if (this.headsetPoll) clearInterval(this.headsetPoll);
    this.headsetPoll = null;
    if (this.statsPoll) clearInterval(this.statsPoll);
    this.statsPoll = null;
    this.lastStats = null;
    this.stopRinging();

    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.pc = null;

    this.local?.getTracks().forEach(t => t.stop());
    this.local = null;

    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }

    this.pendingOffer = null;
    this.pendingIce = [];
    routeAudio(false, false, false);
    keepAlive(false);
  }
}
