import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, Headphones, Ear, Lock, ChevronDown, AudioLines, Users } from 'lucide-react';
import type { GroupCallEnd, GroupCallState } from '../core/groupCall';
import { haptic } from '../core/haptics';
import { useBackLayer } from '../core/backStack';
import { DockKey, SwipeToAnswer } from './CallOverlay';

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
 * The group call screen, in the same aurora glass as a call between the two
 * of you (components/CallOverlay): the aurora sky, the group's circle ringed
 * with turning light while it rings, and once you are in, a circle for
 * everyone whose halo lights up as they speak; one still finding its way to
 * this phone is dimmed. The keys float in the glass dock, a ring is
 * answered by sliding up, and the end says how long you were in. Made small, it is a pill at the top of Two.
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

  // Each circle's halo lights with its voice, set straight on the circles
  // rather than through React.
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (call.phase !== 'active' || small) return;
    const levels: Record<string, number> = {};
    const id = setInterval(() => {
      const heard = voiceLevels();
      grid.current?.querySelectorAll<HTMLElement>('[data-person]').forEach(el => {
        const who = el.dataset.person || '';
        levels[who] = Math.max(heard[who] ?? 0, (levels[who] ?? 0) * 0.8);
        el.style.setProperty('--voice', levels[who].toFixed(3));
      });
    }, 120);
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
          className="call-pill pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200"
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
  const wasIn = call.phase === 'ended' && call.joinedAt > 0;
  const waitingForOthers = call.phase === 'active' && call.peers.length === 0;
  // The group's own circle stands in the middle while it rings, while you
  // wait for the first to join, and at the end; the people, once there are some.
  const showPeople = call.phase === 'active' && !waitingForOthers;
  const people = [{ id: 'me', name: myName || 'You', connected: true }, ...call.peers];
  const route = call.speaker ? 'Speaker' : call.headset ? 'Earphones' : 'Earpiece';

  let status: React.ReactNode = null;
  if (call.phase === 'incoming') status = `${call.caller} is calling the group`;
  else if (waitingForOthers) status = 'Ringing the group…';
  else if (call.phase === 'active') {
    status = (
      <span className="tabular-nums">
        <span className="text-[20px] font-medium tracking-wide text-white">{clock(now - call.joinedAt)}</span>
        <span className="mt-1 block text-[13px] text-white/70">{inCall} in call</span>
      </span>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Group call in ${groupName}`}
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
        {showPeople ? (
          <div ref={grid} className="gcall-grid" data-count={people.length}>
            {people.map(p => (
              <div
                key={p.id}
                data-person={p.id === 'me' ? undefined : p.id}
                data-waiting={!p.connected}
                className="gcall-person"
                style={{ '--tint': p.id === 'me' ? '#A7F3D0' : tintFor(p.id) } as React.CSSProperties}
              >
                <div className="gcall-circle">
                  <span className="gcall-halo" aria-hidden="true" />
                  <span className="gcall-initial">{initialOf(p.name)}</span>
                </div>
                <span className="gcall-name">
                  {p.id === 'me' ? 'You' : p.name}
                  {p.id === 'me' && call.muted && <MicOff className="ml-1 inline h-3 w-3" aria-label="Muted" />}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="call-hero"
            data-ringing={call.phase === 'incoming' || waitingForOthers}
            data-ended={call.phase === 'ended'}
            aria-hidden="true"
          >
            {(call.phase === 'incoming' || waitingForOthers) && (
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
              <Users className="h-14 w-14 text-white" strokeWidth={1.5} />
            </span>
          </div>
        )}

        <h2 className={`${showPeople ? 'mt-8' : 'mt-9'} flex items-center gap-2 font-serif text-[30px] font-medium leading-tight tracking-tight`}>
          {groupName}
        </h2>
        <div className="mt-1.5 min-h-[3.25rem] text-center" aria-live="polite">
          {ended ? (
            <div className="call-summary">
              <p className="text-[15px] text-white/85">{ended.title}</p>
              {wasIn && call.endedAt > call.joinedAt && (
                <p className="mt-0.5 font-serif text-[30px] leading-none tabular-nums">{clock(call.endedAt - call.joinedAt)}</p>
              )}
              {ended.detail && <p className="mx-auto mt-1.5 max-w-[17rem] text-[13px] leading-relaxed text-white/60">{ended.detail}</p>}
            </div>
          ) : (
            <div key={`${call.phase}-${waitingForOthers}`} className="call-status text-[15px] text-white/80">
              {status}
            </div>
          )}
        </div>
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
              aria-label="Not now"
              className="call-dock-key mb-7"
            >
              <span className="call-key call-key-end h-[62px] w-[62px]">
                <PhoneOff className="h-6 w-6" />
              </span>
              <span className="call-dock-caption">Not now</span>
            </button>
            <SwipeToAnswer onAnswer={onJoin} />
          </div>
        )}

        {call.phase === 'active' && (
          <div className="call-dock">
            <DockKey
              label={call.muted ? 'Unmute' : 'Mute'}
              caption={call.muted ? 'Muted' : 'Mute'}
              on={call.muted}
              onPress={onToggleMute}
            >
              {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </DockKey>
            <DockKey label={call.speaker ? 'Use earpiece' : 'Use speaker'} caption={route} on={call.speaker} onPress={onToggleSpeaker}>
              {call.speaker ? <Volume2 className="h-6 w-6" /> : call.headset ? <Headphones className="h-6 w-6" /> : <Ear className="h-6 w-6" />}
            </DockKey>
            <DockKey
              label={call.noiseReduction ? 'Let the room back in' : 'Take out background noise'}
              caption={call.noiseReduction ? 'Quiet on' : 'Quiet'}
              on={call.noiseReduction}
              onPress={onToggleNoise}
            >
              <AudioLines className="h-6 w-6" />
            </DockKey>
            <DockKey label="Leave call" caption="Leave" danger onPress={onLeave}>
              <PhoneOff className="h-6 w-6" />
            </DockKey>
          </div>
        )}
      </div>
    </div>
  );
};
