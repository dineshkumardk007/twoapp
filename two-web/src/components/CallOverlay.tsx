import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Headphones, Ear, Lock, ChevronDown, ChevronUp, AudioLines, Heart, Sparkles } from 'lucide-react';
import { CallState, EndReason, LinkQuality } from '../core/call';
import { haptic } from '../core/haptics';
import { useBackLayer } from '../core/backStack';

interface CallOverlayProps {
  call: CallState;
  /** Your own name, for your circle. */
  myName: string;
  partnerName: string;
  partnerOnline: boolean;
  /** How loud each of you is right now, 0..1; asked several times a second while you talk. */
  voiceLevels?: () => Promise<{ mine: number; theirs: number }>;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  /** The noise button: the room taken out of your voice, or left in. */
  onToggleNoise?: () => void;
  /** From the end of a call that was talked on: a heart into the chat. */
  onSendHeart?: () => void;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** What the end of a call says, from this side of it. */
function endLine(reason: EndReason | null, direction: CallState['direction']): { title: string; detail?: string } {
  switch (reason) {
    case 'declined':
      return { title: direction === 'out' ? 'Declined' : 'You declined' };
    case 'no-answer':
      return { title: 'No answer', detail: 'They will see that you called.' };
    case 'cancelled':
      return { title: 'Cancelled', detail: 'They will see that you called.' };
    case 'missed':
      return { title: 'Missed call' };
    case 'busy':
      return { title: 'Already on a call' };
    case 'mic-denied':
      return {
        title: 'Microphone not allowed',
        detail: 'Allow microphone access for Two in your phone settings, then try again.'
      };
    case 'answered-elsewhere':
      return { title: 'Answered on another device' };
    case 'dropped':
      // Not the "couldn't connect" wording: these two phones did reach each
      // other, so blaming their networks for never meeting would be untrue.
      return {
        title: 'Call dropped',
        detail: 'The connection was lost and did not come back. Calling again usually works.'
      };
    case 'failed':
      // Said plainly, because the likeliest cause is not a fault anyone can
      // fix by tapping again: two phones that cannot reach each other directly.
      return {
        title: "Couldn't connect",
        detail: 'Your two networks could not reach each other directly. This happens most on mobile data.'
      };
    default:
      return { title: 'Call ended' };
  }
}

const LINK: Record<LinkQuality, { label: string; bars: number }> = {
  excellent: { label: 'Excellent connection', bars: 4 },
  good: { label: 'Good connection', bars: 3 },
  poor: { label: 'Weak connection', bars: 1 }
};

/** Four bars, as a phone's signal, coloured by how the call is doing. */
const SignalBars: React.FC<{ link: LinkQuality }> = ({ link }) => (
  <span className="call-bars" data-link={link} aria-hidden="true">
    {[1, 2, 3, 4].map(n => (
      <span key={n} data-on={n <= LINK[link].bars} style={{ height: `${3 + n * 2.5}px` }} />
    ))}
  </span>
);

/**
 * A soft two-note blip every couple of seconds while the call is finding its
 * way back - so a silence with the phone at your ear reads as "hold on", not
 * as her having gone quiet. Made here rather than played from a file: it is
 * tiny, and quiet on purpose.
 */
function useReconnectTone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctx();
    } catch {
      return;
    }
    const blip = () => {
      if (!ctx) return;
      const t = ctx.currentTime;
      [660, 880].forEach((hz, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, t + i * 0.16);
        gain.gain.linearRampToValueAtTime(0.035, t + i * 0.16 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.22);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(t + i * 0.16);
        osc.stop(t + i * 0.16 + 0.25);
      });
    };
    blip();
    const id = setInterval(blip, 2_600);
    return () => {
      clearInterval(id);
      ctx?.close().catch(() => undefined);
    };
  }, [on]);
}

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const Dots: React.FC = () => (
  <span className="call-dots" aria-hidden="true">
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </span>
);

/** How far the answer knob travels up its track, in px; most of the way answers. */
const SWIPE_TRAVEL = 112;
const SWIPE_ANSWERS_AT = 0.7;

