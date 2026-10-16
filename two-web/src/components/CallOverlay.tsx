import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Headphones, Ear, Lock } from 'lucide-react';
import { CallState, EndReason, LinkQuality } from '../core/call';
import { haptic } from '../core/haptics';

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

const LINK: Record<LinkQuality, { label: string; dot: string }> = {
  excellent: { label: 'Excellent connection', dot: 'bg-emerald-400' },
  good: { label: 'Good connection', dot: 'bg-amber-300' },
  poor: { label: 'Weak connection', dot: 'bg-rose-400' }
};

/**
 * Where the two circles stand, in px either side of the middle: apart while
 * a call rings, nearer while it connects, overlapping once you are talking -
 * Two's own mark - and apart again when it ends.
 */
function placing(call: CallState): { gap: number; together: boolean } {
  switch (call.phase) {
    case 'connecting':
      return { gap: 54, together: false };
    case 'active':
      return call.reconnecting ? { gap: 50, together: false } : { gap: 38, together: true };
    case 'ended':
      return { gap: 84, together: false };
    default:
      return { gap: 78, together: false };
  }
}

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const Dots: React.FC = () => (
  <span className="call-dots" aria-hidden="true">
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </span>
);

/**
 * The call screen: the night sky of Two's mark, with a circle for each of
 * you. While it rings, rings go out from whoever is calling; when it
 * connects the circles meet and overlap, and each glows while that one of
 * you speaks.
 *
 * Rendered only inside the sanctuary, never above the calculator - so a call
 * arriving while the disguise is up has nowhere to appear, which is the point.
 */
