import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Headphones, Ear } from 'lucide-react';
import { CallState, EndReason, LinkQuality } from '../core/call';

interface CallOverlayProps {
  call: CallState;
  partnerName: string;
  partnerOnline: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
        detail:
          'Your two networks could not reach each other directly. This happens most on mobile data.'
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
 * The call screen.
 *
 * Rendered only inside the sanctuary, never above the calculator - so a call
 * arriving while the disguise is up has nowhere to appear, which is the point.
 */
export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  partnerName,
  partnerOnline,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleSpeaker
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (call.phase !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [call.phase]);

  if (call.phase === 'idle') return null;

  const initial = (partnerName || '?').trim().charAt(0).toUpperCase();

  let status: React.ReactNode;
  if (call.phase === 'outgoing') {
    status = partnerOnline ? 'Calling…' : 'Not online right now — they will see that you called';
  } else if (call.phase === 'incoming') {
    status = 'is calling you';
  } else if (call.phase === 'connecting') {
    status = 'Connecting…';
  } else if (call.phase === 'active') {
    status = <span className="tabular-nums">{clock(now - call.connectedAt)}</span>;
  }

  const ended = call.phase === 'ended' ? endLine(call.endReason, call.direction) : null;
  // Speaker first: pressing it with earphones in really does move the sound
  // to the loudspeaker, so the label has to say so.
  const route = call.speaker ? 'Speaker' : call.headset ? 'Earphones' : 'Earpiece';
  // What is actually arriving once measured; the ceiling until then.
  const shownKbps = call.measuredKbps > 0 ? call.measuredKbps : call.kbps;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${partnerName}`}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-linen-primary px-6 text-linen-surface"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)'
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full bg-linen-surface/10 font-serif text-5xl ${
            call.phase === 'incoming' || call.phase === 'outgoing' ? 'animate-pulse' : ''
          }`}
        >
          {initial}
        </div>
        <h2 className="mt-6 font-serif text-3xl font-medium">{partnerName}</h2>

        {ended ? (
          <>
            <p className="mt-2 text-sm text-linen-surface/80">
              {ended.title}
              {call.connectedAt > 0 && <> &middot; {clock(call.endedAt - call.connectedAt)}</>}
            </p>
            {ended.detail && (
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-linen-surface/60">{ended.detail}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-linen-surface/80">{status}</p>
        )}

        {call.phase === 'active' && (
          <>
            <p className="mt-3 text-[11px] text-linen-surface/50 tabular-nums">
              {route} &middot; {shownKbps} kbps &middot; end-to-end encrypted
            </p>
            {call.reconnecting ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-linen-surface/70" role="status">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                Reconnecting…
              </p>
            ) : call.link && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-linen-surface/70">
                <span className={`h-1.5 w-1.5 rounded-full ${LINK[call.link].dot}`} />
                {LINK[call.link].label}
              </p>
            )}
            {call.link === 'poor' && !call.reconnecting && (
              <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-linen-surface/50">
                Audio may break up. Turning on data saver for calls in Settings can steady it.
              </p>
            )}
          </>
        )}
      </div>

      {!ended && (
        <div className="flex w-full max-w-xs items-end justify-around">
          {call.phase === 'incoming' ? (
            <>
              <button
                onClick={onDecline}
                aria-label="Decline"
                className="flex flex-col items-center gap-2 text-xs"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 transition-transform active:scale-90">
                  <PhoneOff className="h-7 w-7" />
                </span>
                Decline
              </button>
              <button
                onClick={onAccept}
                aria-label="Accept"
                className="flex flex-col items-center gap-2 text-xs"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 transition-transform active:scale-90">
                  <Phone className="h-7 w-7" />
                </span>
                Accept
              </button>
            </>
          ) : (
            <>
              {call.phase === 'active' && (
                <button
                  onClick={onToggleMute}
                  aria-label={call.muted ? 'Unmute' : 'Mute'}
                  aria-pressed={call.muted}
                  className="flex flex-col items-center gap-2 text-xs"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors active:scale-90 ${
                      call.muted ? 'bg-linen-surface text-linen-primary' : 'bg-linen-surface/10'
                    }`}
                  >
                    {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </span>
                  {call.muted ? 'Muted' : 'Mute'}
                </button>
              )}

              <button
                onClick={onHangup}
                aria-label={call.phase === 'outgoing' ? 'Cancel call' : 'End call'}
                className="flex flex-col items-center gap-2 text-xs"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 transition-transform active:scale-90">
                  <PhoneOff className="h-7 w-7" />
                </span>
                {call.phase === 'outgoing' ? 'Cancel' : 'End'}
              </button>

              {call.phase === 'active' && (
                <button
                  onClick={onToggleSpeaker}
                  aria-label={call.speaker ? 'Use earpiece' : 'Use speaker'}
                  aria-pressed={call.speaker}
                  className="flex flex-col items-center gap-2 text-xs"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors active:scale-90 ${
                      call.speaker ? 'bg-linen-surface text-linen-primary' : 'bg-linen-surface/10'
                    }`}
                  >
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
      )}
    </div>
  );
};