/**
 * Answering by sliding the green knob up, as a phone's own call screen does,
 * so a call is not picked up by a pocket or a cheek. The knob follows the
 * finger exactly; let go most of the way up and the call is answered, short
 * of it and the knob springs back. A tap alone only nudges it, to show which
 * way it goes. A keyboard's Enter, or TalkBack's double tap, answers at once
 * (a click that no finger made: `detail` 0).
 */
const SwipeToAnswer: React.FC<{ onAnswer: () => void }> = ({ onAnswer }) => {
  const knob = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; y0: number; dy: number } | null>(null);
  const [answered, setAnswered] = useState(false);

  const place = (dy: number, eased: boolean) => {
    const el = knob.current;
    if (!el) return;
    el.style.transition = eased ? 'transform 380ms cubic-bezier(0.2, 1.3, 0.4, 1)' : 'none';
    el.style.transform = `translate3d(0, ${dy}px, 0)`;
    el.parentElement?.style.setProperty('--pull', String(Math.min(1, -dy / SWIPE_TRAVEL)));
  };
  const answer = () => {
    if (answered) return;
    setAnswered(true);
    place(-SWIPE_TRAVEL, true);
    haptic('confirm');
    onAnswer();
  };

  return (
    <div className="call-swipe" data-answered={answered}>
      <span className="call-swipe-hint" aria-hidden="true">
        <ChevronUp className="h-4 w-4" />
        <ChevronUp className="h-4 w-4" />
        <ChevronUp className="h-4 w-4" />
      </span>
      <button
        ref={knob}
        type="button"
        aria-label="Accept"
        className="call-key call-key-answer call-swipe-knob h-[68px] w-[68px]"
        onPointerDown={e => {
          if (answered) return;
          drag.current = { id: e.pointerId, y0: e.clientY, dy: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
          haptic('tick');
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          d.dy = Math.max(-SWIPE_TRAVEL, Math.min(0, e.clientY - d.y0));
          place(d.dy, false);
        }}
        onPointerUp={e => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.id !== e.pointerId) return;
          if (-d.dy >= SWIPE_TRAVEL * SWIPE_ANSWERS_AT) {
            answer();
          } else if (Math.abs(d.dy) < 6) {
            // A tap: a little hop up, the way it wants to go.
            place(-28, true);
            setTimeout(() => place(0, true), 200);
          } else {
            place(0, true);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          place(0, true);
        }}
        onClick={e => {
          if (e.detail === 0) answer();
        }}
      >
        <Phone className="h-7 w-7" />
      </button>
      <span className="call-swipe-label">Swipe up to answer</span>
    </div>
  );
};

/**
 * A round key in the call's glass dock. A toggle acts the moment a finger
 * lands - mute is wanted now, not when the finger lifts - with a tick; End
 * waits for the lift, so a brushing cheek cannot end a call.
 */
const DockKey: React.FC<{
  label: string;
  caption: string;
  on?: boolean;
  danger?: boolean;
  onPress: () => void;
  keyRef?: React.Ref<HTMLSpanElement>;
  children: React.ReactNode;
}> = ({ label, caption, on, danger, onPress, keyRef, children }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={danger ? undefined : !!on}
    onPointerDown={
      danger
        ? undefined
        : e => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            haptic('tick');
            onPress();
          }
    }
    onClick={e => {
      if (danger) {
        haptic('confirm');
        onPress();
      } else if (e.detail === 0) {
        onPress();
      }
    }}
    className="call-dock-key"
  >
    <span ref={keyRef} className={`call-key h-[58px] w-[58px] ${danger ? 'call-key-end' : ''}`} data-on={on || undefined}>
      {children}
    </span>
    <span className="call-dock-caption">{caption}</span>
  </button>
);