export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  myName,
  partnerName,
  partnerOnline,
  voiceLevels,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleSpeaker
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (call.phase !== 'active') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [call.phase]);

  // A tap under the thumb the moment it connects - felt even with the phone
  // already at your ear.
  const lastPhase = useRef(call.phase);
  useEffect(() => {
    if (call.phase === 'active' && lastPhase.current !== 'active') haptic('confirm');
    lastPhase.current = call.phase;
  }, [call.phase]);

  // Each circle swells with its voice. Set straight on the circles' slots
  // rather than through React: several times a second, for as long as you talk.
  const youOrb = useRef<HTMLDivElement>(null);
  const themOrb = useRef<HTMLDivElement>(null);
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
          youOrb.current?.style.setProperty('--voice', mine.toFixed(3));
          themOrb.current?.style.setProperty('--voice', theirs.toFixed(3));
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, 140);
    const you = youOrb.current;
    const them = themOrb.current;
    return () => {
      alive = false;
      clearInterval(id);
      you?.style.setProperty('--voice', '0');
      them?.style.setProperty('--voice', '0');
    };
  }, [call.phase, voiceLevels]);

  if (call.phase === 'idle') return null;

  const { gap, together } = placing(call);
  const ended = call.phase === 'ended' ? endLine(call.endReason, call.direction) : null;
  const ringing = call.phase === 'incoming' || call.phase === 'outgoing';
  const away = call.phase === 'outgoing' && !partnerOnline;
  // Speaker first: pressing it with earphones in really does move the sound
  // to the loudspeaker, so the label has to say so.
  const route = call.speaker ? 'Speaker' : call.headset ? 'Earphones' : 'Earpiece';
  // What is actually arriving once measured; the ceiling until then.
  const shownKbps = call.measuredKbps > 0 ? call.measuredKbps : call.kbps;

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
    status = 'is calling you';
  } else if (call.phase === 'connecting') {
    status = (
      <>
        Connecting
        <Dots />
      </>
    );
  } else if (call.phase === 'active') {
    status = <span className="text-[22px] font-medium tracking-wide text-white tabular-nums">{clock(now - call.connectedAt)}</span>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${partnerName}`}
      data-live={call.phase === 'active'}
      className="no-remap call-sky fixed inset-0 z-[70] flex flex-col items-center overflow-hidden px-6 text-white animate-in fade-in duration-300"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)'
      }}
    >
      <div className="call-sky-glow" aria-hidden="true" />

      <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
        <Lock className="h-3 w-3" aria-hidden="true" />
        End-to-end encrypted
      </p>

      <div className="relative flex w-full flex-1 flex-col items-center justify-center">
        <div className="call-stage" data-together={together} aria-hidden="true">
          <div ref={youOrb} className="call-orb-slot call-tint-you" style={{ '--x': `${-gap}px` } as React.CSSProperties}>
            {call.phase === 'outgoing' && (
              <div className="absolute inset-0">
                <span className="call-ripple" />
                <span className="call-ripple" />
                <span className="call-ripple" />
              </div>
            )}
            <div className="call-orb-glow" />
            <div className="call-orb call-orb-you">
              <span className="call-orb-initial" style={{ '--lean': together ? '-6px' : '0px' } as React.CSSProperties}>
                {initialOf(myName)}
              </span>
            </div>
          </div>
          <div
            ref={themOrb}
            className="call-orb-slot call-tint-them"
            data-away={away}
            style={{ '--x': `${gap}px` } as React.CSSProperties}
          >
            {call.phase === 'incoming' && (
              <div className="absolute inset-0">
                <span className="call-ripple" />
                <span className="call-ripple" />
                <span className="call-ripple" />
              </div>
            )}
            <div className="call-orb-glow" />
            <div className="call-orb call-orb-them">
              <span className="call-orb-initial" style={{ '--lean': together ? '6px' : '0px' } as React.CSSProperties}>
                {initialOf(partnerName)}
              </span>
            </div>
          </div>
          {/* The bright space where they overlap, over both. */}
          <div className="call-lens" />
        </div>

        <h2 className="mt-7 flex items-center gap-2.5 font-serif text-[32px] font-medium leading-tight tracking-tight">
          {partnerName}
          {ringing && partnerOnline && (
            <>
              <span
                className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                aria-hidden="true"
              />
              <span className="sr-only">online</span>
            </>
          )}
        </h2>

        <div className="mt-2 min-h-[3.25rem] text-center" aria-live="polite">
          {ended ? (
            <>
              <p className="text-[15px] text-white/85">
                {ended.title}
                {call.connectedAt > 0 && (
                  <span className="tabular-nums"> &middot; {clock(call.endedAt - call.connectedAt)}</span>
                )}
              </p>
              {ended.detail && (
                <p className="mx-auto mt-1.5 max-w-[17rem] text-[13px] leading-relaxed text-white/60">{ended.detail}</p>
              )}
            </>
          ) : (
            <p className="text-[15px] text-white/80">{status}</p>
          )}
        </div>

        {call.phase === 'active' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-white/75">
              {call.reconnecting ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-amber-100 ring-1 ring-amber-200/25" role="status">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                  Reconnecting…
                </span>
              ) : (
                call.link && (
                  <span className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 ring-1 ring-white/[0.12]">
                    <span className={`h-1.5 w-1.5 rounded-full ${LINK[call.link].dot}`} />
                    {LINK[call.link].label}
                  </span>
                )
              )}
              <span className="rounded-full bg-white/[0.08] px-3 py-1 tabular-nums ring-1 ring-white/[0.12]">
                {route} &middot; {shownKbps} kbps
              </span>
            </div>
            {call.link === 'poor' && !call.reconnecting && (
              <p className="max-w-[17rem] text-center text-[11px] leading-relaxed text-white/55">
                Audio may break up. Turning on data saver for calls in Settings can steady it.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="relative flex min-h-[7.5rem] w-full max-w-xs items-end justify-around">
        {call.phase === 'incoming' && (
          <>
            <button
              type="button"
              onClick={() => {
                haptic('tick');
                onDecline();
              }}
              aria-label="Decline"
              className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
            >
              <span className="call-key call-key-end h-[68px] w-[68px]">
                <PhoneOff className="h-7 w-7" />
              </span>
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('confirm');
                onAccept();
              }}
              aria-label="Accept"
              className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
            >
              <span className="call-key call-key-answer h-[68px] w-[68px]">
                <Phone className="h-7 w-7" />
              </span>
              Accept
            </button>
          </>
        )}

        {(call.phase === 'outgoing' || call.phase === 'connecting' || call.phase === 'active') && (
          <>
            {call.phase === 'active' && (
              <button
                type="button"
                onClick={() => {
                  haptic('tick');
                  onToggleMute();
                }}
                aria-label={call.muted ? 'Unmute' : 'Mute'}
                aria-pressed={call.muted}
                className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
              >
                <span className="call-key h-14 w-14" data-on={call.muted}>
                  {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </span>
                {call.muted ? 'Muted' : 'Mute'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                haptic('tick');
                onHangup();
              }}
              aria-label={call.phase === 'outgoing' ? 'Cancel call' : 'End call'}
              className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
            >
              <span className="call-key call-key-end h-[68px] w-[68px]">
                <PhoneOff className="h-7 w-7" />
              </span>
              {call.phase === 'outgoing' ? 'Cancel' : 'End'}
            </button>

            {call.phase === 'active' && (
              <button
                type="button"
                onClick={() => {
                  haptic('tick');
                  onToggleSpeaker();
                }}
                aria-label={call.speaker ? 'Use earpiece' : 'Use speaker'}
                aria-pressed={call.speaker}
                className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
              >
                <span className="call-key h-14 w-14" data-on={call.speaker}>
                  {call.speaker ? (
                    <Volume2 className="h-6 w-6" />
                  ) : call.headset ? (
                    <Headphones className="h-6 w-6" />
                  ) : (
                    <Ear className="h-6 w-6" />
                  )}
                </span>
                Speaker
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
