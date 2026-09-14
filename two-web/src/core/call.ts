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
  | 'busy'
  | 'mic-denied'
  | 'answered-elsewhere';

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
  kbps: 0
};

type NetType = 'wifi' | 'cellular' | 'unknown';

export interface CallSignal {
  kind: 'offer' | 'answer' | 'ice' | 'hangup' | 'decline' | 'cancel';
  callId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  /** The sender's connection, so both ends can settle on who is paying. */
  net?: NetType;
  busy?: boolean;
}

/** Long enough to find a phone in another room; short enough to give up. */
export const RING_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 20_000;
/** A dropped connection gets this long to come back before the call ends. */
const RECOVER_MS = 8_000;
const ENDED_LINGER_MS = 2_500;

/**
 * What the call sends at.
 *
 * Whoever is on mobile data pays for both directions: their own voice going
 * out, and the other voice coming in. So the rate follows the metered side.
 * Forty-eight kilobits of Opus with nothing stripped away is already a fuller
 * voice than a WhatsApp call, at roughly WhatsApp's data cost; ninety-six is
 * for when neither of you is paying for it.
 */
const KBPS_METERED = 48;
const KBPS_UNMETERED = 96;

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

function localNet(): NetType {
  const type = (navigator as any).connection?.type;
  if (type === 'wifi' || type === 'ethernet') return 'wifi';
  if (type === 'cellular') return 'cellular';
  // Unknown is treated as paid for. Guessing "free" is the expensive mistake.
  return 'unknown';
}

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

/** Puts Android into call mode, and chooses earpiece or speaker. */
function routeAudio(active: boolean, speaker: boolean) {
  try {
    (window as any).AndroidBridge?.setCallAudio?.(active, speaker);
  } catch {
    /* no bridge: the browser routes audio on its own */
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
  private remoteNet: NetType = 'unknown';
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;
  private headsetPoll: ReturnType<typeof setInterval> | null = null;
  private ringing: { stop: () => void } | null = null;
  /** Whether the live microphone track was opened with echo cancellation. */
  private echoCancelling = true;

  constructor(private readonly opts: CallEngineOptions) {}

  /** True from the first ring until the call has fully ended. */
  get busy(): boolean {
    return this.state.phase !== 'idle' && this.state.phase !== 'ended';
  }

  get snapshot(): CallState {
    return this.state;
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.opts.onChange(this.state);
  }

  /** Rings the other side. */
  async start() {
    if (this.busy) return;
    const callId = newCallId();
    this.remoteNet = 'unknown';
    this.set({ ...IDLE_CALL, phase: 'outgoing', callId, direction: 'out' });

    let stream: MediaStream;
    try {
      stream = await this.acquireMic();
    } catch {
      this.finish('mic-denied', false);
      return;
    }
    // Cancelled while the microphone prompt was up.
    if (this.state.callId !== callId || this.state.phase !== 'outgoing') {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    try {
      const pc = this.createPeer(callId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      const sdp = tuneOpus(offer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'offer', sdp });
      this.opts.send({ kind: 'offer', callId, sdp, net: localNet() });
    } catch {
      this.finish('failed', false);
      return;
    }

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

    let stream: MediaStream;
    try {
      stream = await this.acquireMic();
    } catch {
      this.opts.send({ kind: 'decline', callId });
      this.finish('mic-denied', false);
      return;
    }
    // Read through the snapshot: `this.state` was narrowed to 'incoming' by the
    // guard above, and TypeScript cannot see that set() has moved it on since.
    if (this.snapshot.callId !== callId || this.snapshot.phase !== 'connecting') {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    try {
      const pc = this.createPeer(callId);
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await this.flushIce();
      const answer = await pc.createAnswer();
      const sdp = tuneOpus(answer.sdp || '', this.receiveKbps());
      await pc.setLocalDescription({ type: 'answer', sdp });
      this.opts.send({ kind: 'answer', callId, sdp, net: localNet() });
      this.pendingOffer = null;
      this.armConnectTimeout(callId);
    } catch {
      this.finish('failed', true);
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
    routeAudio(this.busy, speaker);
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
      if (signal.callId === this.state.callId) return;

      // Both of you pressed call at the same moment. Exactly one call must
      // survive, and both sides have to agree which without talking about it,
      // so the larger id yields - and the call it yields to is answered at
      // once, because both of you had just asked for it.
      if (this.state.phase === 'outgoing' && (this.state.callId || '') > signal.callId) {
        this.teardown();
        this.pendingOffer = signal;
        this.remoteNet = signal.net || 'unknown';
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
    this.remoteNet = signal.net || 'unknown';
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

  private async onAnswer(signal: CallSignal) {
    const pc = this.pc;
    if (!pc || !signal.sdp || this.state.phase !== 'outgoing' || signal.callId !== this.state.callId) return;
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    this.remoteNet = signal.net || 'unknown';
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
      this.playRemote(event.streams[0] || new MediaStream([event.track]));
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.onConnected();
      } else if (s === 'failed') {
        this.finish('failed', true);
      } else if (s === 'disconnected') {
        // Often a network handover - Wi-Fi to mobile, a lift, a tunnel - that
        // recovers on its own within seconds.
        if (this.recoverTimer) clearTimeout(this.recoverTimer);
        this.recoverTimer = setTimeout(() => {
          if (this.pc === pc && pc.connectionState !== 'connected') this.finish('failed', true);
        }, RECOVER_MS);
      }
    };

    return pc;
  }

  private onConnected() {
    if (this.recoverTimer) {
      clearTimeout(this.recoverTimer);
      this.recoverTimer = null;
    }
    if (this.state.phase === 'active') return;
    this.set({ phase: 'active', connectedAt: Date.now() });
    this.applyBitrate();
    routeAudio(true, this.state.speaker);
    this.startHeadsetPoll();
  }

  /** Caps what this side sends, by whoever is paying for it. */
  private applyBitrate() {
    const kbps = localNet() === 'wifi' && this.remoteNet === 'wifi' ? KBPS_UNMETERED : KBPS_METERED;
    const sender = this.pc?.getSenders().find(s => s.track?.kind === 'audio');
    if (sender) {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = kbps * 1000;
      sender.setParameters(params).catch(() => undefined);
    }
    this.set({ kbps });
  }

  /** What this side would like to receive at, by what it is paying. */
  private receiveKbps(): number {
    return localNet() === 'wifi' ? KBPS_UNMETERED : KBPS_METERED;
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
  private async acquireMic(): Promise<MediaStream> {
    const headset = headsetConnected();
    const echoCancellation = this.state.speaker || !headset;
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
    this.local = stream;
    this.echoCancelling = echoCancellation;
    stream.getAudioTracks().forEach(track => {
      track.enabled = !this.state.muted;
    });
    this.set({ headset });
    return stream;
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
        void this.reconcileEcho();
      }
    }, 2_000);
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
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
    this.recoverTimer = null;
    if (this.headsetPoll) clearInterval(this.headsetPoll);
    this.headsetPoll = null;
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
    routeAudio(false, false);
  }
}