/** The line under the timer: how clear the call is, in a word. */
const QualityChip: React.FC<{ call: CallState }> = ({ call }) => {
  if (call.reconnecting) {
    return (
      <span className="call-chip call-chip-warn call-shimmer" role="status">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
        Reconnecting…
      </span>
    );
  }
  if (!call.link) return null;
  if (call.link === 'excellent') {
    return (
      <span className="call-chip call-chip-hd">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        HD voice
      </span>
    );
  }
  return (
    <span className={`call-chip ${call.link === 'poor' ? 'call-chip-warn' : ''}`}>
      <SignalBars link={call.link} />
      {call.link === 'poor' ? 'Weak network' : 'Good connection'}
    </span>
  );
};

/**
 * The call screen: an aurora over the night sky, and in the middle a big
 * circle for the one you are talking to, ringed with slowly turning light
 * that swells and glows as they speak. The keys sit in a floating glass dock;
 * your own voice lights the Mute key. A call coming in is answered by
 * sliding up. When it ends, a moment to see how long it was - and to send a
 * heart.
 *
 * It comes up at once - a few frames of fade, nothing to wait through. Only
 * transform and opacity move, so a phone's graphics chip draws all of it.
 *
 * Rendered only inside the sanctuary, never above the calculator - so a call
 * arriving while the disguise is up has nowhere to appear, which is the point.
 */
