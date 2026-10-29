import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Headphones, Ear, Lock, ChevronDown, AudioLines, Users } from 'lucide-react';
import type { GroupCallEnd, GroupCallState } from '../core/groupCall';
import { haptic } from '../core/haptics';
import { useBackLayer } from '../core/backStack';

interface GroupCallOverlayProps {
  call: GroupCallState;
  /** The group's name, for the screen's title. */
  groupName: string;
  myName: string;
  /** How loud each person is, by id, 0..1; asked several times a second. */
  voiceLevels: () => Record<string, number>;
  onJoin: () => void;
  onDecline: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleNoise: () => void;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ''}${h > 0 ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}

function endTitle(reason: GroupCallEnd | null): { title: string; detail?: string } {
  switch (reason) {
    case 'full':
      return { title: 'Call is full', detail: 'A group call holds six people at most.' };
    case 'nobody-joined':
      return { title: 'Nobody joined' };
    case 'everyone-left':
      return { title: 'Everyone left' };
    case 'mic-denied':
      return { title: 'Microphone not allowed', detail: 'Allow microphone access for Two in your phone settings, then try again.' };
    default:
      return { title: 'Call ended' };
  }
}

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase() || '?';

/** Each person's circle tint, steady for a given name. */
const TINTS = ['#7C9CFF', '#F59EB5', '#5EEAD4', '#FCD34D', '#C4B5FD', '#FDBA74'];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * The group call screen: the same night sky as a call between the two of
 * you, with a circle for everyone in it. Each circle's rings open out as that
 * person speaks; one still finding its way to this phone is dimmed. Made
 * small, it is a pill at the top of Two, as the couple's call is.
 */