export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  partnerName,
  partnerOnline,
  voiceLevels,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
  onToggleNoise,
  onSendHeart
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (call.phase !== 'active') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [call.phase]);

  // Made small, the call is a pill at the top of the screen and the rest of
  // Two is yours to use; a tap on it, or a new ring, brings the screen back.
  const [small, setSmall] = useState(false);
  const canShrink = call.phase === 'outgoing' || call.phase === 'connecting' || call.phase === 'active';
  useEffect(() => {
    if (!canShrink) setSmall(false);
  }, [canShrink]);
  // The phone's Back makes it small, as other messengers do, rather than
  // leaving the screen with a call on it.
  useBackLayer(canShrink && !small, () => setSmall(true));

  useReconnectTone(call.phase === 'active' && call.reconnecting);

  // A tap under the thumb the moment it connects - felt even with the phone
  // already at your ear.
  const lastPhase = useRef(call.phase);
  useEffect(() => {
    if (call.phase === 'active' && lastPhase.current !== 'active') haptic('confirm');
    lastPhase.current = call.phase;
  }, [call.phase]);

  // The heart sent from the end of a call: once.
  const [heartSent, setHeartSent] = useState(false);
  useEffect(() => {
    if (call.phase !== 'ended') setHeartSent(false);
  }, [call.phase]);

  // Their circle swells with their voice, and your Mute key glows with
  // yours. Set straight on the elements rather than through React: several
  // times a second, for as long as you talk.
  const themOrb = useRef<HTMLDivElement>(null);
  const youKey = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (call.phase !== 'active' || !voiceLevels) return;
    let alive = true;
    let busy = false;
    let mine = 0;
    let theirs = 0;
    const id = setInterval(() => {
      if (busy) return;
      busy = true;
      voiceLevels()
        .then(level => {
          // Up at once, down gently: a voice reads as a voice, not a flicker.
          mine = Math.max(level.mine, mine * 0.8);
          theirs = Math.max(level.theirs, theirs * 0.8);
          if (!alive) return;
          youKey.current?.style.setProperty('--voice', mine.toFixed(3));
          themOrb.current?.style.setProperty('--voice', theirs.toFixed(3));
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, 120);
    const you = youKey.current;
    const them = themOrb.current;
    return () => {
      alive = false;
      clearInterval(id);
      you?.style.setProperty('--voice', '0');
      them?.style.setProperty('--voice', '0');
    };
    // Again when the screen comes back from the pill: its parts are new.
  }, [call.phase, voiceLevels, small]);

  if (call.phase === 'idle') return null;

  if (small && canShrink) {
    const pillText =
      call.phase === 'active'
        ? call.reconnecting
          ? 'Reconnecting…'
          : `On call · ${clock(now - call.connectedAt)}`
        : call.phase === 'connecting'
          ? 'Connecting…'
          : 'Calling…';
    return (
      // Centred by the row, not by a transform, so its slide-in cannot pull it aside.
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      >
        <button
          type="button"
          onClick={() => {
            haptic('tick');
            setSmall(false);
          }}
          aria-label={`Back to the call with ${partnerName}`}
          className="call-pill pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200"
          data-reconnecting={call.phase === 'active' && call.reconnecting}
        >
          <span className="call-pill-dot" aria-hidden="true" />
          <span className="call-pill-initial" aria-hidden="true">{initialOf(partnerName)}</span>
          <span className="tabular-nums">{pillText}</span>
          {call.muted && <MicOff className="h-3.5 w-3.5 text-white/70" aria-label="Muted" />}
        </button>
      </div>
    );
  }

  const ended = call.phase === 'ended' ? endLine(call.endReason, call.direction) : null;
  const talked = call.phase === 'ended' && call.connectedAt > 0;
  const ringing = call.phase === 'incoming' || call.phase === 'outgoing';
  const away = call.phase === 'outgoing' && !partnerOnline;
  // Speaker first: pressing it with earphones in really does move the sound
  // to the loudspeaker, so the label has to say so.
  const route = call.speaker ? 'Speaker' : call.headset ? 'Earphones' : 'Earpiece';

  let status: React.ReactNode = null;
  if (call.phase === 'outgoing') {
    status = partnerOnline ? (
      <>
        Calling
        <Dots />
      </>
    ) : (
      <>
        Not online right now
        <span className="mt-1 block text-[13px] text-white/55">They will see that you called</span>
      </>
    );
  } else if (call.phase === 'incoming') {
    status = 'Two voice call';
  } else if (call.phase === 'connecting') {
    status = (
      <>
        Connecting
        <Dots />
      </>
    );
  } else if (call.phase === 'active') {
    status = <span className="text-[20px] font-medium tracking-wide text-white tabular-nums">{clock(now - call.connectedAt)}</span>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${partnerName}`}
      data-live={call.phase === 'active'}
      data-phase={call.phase}
      className="no-remap call-sky call-enter fixed inset-0 z-[70] flex flex-col items-center overflow-hidden px-6 text-white"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)'
      }}
    >
      <div className="call-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="call-stars" aria-hidden="true" />

      <div className="relative flex w-full items-center justify-center">
        {canShrink && (
          <button
            type="button"
            onClick={() => {
              haptic('tick');
              setSmall(true);
            }}
            aria-label="Make the call small"
            className="call-shrink absolute left-0 top-1/2 -translate-y-1/2"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <Lock className="h-3 w-3" aria-hidden="true" />
          End-to-end encrypted
        </p>
      </div>

      <div className="relative flex w-full flex-1 flex-col items-center justify-center">
        <div
          ref={themOrb}
          className="call-hero"
          data-ringing={ringing}
          data-away={away}
          data-ended={call.phase === 'ended'}
          data-talking={call.phase === 'active' && !call.reconnecting}
          aria-hidden="true"
        >
          {ringing && (
            <>
              <span className="call-ripple" />
              <span className="call-ripple" />
              <span className="call-ripple" />
            </>
          )}
          <span className="call-hero-glow" />
          <span className="call-halo" />
          <span className="call-halo call-halo-soft" />
          <span className="call-hero-orb">
            <span className="call-hero-initial">{initialOf(partnerName)}</span>
          </span>
        </div>

        <h2 className="mt-9 flex items-center gap-2.5 font-serif text-[34px] font-medium leading-tight tracking-tight">
          {partnerName}
          {ringing && partnerOnline && (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" aria-hidden="true" />
              <span className="sr-only">online</span>
            </>
          )}
        </h2>

        <div className="mt-1.5 min-h-[3.25rem] text-center" aria-live="polite">
          {ended ? (
            <div className="call-summary">
              <p className="text-[15px] text-white/85">{ended.title}</p>
              {talked && <p className="mt-0.5 font-serif text-[30px] leading-none tabular-nums">{clock(call.endedAt - call.connectedAt)}</p>}
              {ended.detail && <p className="mx-auto mt-1.5 max-w-[17rem] text-[13px] leading-relaxed text-white/60">{ended.detail}</p>}
              {talked && onSendHeart && (
                <button
                  type="button"
                  disabled={heartSent}
                  onClick={() => {
                    haptic('confirm');
                    setHeartSent(true);
                    onSendHeart();
                  }}
                  className="call-heart"
                  data-sent={heartSent}
                >
                  <Heart className="h-4 w-4" fill={heartSent ? 'currentColor' : 'none'} aria-hidden="true" />
                  {heartSent ? 'Heart sent' : 'Send a heart'}
                </button>
              )}
            </div>
          ) : (
            <p key={`${call.phase}-${call.reconnecting}`} className="call-status text-[15px] text-white/80">
              {status}
            </p>
          )}
        </div>

        {call.phase === 'active' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <QualityChip call={call} />
            {call.link === 'poor' && !call.reconnecting && (
              <p className="max-w-[17rem] text-center text-[11px] leading-relaxed text-white/55">
                The sound is being adjusted to keep it steady.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="relative flex min-h-[9.5rem] w-full max-w-sm items-end justify-center">
        {call.phase === 'incoming' && (
          <div className="flex w-full items-end justify-around">
            <button
              type="button"
              onClick={() => {
                haptic('tick');
                onDecline();
              }}
              aria-label="Decline"
              className="call-dock-key mb-7"
            >
              <span className="call-key call-key-end h-[62px] w-[62px]">
                <PhoneOff className="h-6 w-6" />
              </span>
              <span className="call-dock-caption">Decline</span>
            </button>
            <SwipeToAnswer onAnswer={onAccept} />
          </div>
        )}

        {(call.phase === 'outgoing' || call.phase === 'connecting') && (
          <div className="call-dock">
            <DockKey label={call.muted ? 'Unmute' : 'Mute'} caption={call.muted ? 'Muted' : 'Mute'} on={call.muted} onPress={onToggleMute}>
              {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </DockKey>
            <DockKey label={call.speaker ? 'Use earpiece' : 'Use speaker'} caption={route} on={call.speaker} onPress={onToggleSpeaker}>
              {call.speaker ? <Volume2 className="h-6 w-6" /> : call.headset ? <Headphones className="h-6 w-6" /> : <Ear className="h-6 w-6" />}
            </DockKey>
            <DockKey label={call.phase === 'outgoing' ? 'Cancel call' : 'End call'} caption={call.phase === 'outgoing' ? 'Cancel' : 'End'} danger onPress={onHangup}>
              <PhoneOff className="h-6 w-6" />
            </DockKey>
          </div>
        )}

        {call.phase === 'active' && (
          <div className="call-dock">
            <DockKey
              label={call.muted ? 'Unmute' : 'Mute'}
              caption={call.muted ? 'Muted' : 'Mute'}
              on={call.muted}
              onPress={onToggleMute}
              keyRef={youKey}
            >
              {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </DockKey>
            <DockKey label={call.speaker ? 'Use earpiece' : 'Use speaker'} caption={route} on={call.speaker} onPress={onToggleSpeaker}>
              {call.speaker ? <Volume2 className="h-6 w-6" /> : call.headset ? <Headphones className="h-6 w-6" /> : <Ear className="h-6 w-6" />}
            </DockKey>
            {onToggleNoise && (
              <DockKey
                label={call.noiseReduction ? 'Let the room back in' : 'Take out background noise'}
                caption={call.noiseReduction ? 'Quiet on' : 'Quiet'}
                on={call.noiseReduction}
                onPress={onToggleNoise}
              >
                <AudioLines className="h-6 w-6" />
              </DockKey>
            )}
            <DockKey label="End call" caption="End" danger onPress={onHangup}>
              <PhoneOff className="h-6 w-6" />
            </DockKey>
          </div>
        )}
      </div>
    </div>
  );
};