export const GroupCallOverlay: React.FC<GroupCallOverlayProps> = ({
  call,
  groupName,
  myName,
  voiceLevels,
  onJoin,
  onDecline,
  onLeave,
  onToggleMute,
  onToggleSpeaker,
  onToggleNoise
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (call.phase !== 'active') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [call.phase]);

  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (call.phase !== 'active') setSmall(false);
  }, [call.phase]);
  useBackLayer(call.phase === 'active' && !small, () => setSmall(true));

  // A buzz the first time someone else's voice arrives.
  const anyone = call.peers.some(p => p.connected);
  const heardOnce = useRef(false);
  useEffect(() => {
    if (anyone && !heardOnce.current) haptic('confirm');
    heardOnce.current = anyone;
  }, [anyone]);

  // Each circle swells with its voice, set straight on the circles.
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (call.phase !== 'active' || small) return;
    const levels: Record<string, number> = {};
    const id = setInterval(() => {
      const now = voiceLevels();
      grid.current?.querySelectorAll<HTMLElement>('[data-person]').forEach(el => {
        const who = el.dataset.person || '';
        levels[who] = Math.max(now[who] ?? 0, (levels[who] ?? 0) * 0.8);
        el.style.setProperty('--voice', levels[who].toFixed(3));
      });
    }, 140);
    return () => clearInterval(id);
  }, [call.phase, small, voiceLevels]);

  if (call.phase === 'idle') return null;

  const inCall = call.peers.length + 1;

  if (small && call.phase === 'active') {
    return (
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
          aria-label={`Back to the call in ${groupName}`}
          className="call-pill pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <span className="call-pill-dot" aria-hidden="true" />
          <span className="call-pill-initial" aria-hidden="true">
            <Users className="h-3.5 w-3.5" />
          </span>
          <span className="tabular-nums">
            {groupName} · {clock(now - call.joinedAt)}
          </span>
          {call.muted && <MicOff className="h-3.5 w-3.5 text-white/70" aria-label="Muted" />}
        </button>
      </div>
    );
  }

  const ended = call.phase === 'ended' ? endTitle(call.endReason) : null;
  const people = [{ id: 'me', name: myName || 'You', connected: true }, ...call.peers];

  let status: React.ReactNode;
  if (call.phase === 'incoming') status = `${call.caller} is calling the group`;
  else if (call.phase === 'active')
    status =
      call.peers.length === 0 ? (
        'Ringing the group…'
      ) : (
        <span className="tabular-nums">
          {clock(now - call.joinedAt)} · {inCall} in call
        </span>
      );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Group call in ${groupName}`}
      data-live={call.phase === 'active'}
      className={`no-remap call-sky fixed inset-0 z-[70] flex flex-col items-center overflow-hidden px-6 text-white animate-in fade-in duration-300 ${
        call.phase === 'incoming' ? 'slide-in-from-bottom-6 duration-500' : ''
      }`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)'
      }}
    >
      <div className="call-sky-glow" aria-hidden="true" />

      <div className="relative flex w-full items-center justify-center">
        {call.phase === 'active' && (
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
        <h2 className="flex items-center gap-2 font-serif text-[28px] font-medium leading-tight tracking-tight">
          <Users className="h-6 w-6 text-white/70" aria-hidden="true" />
          {groupName}
        </h2>
        <div className="mt-1 min-h-[2.75rem] text-center" aria-live="polite">
          {ended ? (
            <>
              <p className="text-[15px] text-white/85">{ended.title}</p>
              {ended.detail && <p className="mx-auto mt-1 max-w-[17rem] text-[13px] text-white/60">{ended.detail}</p>}
            </>
          ) : (
            <p key={`${call.phase}-${call.peers.length === 0}`} className="text-[15px] text-white/80 animate-in fade-in slide-in-from-bottom-1 duration-300">
              {status}
            </p>
          )}
        </div>

        {call.phase === 'active' && (
          <div ref={grid} className="gcall-grid mt-8" data-count={people.length}>
            {people.map(p => (
              <div
                key={p.id}
                data-person={p.id === 'me' ? undefined : p.id}
                data-waiting={!p.connected}
                className="gcall-person animate-in fade-in zoom-in-90 duration-500"
                style={{ '--tint': p.id === 'me' ? '#A7F3D0' : tintFor(p.id) } as React.CSSProperties}
              >
                <div className="gcall-circle">
                  <span className="call-voice-ring" aria-hidden="true" />
                  <span className="call-voice-ring call-voice-ring-far" aria-hidden="true" />
                  <span className="gcall-initial">{initialOf(p.name)}</span>
                </div>
                <span className="gcall-name">
                  {p.id === 'me' ? 'You' : p.name}
                  {p.id === 'me' && call.muted && <MicOff className="ml-1 inline h-3 w-3" aria-label="Muted" />}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex min-h-[7.5rem] w-full max-w-sm items-end justify-around">
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
              Not now
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('confirm');
                onJoin();
              }}
              aria-label="Join"
              className="flex flex-col items-center gap-2.5 text-[13px] text-white/85"
            >
              <span className="call-key call-key-answer h-[68px] w-[68px]">
                <Phone className="h-7 w-7" />
              </span>
              Join
            </button>
          </>
        )}

        {call.phase === 'active' && (
          <div className="flex w-full flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="flex w-full items-start justify-around">
              <button
                type="button"
                onClick={() => {
                  haptic('tick');
                  onToggleMute();
                }}
                aria-label={call.muted ? 'Unmute' : 'Mute'}
                aria-pressed={call.muted}
                className="flex flex-col items-center gap-2 text-[12px] text-white/85"
              >
                <span className="call-key h-14 w-14" data-on={call.muted}>
                  {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </span>
                {call.muted ? 'Muted' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('tick');
                  onToggleSpeaker();
                }}
                aria-label={call.speaker ? 'Use earpiece' : 'Use speaker'}
                aria-pressed={call.speaker}
                className="flex flex-col items-center gap-2 text-[12px] text-white/85"
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
              <button
                type="button"
                onClick={() => {
                  haptic('tick');
                  onToggleNoise();
                }}
                aria-label={call.noiseReduction ? 'Let the room back in' : 'Take out background noise'}
                aria-pressed={call.noiseReduction}
                className="flex flex-col items-center gap-2 text-[12px] text-white/85"
              >
                <span className="call-key h-14 w-14" data-on={call.noiseReduction}>
                  <AudioLines className="h-6 w-6" />
                </span>
                {call.noiseReduction ? 'Quiet on' : 'Quiet'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic('tick');
                onLeave();
              }}
              aria-label="Leave call"
              className="flex flex-col items-center gap-2 text-[13px] text-white/85"
            >
              <span className="call-key call-key-end h-[68px] w-[68px]">
                <PhoneOff className="h-7 w-7" />
              </span>
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
