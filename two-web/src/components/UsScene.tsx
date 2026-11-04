import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Volume2, VolumeX } from 'lucide-react';
import type { ChatMessage, WeatherState } from '../types';
import { Heart, Sparkle, Zzz, Drop, Flower, Vein, type Mood } from './StickerArt';
import {
  BOX,
  Blanket,
  HeldBalloon,
  HeldPillow,
  JOINTS,
  NOSE_TIP,
  Pillow,
  ReachArm,
  RiceBowl,
  Rig,
  RigProp,
  Spoon,
  WaterBalloon,
  at,
  type RigArms,
  type RigKind,
  type RigLayers
} from './UsRig';
import {
  DANCE_BEAT,
  DANCES,
  FIRST_RELEASE,
  FLIGHT_MS,
  MOODS,
  NEAR_ACTS,
  PLAY_MS,
  SAY_AT,
  WALK_MS,
  movesFor,
  nearOf,
  perform,
  pillowMoves,
  scootMoves,
  type Act
} from './usMoves';
import { loadSounds, playSound, type SoundName } from '../core/sounds';
import { wsRelay } from '../core/ws';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { isShown } from '../core/shown';
import {
  boopsFor,
  champion,
  chatDay,
  cleanPlayKind,
  goodMorning,
  lastWordLastNight,
  missLevel,
  type Boops,
  type PlayKind,
  type Seat
} from '../core/usTwo';

/** Fired by App when the other one boops (or tickles, pats...) live: detail {kind, combo, quiet}. */
export const BOOPED_EVENT = 'two-booped';
/** Fired by the heart button when this phone sends a heart. */
export const HEART_SENT_EVENT = 'two-heart-sent';

export interface PlayDetail {
  kind: PlayKind;
  combo: number;
  quiet: boolean;
  /** Which dance, for a dance. */
  variant?: number;
}

/** The whole thing, on its own tab; or a small window onto it, on Home. */
export type SceneSize = 'tab' | 'preview';

interface UsSceneProps {
  size: SceneSize;
  activeUser: Seat;
  partnerName: string;
  partnerOnline: boolean;
  partnerTyping: boolean;
  /** When they were last seen, if they share it. */
  partnerLastSeen?: number;
  myWeather: WeatherState;
  theirWeather: WeatherState;
  messages: ChatMessage[];
  boops?: Boops;
  /** A boop, tickle, pinch, pat or pillow for them; `quiet` while they sleep. */
  onPlay: (kind: PlayKind, quiet: boolean, variant?: number) => void;
  onSendHeart: () => void;
  /** The small one on Home opens the tab. */
  onOpen?: () => void;
  /** Whose birthday it is today, if it is someone's (core/surprise): a party all day. */
  party?: Seat | null;
}

const MISS_WORDS = ['All good 😌', 'A little 🙂', 'Missing you 🥺', 'A lot 😭', 'Dangerously high 🚨'];

/** Three rows of five: the cheeky ones, the sweet ones, the silly ones. */
const PLAYS: { kind: PlayKind; emoji: string; label: string }[] = [
  { kind: 'boop', emoji: '👉', label: 'Boop' },
  { kind: 'tickle', emoji: '🤭', label: 'Tickle' },
  { kind: 'pinch', emoji: '🥰', label: 'Pinch cheeks' },
  { kind: 'pat', emoji: '🫶', label: 'Head pat' },
  { kind: 'pillow', emoji: '🪶', label: 'Pillow fight' },
  { kind: 'hug', emoji: '🤗', label: 'Hug' },
  { kind: 'kiss', emoji: '😘', label: 'Kiss' },
  { kind: 'feed', emoji: '🍛', label: 'Feed' },
  { kind: 'nuzzle', emoji: '👃', label: 'Nose rub' },
  { kind: 'flower', emoji: '🌹', label: 'Flower' },
  { kind: 'highfive', emoji: '🙌', label: 'High five' },
  { kind: 'balloon', emoji: '💦', label: 'Water balloon' },
  { kind: 'tease', emoji: '😜', label: 'Tease' },
  { kind: 'dance', emoji: '💃', label: 'Dance' },
  { kind: 'tuck', emoji: '🌙', label: 'Tuck in' }
];

/** What the one it is done to says. */
const SAYS: Record<Act, string> = {
  boop: 'Boop!',
  tickle: 'hahaha!',
  pinch: 'squish!',
  pat: 'aww',
  pillow: 'bonk!',
  hug: 'squeeze!',
  kiss: 'mwah!',
  feed: 'yum!',
  nuzzle: 'nuzzle nuzzle',
  flower: 'for me?!',
  highfive: 'yay!',
  balloon: 'splash!',
  tease: 'hmph!',
  dance: '♪ la la la ♪',
  tuck: 'good night…',
  giggle: 'hehe'
};

/** Taps closer together than this are one combo. */
const COMBO_MS = 700;

/** A pillow thrown this soon after the last joins its run. */
const VOLLEY_MS = 1_000;
/** The soonest a pillow of a run is let go after its tap, and the gap kept between them. */
const QUICK_RELEASE = 200;
const THROW_GAP = 150;
/** What each pillow of a run says as it lands. */
const BONKS = ['bonk!', 'pow!', 'boff!', 'thwap!', 'wham!'];
/** A run of boops climbs the scale, in semitones up (the app's D major pentatonic). */
const BOOP_STEPS = [0, 2, 4, 7, 9, 12];

/** Every sound of the battle (sound-design/recipes.mts), loaded as the scene opens. */
const US_SOUNDS: SoundName[] = [
  'us-boop', 'us-tickle', 'us-hehe', 'us-pinch', 'us-pat', 'us-whoosh', 'us-bonk', 'us-dizzy', 'us-hop', 'us-shh',
  'us-hug', 'us-kiss', 'us-feed', 'us-nuzzle', 'us-flower', 'us-highfive', 'us-splash', 'us-tease', 'us-tuck',
  'us-dance', 'us-dance-2', 'us-dance-3', 'us-dance-4', 'us-dance-5', 'us-dance-6'
];
/** Each dance's own tune (usMoves, ROUTINES): bop, twist, spin, jump and clap, disco, side shuffle. */
const DANCE_TUNES: SoundName[] = ['us-dance', 'us-dance-2', 'us-dance-3', 'us-dance-4', 'us-dance-5', 'us-dance-6'];
/** Felt as a firm buzz when it lands, not a tap. */
const FIRM: ReadonlySet<Act> = new Set<Act>(['pillow', 'balloon', 'highfive', 'hug']);
/** This phone's own choice: sounds on, unless switched off. */
const SOUND_KEY = 'two_us_sound';
function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

const INK = '#3b2723';

type Part = 'night' | 'evening' | 'day';
function partOfDay(at: number): Part {
  const h = new Date(at).getHours();
  return h >= 21 || h < 6 ? 'night' : h >= 18 ? 'evening' : 'day';
}

/**
 * The stage, in the units everything on it is placed by. The tab shows its
 * middle bigger (index.css) and a strip of sky above it, at y below 0.
 */
const W = 320;
const H = 170;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** How much bigger the tab shows the stage, and so the part of it in view. */
const ZOOM: Record<SceneSize, number> = { tab: 1.3, preview: 1 };
const inView = (size: SceneSize): [number, number] => {
  const z = ZOOM[size];
  return [(W * (z - 1)) / (2 * z), (W * (z + 1)) / (2 * z)];
};

/** Where each one's head is on the stage, and how big it is drawn. */
const HEADS: Record<RigKind, { y: number; s: number }> = { bear: { y: 90, s: 0.8 }, bunny: { y: 98, s: 0.74 } };

const motionOk = () => {
  try {
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

/**
 * A piece of the scene in a layer of its own: a box of the stage, drawn
 * once. What moves is the layer - or the layers it is wrapped in - by a
 * transform or a fade the phone's graphics chip does by itself, so nothing
 * is drawn again while it moves.
 */
const Sprite: React.FC<{
  box: [number, number, number, number];
  className?: string;
  style?: React.CSSProperties;
  wraps?: { className: string; style?: React.CSSProperties }[];
  children: React.ReactNode;
}> = ({ box: [x, y, w, h], className, style, wraps = [], children }) => {
  let inner: React.ReactNode = (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
  for (let i = wraps.length - 1; i >= 0; i--) {
    inner = (
      <div className={`fx-l ${wraps[i].className}`} style={wraps[i].style}>
        {inner}
      </div>
    );
  }
  return (
    <div
      className={`us-sprite${className ? ` ${className}` : ''}`}
      style={{ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H), ...style }}
    >
      {inner}
    </div>
  );
};

/** A small rain cloud, for a heavy weather day, its drops each a layer. */
const RainCloud: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <>
    <Sprite box={[x - 20, y - 14, 40, 26]} className="us-bob">
      <g transform={`translate(${x} ${y})`} fill="#cbd5e1" stroke={INK} strokeWidth={2.2}>
        <circle cx={-9} cy={2} r={8} />
        <circle cx={7} cy={3} r={7} />
        <circle cx={0} cy={-4} r={9} />
      </g>
    </Sprite>
    {[
      [x - 7, 0],
      [x + 6, 0.4]
    ].map(([dx, delay]) => (
      <Sprite key={dx} box={[dx - 4, y + 12, 8, 10]} className="us-drip" style={{ animationDelay: `${delay}s` }}>
        <Drop x={dx} y={y + 17} s={0.55} />
      </Sprite>
    ))}
  </>
);

/** A speech bubble over a character, pointing down at it, kept inside what is in view. */
const Bubble: React.FC<{ x: number; y: number; text: string; view: [number, number]; delay?: number }> = ({
  x,
  y,
  text,
  view: [x0, x1],
  delay = 0
}) => {
  const w = Math.max(30, text.length * 6.6 + 18);
  const cx = Math.min(x1 - w / 2 - 4, Math.max(x0 + w / 2 + 4, x));
  return (
    <div className="us-bubble-at" style={{ left: pct(cx, W), top: pct(y, H) }}>
      <div className="us-bubble us-pop" style={delay ? { animationDelay: `${delay}ms` } : undefined}>
        {text}
        <span className="us-bubble-tail" style={{ left: `calc(50% + ${((x - cx) / w) * 100}%)` }} />
      </div>
    </div>
  );
};

/** A spiky "bonk", where the pillow lands. */
function burst(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = i % 2 ? r * 0.5 : r;
    points.push(`${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`);
  }
  return `M${points.join(' L')} Z`;
}

/** One play as it happens: what, to whom, and its number so the same again plays again. */
interface Play {
  n: number;
  kind: Act;
  target: 'me' | 'them';
  combo: number;
  /** The words over their head instead: they are asleep. */
  hush?: boolean;
  /** How long the one doing it takes to hop over first. */
  lead: number;
  /** Seen, not heard: they saw you asleep. */
  quiet?: boolean;
  /** A pillow: when it is let go, and whether it starts a run. */
  release?: number;
  first?: boolean;
  /** Which dance, for a dance - the same on both phones. */
  variant?: number;
}

type Who = 'me' | 'them';
const other = (who: Who): Who => (who === 'me' ? 'them' : 'me');

/** A pillow in the air. Each of a run flies, lands and is heard on its own. */
interface Throw {
  n: number;
  actor: Who;
  target: Who;
  d: 1 | -1;
  /** When it is let go, from the tap. */
  release: number;
  word: string;
}

/** When a play's hit lands, from its start: what the bubble, the buzz and the sound wait for. */
const hitAt = (p: Play) => (p.kind === 'pillow' ? (p.release ?? FIRST_RELEASE) + FLIGHT_MS : p.lead + SAY_AT[p.kind]);

/**
 * "Us two": a little live cartoon of the two of you - a bear for the one who
 * started Two, a bunny for the other, the same on both phones - that shows
 * how things are. Together when they are online, typing when they are,
 * asleep under the moon at night, a rain cloud over whoever is having a
 * heavy day, and a hug when a heart goes either way.
 *
 * The boop battle: on its own tab, the buttons below - or a tap on them -
 * send your bear or bunny hopping over to boop them, tickle them, pinch
 * their cheeks or pat their head, or to throw a pillow from where you
 * stand. It happens on their phone too, except that someone asleep is let
 * sleep: no buzz. Today's and this week's scores below, and last week's
 * champion holds the trophy in the scene. Home shows a small window onto it
 * that opens the tab.
 */
export const UsScene: React.FC<UsSceneProps> = ({
  size,
  activeUser,
  partnerName,
  partnerOnline,
  partnerTyping,
  partnerLastSeen,
  myWeather,
  theirWeather,
  messages,
  boops,
  onPlay,
  onSendHeart,
  onOpen,
  party = null
}) => {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Its moves run only while it is on screen: scrolled away, or with Two
  // in the background (index.css), every layer holds still.
  const sceneRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(true);
  const liveRef = useRef(true);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        liveRef.current = entry.isIntersecting;
        setLive(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const part = partOfDay(now);
  const asleep =
    !partnerOnline && (part === 'night' || (!!partnerLastSeen && now - partnerLastSeen > 10 * 60 * 60 * 1000));

  // A hug: a heart either way.
  const [hugUntil, setHugUntil] = useState(0);
  const hugging = hugUntil > Date.now();

  // The bear is always the one who started Two, the bunny the other.
  const bearIsMe = activeUser === 'user';
  const kindOf = (who: Who): RigKind => ((who === 'me') === bearIsMe ? 'bear' : 'bunny');
  // Nearer each other online, nearer still in a hug.
  const gap = hugging ? 24 : partnerOnline ? 50 : 66;
  const meX = bearIsMe ? 160 - gap : 160 + gap;
  const themX = bearIsMe ? 160 + gap : 160 - gap;
  const homeX = (who: Who) => (who === 'me' ? meX : themX);
  const geo = useRef({ me: meX, them: themX });
  geo.current = { me: meX, them: themX };
  // A birthday: party hats, bunting, balloons and a cake beside the one it is for.
  const partyWho: Who | null = party ? (party === activeUser ? 'me' : 'them') : null;
  const [cheerUntil, setCheerUntil] = useState(0);
  const [cakeTaps, setCakeTaps] = useState(0);
  useEffect(() => {
    if (!partyWho) return;
    setCheerUntil(Date.now() + 4_500);
  }, [partyWho]);
  useEffect(() => {
    if (!cheerUntil) return;
    const t = setTimeout(() => setCheerUntil(0), Math.max(0, cheerUntil - Date.now()));
    return () => clearTimeout(t);
  }, [cheerUntil]);
  /** 1 when the one a play is done to stands to the right. */
  const dirTo = (target: Who) => ((target === 'them') === bearIsMe ? 1 : -1);

  // The play under way, if any, and how far into it each face has got.
  const [play, setPlay] = useState<Play | null>(null);
  const [beat, setBeat] = useState(0);
  const playRef = useRef<Play | null>(null);
  const playN = useRef(0);
  const [throws, setThrows] = useState<Throw[]>([]);
  const lastThrow = useRef<{ at: number; release: number; target: Who; count: number } | null>(null);
  const start = (p: Omit<Play, 'n' | 'lead'>): Play => {
    const cur = playRef.current;
    let lead = 0;
    if (!p.hush && NEAR_ACTS.has(p.kind) && motionOk()) {
      // Already there from the last one - a run of boops - or standing close enough.
      const tall = kindOf(other(p.target)) === 'bear';
      const there = !!cur && !cur.hush && NEAR_ACTS.has(cur.kind) && cur.target === p.target && nearOf(cur.kind, tall) === nearOf(p.kind, tall);
      const apart = Math.abs(geo.current.me - geo.current.them);
      if (!there && Math.abs(apart - nearOf(p.kind, tall)) > 8) lead = WALK_MS;
    }
    const next: Play = { ...p, n: ++playN.current, lead };
    // Pillows: a tap while the last ones are still flying throws another, a
    // beat behind the one before, so a run comes out as a steady stream -
    // one pillow for every tap.
    if (p.kind === 'pillow' && !p.hush) {
      const t = performance.now();
      const prev = lastThrow.current;
      const inRun = !!prev && prev.target === p.target && t - prev.at < VOLLEY_MS;
      next.release = inRun ? Math.max(QUICK_RELEASE, prev.at + prev.release + THROW_GAP - t) : FIRST_RELEASE;
      next.first = !inRun;
      next.combo = inRun ? prev.count + 1 : 1;
      lastThrow.current = { at: t, release: next.release, target: p.target, count: next.combo };
      const flying: Throw = {
        n: next.n,
        actor: other(p.target),
        target: p.target,
        d: dirTo(p.target),
        release: next.release,
        word: BONKS[(next.combo - 1) % BONKS.length]
      };
      setThrows(list => [...list, flying]);
      setTimeout(() => setThrows(list => list.filter(f => f.n !== flying.n)), next.release + FLIGHT_MS + 1_300);
    }
    playRef.current = next;
    setPlay(next);
    setBeat(0);
    return next;
  };

  /** Who is hopping over to the other, and so where each of them stands. */
  const actorOf = (p: Play): Who => other(p.target);
  const nearWho = play && !play.hush && NEAR_ACTS.has(play.kind) ? actorOf(play) : null;
  const xAt = (who: Who) =>
    who === nearWho && play ? homeX(play.target) - dirTo(play.target) * nearOf(play.kind, kindOf(who) === 'bear') : homeX(who);
  const meAt = xAt('me');
  const themAt = xAt('them');

  const meRig = useRef<RigLayers>({});
  const themRig = useRef<RigLayers>({});
  const rigOf = (who: Who) => (who === 'me' ? meRig : themRig);
  const running = useRef<Animation[]>([]);
  const volley = useRef<Animation[]>([]);
  const scoots = useRef<Record<Who, Animation[]>>({ me: [], them: [] });

  useEffect(() => {
    const hug = () => setHugUntil(Date.now() + 4_000);
    const off = wsRelay.subscribe(msg => {
      if (msg.type !== 'REMOTE_RECORD' || msg.record?.type !== 'PULSE' || msg.replay || msg.restoring) return;
      if (msg.record.authorId !== activeUser) hug();
    });
    const playedOnMe = (e: Event) => {
      const d = (e as CustomEvent<Partial<PlayDetail>>).detail || {};
      const kind = cleanPlayKind(d.kind);
      const p = start({ kind, target: 'me', combo: Math.max(1, Number(d.combo) || 1), quiet: !!d.quiet, variant: Number(d.variant) || 0 });
      // Felt when it lands, by someone looking - and never by someone asleep.
      if (!d.quiet && isShown()) {
        const hit = hitAt(p);
        setTimeout(() => haptic(FIRM.has(kind) ? 'confirm' : 'tick'), hit);
        if (kind === 'tickle') [150, 300, 450].forEach(ms => setTimeout(() => haptic('tick'), hit + ms));
      }
    };
    window.addEventListener(HEART_SENT_EVENT, hug);
    window.addEventListener(BOOPED_EVENT, playedOnMe);
    return () => {
      off();
      window.removeEventListener(HEART_SENT_EVENT, hug);
      window.removeEventListener(BOOPED_EVENT, playedOnMe);
    };
  }, [activeUser]);
  useEffect(() => {
    if (!hugUntil) return;
    const t = setTimeout(() => setHugUntil(0), Math.max(0, hugUntil - Date.now()));
    return () => clearTimeout(t);
  }, [hugUntil]);

  // Sounds: heard on this phone while it is on screen and switched on.
  const [soundOn, setSoundOn] = useState(readSoundOn);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  useEffect(() => {
    if (readSoundOn()) loadSounds(US_SOUNDS);
  }, []);
  const hear = (name: SoundName, ms: number, rate?: number) => {
    if (!soundOnRef.current || !liveRef.current || !isShown()) return;
    playSound(name, { delay: Math.max(0, ms) / 1000, rate });
  };
  // The cake tapped: the first line of Happy Birthday, confetti, and both of them hop.
  const tapCake = () => {
    haptic('confirm');
    hear('birthday-jingle', 0);
    setCakeTaps(n => n + 1);
    setCheerUntil(Date.now() + 4_200);
    if (liveRef.current && motionOk()) {
      for (const who of ['me', 'them'] as const) {
        scoots.current[who].forEach(a => a.cancel());
        scoots.current[who] = perform(
          scootMoves(0).map(m => ({ ...m, who: 'target' as const })),
          { target: rigOf(who).current }
        );
      }
    }
  };
  const switchSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    } catch {
      /* private mode: on for now, as it was */
    }
    if (next) {
      loadSounds(US_SOUNDS);
      playSound('us-hop');
    }
  };
  /**
   * Each play's sounds, started on the frame its hit lands (playSound takes
   * the speaker's own delay off), so a sound and what makes it are one.
   * The parts inside a sound are spaced to the moves: three pats 300ms
   * apart, a pinch let go 580ms after the pull begins.
   */
  const soundsFor = (p: Play, timers: ReturnType<typeof setTimeout>[]) => {
    if (p.quiet) return;
    if (p.hush) return hear('us-shh', 0);
    const L = p.lead;
    switch (p.kind) {
      case 'boop':
        hear('us-boop', L + 250, 2 ** (BOOP_STEPS[Math.min(p.combo, BOOP_STEPS.length) - 1] / 12));
        break;
      case 'tickle':
        hear('us-tickle', L + 160);
        break;
      case 'pinch':
        hear('us-pinch', L + 190);
        break;
      case 'pat':
        hear('us-pat', L + 405);
        break;
      case 'pillow': {
        const release = p.release ?? FIRST_RELEASE;
        hear('us-whoosh', release);
        hear('us-bonk', release + FLIGHT_MS, 1 + Math.min(p.combo - 1, 4) * 0.04);
        // Tweeting stars after the last of a run: a newer pillow clears this.
        timers.push(setTimeout(() => hear('us-dizzy', 0), release + FLIGHT_MS + 160));
        break;
      }
      // Each new one's hit, inside its sound (sound-design/recipes.mts), on the frame it lands.
      case 'hug':
        // The first squeeze 70 ms after the arms close, as they are squashed (usMoves, hugMoves).
        hear('us-hug', L + 450);
        break;
      case 'kiss':
        hear('us-kiss', L + 420);
        break;
      case 'feed':
        // Spoon on the bowl; the chomp 0.56 s later, on the 620 ms frame, and three chews.
        hear('us-feed', L + 60);
        break;
      case 'nuzzle':
        // A squeak on each rub, 216 ms apart.
        hear('us-nuzzle', L + 540);
        break;
      case 'flower':
        hear('us-flower', L + 270);
        break;
      case 'highfive':
        hear('us-highfive', L + 420);
        break;
      case 'balloon':
        hear('us-whoosh', FIRST_RELEASE);
        // The splash, and the shake 0.49 s after it.
        hear('us-splash', FIRST_RELEASE + FLIGHT_MS);
        break;
      case 'tease':
        // The raspberry, and the "hmph" 0.6 s in.
        hear('us-tease', 100);
        break;
      case 'dance':
        hear(DANCE_TUNES[(p.variant ?? 0) % DANCE_TUNES.length], L);
        break;
      case 'tuck':
        // A yawn, the blanket laid down 0.65 s in, then the lullaby.
        hear('us-tuck', L + 250);
        break;
      case 'giggle':
        hear('us-hehe', 120);
        break;
    }
  };

  // A play: its moves, its faces as it goes on, and its end.
  useLayoutEffect(() => {
    const p = play;
    if (!p) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!p.hush) {
      MOODS[p.kind].forEach((phase, i) => {
        if (i > 0) timers.push(setTimeout(() => setBeat(i), p.lead + phase.at + (hitAt(p) - p.lead - SAY_AT[p.kind])));
      });
    }
    // A pillow leaves the ones still flying alone: each lands on its own.
    if (p.kind !== 'pillow') {
      running.current.forEach(a => a.cancel());
      running.current = [];
    }
    if (!p.hush && liveRef.current && motionOk()) {
      const d = dirTo(p.target);
      const target = rigOf(p.target).current;
      // A cheek is pulled out from the far side of the face; cheeks puff (chewing, in a huff) from the middle.
      if (target.stretch) target.stretch.style.transformOrigin = p.kind === 'pinch' ? at(d * 30, 4) : at(0, 8);
      const moves =
        p.kind === 'pillow'
          ? pillowMoves(d, p.release ?? FIRST_RELEASE, p.first !== false)
          : movesFor(p.kind, d, p.lead, p.combo, { variant: p.variant, tall: kindOf(actorOf(p)) === 'bear' });
      const started = perform(moves, {
        actor: p.kind === 'giggle' ? undefined : rigOf(actorOf(p)).current,
        target
      });
      if (p.kind === 'pillow') volley.current = [...volley.current.filter(a => a.playState !== 'finished'), ...started];
      else running.current = started;
    }
    soundsFor(p, timers);
    timers.push(
      setTimeout(
        () => {
          if (playRef.current?.n === p.n) playRef.current = null;
          setPlay(cur => (cur && cur.n === p.n ? null : cur));
        },
        p.hush ? 1_900 : hitAt(p) - SAY_AT[p.kind] + PLAY_MS[p.kind]
      )
    );
    return () => timers.forEach(clearTimeout);
    // Each play once, as it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  // Whoever moves - over to the other, back home, closer for a hug - hops there.
  const lastAt = useRef<Record<Who, number> | null>(null);
  useLayoutEffect(() => {
    const before = lastAt.current;
    lastAt.current = { me: meAt, them: themAt };
    if (!before || !liveRef.current || !motionOk()) return;
    for (const who of ['me', 'them'] as const) {
      const moved = (who === 'me' ? meAt : themAt) - before[who];
      if (Math.abs(moved) < 4) continue;
      scoots.current[who].forEach(a => a.cancel());
      scoots.current[who] = perform(
        scootMoves(Math.sign(moved)).map(m => ({ ...m, who: 'target' as const })),
        { target: rigOf(who).current }
      );
      // A pitter-pat as it lands each hop (usMoves, scootMoves).
      hear('us-hop', WALK_MS * 0.55);
      hear('us-hop', WALK_MS, 1.12);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meAt, themAt]);
  useEffect(
    () => () => {
      running.current.forEach(a => a.cancel());
      volley.current.forEach(a => a.cancel());
      scoots.current.me.forEach(a => a.cancel());
      scoots.current.them.forEach(a => a.cancel());
    },
    []
  );

  const miss = useMemo(() => missLevel(messages, partnerOnline, now), [messages, partnerOnline, now]);
  const morning = useMemo(() => goodMorning(messages, now), [messages, now]);
  const lastWord = useMemo(() => lastWordLastNight(messages, now), [messages, now]);
  const score = boopsFor(boops, chatDay(now));
  const theirSeat: Seat = activeUser === 'user' ? 'partner' : 'user';
  const nameOf = (seat: Seat) => (seat === activeUser ? tr('You') : partnerName);
  const weekly = { user: score.weekUser || 0, partner: score.weekPartner || 0 };
  const trophy = champion(score.lastWeek);
  const view = inView(size);

  const moodOf = (who: Who): Mood => {
    if (play && !play.hush && !(play.kind === 'giggle' && who !== play.target)) {
      const role = who === play.target ? 'target' : 'actor';
      const phases = MOODS[play.kind];
      for (let i = Math.min(beat, phases.length - 1); i >= 0; i--) {
        const m = phases[i][role];
        if (m) return m;
      }
    }
    if (hugging) return 'happy';
    if (who === 'them') {
      if (asleep) return 'sleep';
      if (partnerTyping) return 'grin';
      return partnerOnline ? 'happy' : 'smile';
    }
    return 'smile';
  };
  const moodFor = (who: Who): Mood =>
    play && play.kind === 'pillow' && play.combo > 1 && who === play.target && beat === 0 ? 'shock' : moodOf(who);
  const armsOf = (who: Who): RigArms => (hugging ? 'up' : who === 'them' && partnerTyping ? 'hold' : 'down');
  const acting = (who: Who) => !!play && !play.hush && play.kind !== 'giggle' && actorOf(play) === who;

  /** Where two palms meet in a high five, on the stage: between them, high over their heads, so both arms go up clear of their faces. */
  const palmsAt = (p: Play): [number, number] => {
    const actor = actorOf(p);
    return [(xAt(actor) + homeX(p.target)) / 2, Math.min(HEADS[kindOf(actor)].y, HEADS[kindOf(p.target)].y) - 38];
  };

  /** What the one a play is done to holds or wears for it: a palm raised back, a flower taken, a blanket. */
  const theirParts = (p: Play): React.ReactNode => {
    const d = dirTo(p.target);
    const tk = kindOf(p.target);
    const jt = JOINTS[tk];
    const th = HEADS[tk];
    const tx = homeX(p.target);
    const L = p.lead;
    const key = `t${p.n}`;
    switch (p.kind) {
      case 'hug': {
        // Hugging back: an arm round your back - behind you, so only the
        // paw shows, on your far side.
        const actor = actorOf(p);
        const ah = HEADS[kindOf(actor)];
        const ax = xAt(actor);
        return (
          <ReachArm
            key={key}
            kind={tk}
            d={-d as 1 | -1}
            from={[-d * jt.shoulder[0], jt.shoulder[1]]}
            to={[(ax - d * 22 * ah.s - tx) / th.s, (ah.y + 42 * ah.s - th.y) / th.s]}
            move="rig-hug-arm"
            ms={1900}
            delay={L + 60}
            wiggle="rig-rub"
            wiggleDelay={L + 550}
            bow={-8}
          />
        );
      }
      case 'highfive': {
        const [mx, my] = palmsAt(p);
        return (
          <ReachArm
            key={key}
            kind={tk}
            d={-d as 1 | -1}
            from={[-d * jt.shoulder[0], jt.shoulder[1]]}
            to={[(mx - tx) / th.s, (my - th.y) / th.s]}
            move="rig-high5"
            ms={1600}
            delay={L}
            bow={6}
          />
        );
      }
      case 'flower':
        // Handed over at 960 ms (rig-give), and held up beside their face.
        return (
          <RigProp key={key} origin={[-d * 34, 22]} ms={1340} delay={L + 960}>
            <Flower x={-d * 34} y={6} s={0.6} rot={-10 * d} />
          </RigProp>
        );
      case 'tuck':
        return (
          <RigProp key={key} className="rig-blanket" origin={[0, 66]} ms={2800} delay={L}>
            <Blanket />
          </RigProp>
        );
      default:
        return null;
    }
  };

  /**
   * What each of them holds out or wears for a play, moving with them: the
   * arm the one doing it stretches out, the pillow or balloon it holds up,
   * the bowl it feeds them from - and the other's side of it.
   */
  const partsFor = (p: Play, who: Who): React.ReactNode => {
    if (p.hush || p.kind === 'giggle') return null;
    if (who === p.target) return theirParts(p);
    const actor = actorOf(p);
    const d = dirTo(p.target);
    const ak = kindOf(actor);
    const tk = kindOf(p.target);
    const ah = HEADS[ak];
    const th = HEADS[tk];
    const ja = JOINTS[ak];
    const jt = JOINTS[tk];
    const ax = xAt(actor);
    const tx = homeX(p.target);
    const local = (sx: number, sy: number): [number, number] => [(sx - ax) / ah.s, (sy - ah.y) / ah.s];
    const near: [number, number] = [d * ja.shoulder[0], ja.shoulder[1]];
    const far: [number, number] = [-d * ja.shoulder[0], ja.shoulder[1]];
    const L = p.lead;
    const key = `r${p.n}`;
    switch (p.kind) {
      case 'boop':
        return (
          <ReachArm key={key} kind={ak} d={d} from={near} to={local(tx - d * 3 * th.s, th.y + jt.nose * th.s)} move="rig-poke" ms={620} delay={L} bow={5} />
        );
      case 'tickle':
        return (
          <React.Fragment key={key}>
            <ReachArm
              kind={ak}
              d={d}
              from={near}
              to={local(tx - d * 12 * th.s, th.y + (jt.tummy - 3) * th.s)}
              move="rig-hold-out"
              ms={1500}
              delay={L}
              wiggle="rig-wiggle"
              wiggleDelay={L + 180}
              bow={4}
            />
            <ReachArm
              kind={ak}
              d={d}
              from={far}
              to={local(tx - d * 4 * th.s, th.y + (jt.tummy + 6) * th.s)}
              move="rig-hold-out"
              ms={1500}
              delay={L}
              wiggle="rig-wiggle"
              wiggleDelay={L + 225}
              bow={-4}
            />
          </React.Fragment>
        );
      case 'pinch':
        return (
          <ReachArm
            key={key}
            kind={ak}
            d={d}
            from={near}
            to={local(tx - d * (jt.cheek[0] + 2) * th.s, th.y + jt.cheek[1] * th.s)}
            move="rig-pinch-arm"
            ms={1050}
            delay={L}
            bow={7}
          />
        );
      case 'pat':
        return (
          <ReachArm
            key={key}
            kind={ak}
            d={d}
            from={near}
            to={local(tx - d * 4 * th.s, th.y + (jt.top - 3) * th.s)}
            move="rig-hold-out"
            ms={1500}
            delay={L}
            wiggle="rig-pat"
            wiggleDelay={L}
            bow={14}
          />
        );
      case 'hug':
        // An arm round their shoulders, the paw on their back, rubbing it.
        return (
          <ReachArm
            key={key}
            kind={ak}
            d={d}
            from={near}
            to={local(tx + d * 13 * th.s, th.y + 30 * th.s)}
            move="rig-hug-arm"
            ms={1900}
            delay={L}
            wiggle="rig-rub"
            wiggleDelay={L + 400}
            bow={12}
          />
        );
      case 'feed':
        return (
          <React.Fragment key={key}>
            <RigProp origin={[-d * 8, 44]} ms={1800} delay={L}>
              <RiceBowl x={-d * 8} y={44} />
            </RigProp>
            <ReachArm
              kind={ak}
              d={d}
              from={near}
              to={local(tx - d * 18, th.y + (jt.mouth + 2) * th.s)}
              move="rig-feed-arm"
              ms={1500}
              delay={L}
              wiggle="rig-swoop"
              wiggleDelay={L}
              bow={4}
              item={<Spoon ms={1500} delay={L} />}
            />
          </React.Fragment>
        );
      case 'flower':
        return (
          <ReachArm
            key={key}
            kind={ak}
            d={d}
            from={near}
            to={local(tx - d * (22 * th.s + 8), th.y + 14 * th.s)}
            move="rig-give"
            ms={1500}
            delay={L}
            bow={6}
            item={
              <g className="rig-handed" style={{ animationDelay: `${L}ms` }}>
                <Flower x={6} y={-14} s={0.55} rot={18} />
              </g>
            }
          />
        );
      case 'highfive':
        return <ReachArm key={key} kind={ak} d={d} from={near} to={local(...palmsAt(p))} move="rig-high5" ms={1600} delay={L} bow={6} />;
      case 'balloon':
        return <HeldBalloon key={key} d={d} ms={FIRST_RELEASE / 0.8} />;
      default:
        return null;
    }
  };

  /** What a play throws up around them: stars, giggles, hearts, feathers. */
  const effects = (p: Play): React.ReactNode => {
    if (p.hush || !motionOk()) return null;
    const d = dirTo(p.target);
    const tk = kindOf(p.target);
    const th = HEADS[tk];
    const jt = JOINTS[tk];
    const tx = homeX(p.target);
    const L = p.lead;
    const wait = (ms: number): React.CSSProperties => ({ animationDelay: `${L + ms}ms` });
    const css = (vars: Record<string, string | number>, ms: number): React.CSSProperties =>
      ({ ...vars, animationDelay: `${L + ms}ms` }) as React.CSSProperties;
    const ty = (u: number) => th.y + u * th.s;
    const ak = kindOf(actorOf(p));
    const ah = HEADS[ak];
    const ax = xAt(actorOf(p));
    // Between them, and just over the taller one's head.
    const midX = (ax + tx) / 2;
    const tops = Math.min(ah.y, th.y);
    switch (p.kind) {
      case 'boop': {
        const nx = tx - d * 6 * th.s;
        const ny = ty(jt.nose);
        return (
          <React.Fragment key={`fx${p.n}`}>
            <Sprite box={[nx - 9, ny - 9, 18, 18]} className="fx-pop" style={wait(240)}>
              <Sparkle x={nx} y={ny} s={0.85} />
            </Sprite>
            {p.combo >= 3 && (
              <Sprite box={[nx - d * 12 - 6, ny - 18, 12, 12]} className="fx-pop" style={wait(300)}>
                <Sparkle x={nx - d * 12} y={ny - 12} s={0.55} />
              </Sprite>
            )}
          </React.Fragment>
        );
      }
      case 'tickle':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {['ha', 'ha', 'hi', 'he'].map((t, i) => (
              <span
                key={i}
                className="fx-ha"
                style={css(
                  {
                    left: pct(tx + d * (i % 2 ? 16 : 2) * th.s, W),
                    top: pct(ty(jt.top - 6), H),
                    '--hx': `${d * (70 + i * 30)}%`,
                    '--hy': `${-(170 + (i % 2) * 70)}%`,
                    '--hr': d * (i % 2 ? 14 : -10)
                  },
                  260 + i * 270
                )}
              >
                {t}
              </span>
            ))}
            {([-1, 1] as const).map(side => {
              const ex = tx + side * (jt.eyes[0] + 5) * th.s;
              const ey = ty(jt.eyes[1]);
              return (
                <Sprite key={side} box={[ex - 4, ey - 5, 8, 10]} className="fx-tear" style={css({ '--tx': `${side * 170}%` }, 420 + (side > 0 ? 160 : 0))}>
                  <Drop x={ex} y={ey} s={0.5} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      case 'pinch':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {[0, 1].map(i => {
              const cx = tx - d * (jt.cheek[0] + 6 - i * 10) * th.s;
              const cy = ty(jt.cheek[1] - 8 - i * 10);
              return (
                <Sprite key={i} box={[cx - 7, cy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${-d * (40 + i * 30)}%` }, 860 + i * 140)}>
                  <Heart x={cx} y={cy} s={0.42} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      case 'pat':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {[405, 705, 1005].map((ms, i) => {
              const sx = tx - d * 4 * th.s + (i - 1) * 6;
              const sy = ty(jt.top - 12);
              return (
                <Sprite key={`s${i}`} box={[sx - 6, sy - 6, 12, 12]} className="fx-pop" style={wait(ms)}>
                  <Sparkle x={sx} y={sy} s={0.5} />
                </Sprite>
              );
            })}
            {[0, 1, 2].map(i => {
              const hx = tx + (i - 1) * 12;
              const hy = ty(jt.top - 4) - (i === 1 ? 6 : 0);
              return (
                <Sprite key={`h${i}`} box={[hx - 7, hy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${(i - 1) * 40}%` }, 1100 + i * 150)}>
                  <Heart x={hx} y={hy} s={0.4} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      case 'hug':
        return (
          <React.Fragment key={`fx${p.n}`}>
            <Sprite box={[midX - 12, tops - 50, 24, 24]} className="fx-mark" style={wait(380)}>
              <Heart x={midX} y={tops - 38} s={0.8} />
            </Sprite>
            {[0, 1, 2].map(i => {
              const hx = midX + (i - 1) * 16;
              const hy = tops - 28 - (i === 1 ? 6 : 0);
              return (
                <Sprite key={i} box={[hx - 7, hy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${(i - 1) * 50}%` }, 700 + i * 180)}>
                  <Heart x={hx} y={hy} s={0.42} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      case 'kiss': {
        // A little heart left on the cheek, where the lips touched (usMoves, kissMoves).
        const cx = tx - d * 12;
        const cy = (ah.y + th.y) / 2 + 3.7;
        return (
          <React.Fragment key={`fx${p.n}`}>
            <Sprite box={[cx - 7, cy - 7, 14, 14]} className="fx-mark" style={wait(420)}>
              <Heart x={cx} y={cy} s={0.42} fill="#ff6b8b" />
            </Sprite>
            {[0, 1].map(i => {
              const hx = tx + d * (6 + i * 10) * th.s;
              const hy = ty(jt.top - 4);
              return (
                <Sprite key={i} box={[hx - 7, hy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${d * (40 + i * 30)}%` }, 640 + i * 160)}>
                  <Heart x={hx} y={hy} s={0.45} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      }
      case 'feed':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {/* A "nom" with each chew (usMoves, feedMoves). */}
            {[684, 988, 1292].map((ms, i) => (
              <span
                key={i}
                className="fx-ha"
                data-tone="food"
                style={css(
                  {
                    left: pct(tx + d * 20 * th.s, W),
                    top: pct(ty(jt.mouth - 4), H),
                    '--hx': `${d * (60 + i * 20)}%`,
                    '--hy': `${-(150 + i * 30)}%`,
                    '--hr': d * 10
                  },
                  ms
                )}
              >
                nom
              </span>
            ))}
            <Sprite box={[tx - 7, ty(jt.top - 4) - 7, 14, 14]} className="fx-rise" style={wait(1450)}>
              <Heart x={tx} y={ty(jt.top - 4)} s={0.45} />
            </Sprite>
          </React.Fragment>
        );
      case 'nuzzle': {
        // Where the tips of their noses meet (UsRig, NOSE_TIP; leaning in 3 degrees from the feet).
        const tipOf = (x: number, kind: RigKind, s: number, facing: number) => x + facing * (NOSE_TIP[kind][0] + 3.5) * s;
        const nx = (tipOf(ax, ak, ah.s, d) + tipOf(tx, tk, th.s, -d)) / 2;
        const ny = (ah.y + th.y) / 2 + 2.5;
        return (
          <React.Fragment key={`fx${p.n}`}>
            {/* A sparkle on each rub, a little above the noses. */}
            {[540, 756, 972, 1188, 1404].map((ms, i) => {
              const sx = nx + (i % 2 ? 4 : -4);
              const sy = ny - 12 - (i % 2) * 3;
              return (
                <Sprite key={i} box={[sx - 5, sy - 5, 10, 10]} className="fx-pop" style={wait(ms)}>
                  <Sparkle x={sx} y={sy} s={0.42} />
                </Sprite>
              );
            })}
            {[0, 1].map(i => {
              const hx = midX + (i ? 12 : -12);
              const hy = tops - 30;
              return (
                <Sprite key={`h${i}`} box={[hx - 7, hy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${(i ? 1 : -1) * 40}%` }, 1650 + i * 150)}>
                  <Heart x={hx} y={hy} s={0.42} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      }
      case 'flower': {
        // Round the bloom as it is held out, then hearts once it is theirs.
        const fx = tx - d * (22 * th.s + 8) + d * 5;
        const fy = th.y + 14 * th.s - 12;
        return (
          <React.Fragment key={`fx${p.n}`}>
            {[0, 1, 2].map(i => {
              const sx = fx + (i - 1) * 9;
              const sy = fy - 10 - (i === 1 ? 6 : 0);
              return (
                <Sprite key={i} box={[sx - 6, sy - 6, 12, 12]} className="fx-pop" style={wait(300 + i * 110)}>
                  <Sparkle x={sx} y={sy} s={0.45} />
                </Sprite>
              );
            })}
            {[0, 1, 2].map(i => {
              const hx = tx + (i - 1) * 12;
              const hy = ty(jt.top - 4) - (i === 1 ? 6 : 0);
              return (
                <Sprite key={`h${i}`} box={[hx - 7, hy - 7, 14, 14]} className="fx-rise" style={css({ '--rx': `${(i - 1) * 40}%` }, 1000 + i * 150)}>
                  <Heart x={hx} y={hy} s={0.42} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      }
      case 'highfive': {
        // Where the palms meet - up with the jump, 7% of the box.
        const [mx, rest] = palmsAt(p);
        const my = rest - 0.07 * BOX.h * Math.min(ah.s, th.s);
        return (
          <React.Fragment key={`fx${p.n}`}>
            <Sprite box={[mx - 14, my - 14, 28, 28]} className="fx-pop" style={wait(420)}>
              <path d={burst(mx, my, 13)} fill="#ffe066" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            </Sprite>
            <span
              className="fx-word"
              data-tone="clap"
              style={{ left: pct(mx - d * 18, W), top: pct(my - 14, H), animationDelay: `${L + 420}ms`, ['--hr' as string]: -6 } as React.CSSProperties}
            >
              smack!
            </span>
            {[-1, 1].map(side => (
              <Sprite key={side} box={[mx + side * 20 - 6, my - 6, 12, 12]} className="fx-pop" style={wait(470)}>
                <Sparkle x={mx + side * 20} y={my} s={0.5} />
              </Sprite>
            ))}
          </React.Fragment>
        );
      }
      case 'balloon': {
        // Lobbed over in an arc like a pillow, bursting on their head, the
        // water flying off - and flung off again as they shake.
        const sx = homeX(actorOf(p));
        const sy = ah.y - 44 * ah.s;
        const ey = ty(jt.top + 6);
        const peak = Math.min(sy, ey) - 34;
        const go = `${FIRST_RELEASE}ms`;
        const hit = FIRST_RELEASE + FLIGHT_MS;
        return (
          <React.Fragment key={`fx${p.n}`}>
            <Sprite
              box={[tx - 14, ey - 16, 28, 32]}
              wraps={[
                { className: 'fx-fly-x', style: { ['--fx' as string]: `${((sx - tx) / 28) * 100}%`, animationDelay: go } },
                {
                  className: 'fx-fly-y',
                  style: { ['--fy' as string]: `${((sy - ey) / 32) * 100}%`, ['--fpk' as string]: `${((peak - ey) / 32) * 100}%`, animationDelay: go }
                },
                { className: 'fx-spin', style: { ['--d' as string]: d, animationDelay: go } }
              ]}
            >
              <WaterBalloon x={tx} y={ey} s={ah.s * 1.1} />
            </Sprite>
            <Sprite box={[tx - 18, ey - 18, 36, 36]} className="fx-pop" style={{ animationDelay: `${hit}ms` }}>
              <path d={burst(tx, ey, 17)} fill="#9ad8ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            </Sprite>
            <span
              className="fx-word"
              data-tone="water"
              style={{ left: pct(tx - d * 2, W), top: pct(ey - 18, H), animationDelay: `${hit}ms`, ['--hr' as string]: d * 8 } as React.CSSProperties}
            >
              splash!
            </span>
            {[-2, -1, 0, 1, 2, 3].map((spread, i) => (
              <Sprite
                key={i}
                box={[tx - 4, ey - 5, 8, 10]}
                className="fx-splash"
                style={css({ '--fx': `${spread * 120 - 60}%`, '--fy': `${-(120 + (i % 3) * 50)}%` }, hit + i * 20)}
              >
                <Drop x={tx} y={ey} s={0.5} />
              </Sprite>
            ))}
            {[0, 1, 2, 3].map(i => {
              const side = i % 2 ? 1 : -1;
              const dx = tx + side * 18 * th.s;
              const dy = ty(jt.eyes[1]);
              return (
                <Sprite
                  key={`s${i}`}
                  box={[dx - 4, dy - 5, 8, 10]}
                  className="fx-splash"
                  style={css({ '--fx': `${side * (220 + i * 30)}%`, '--fy': `${-(40 + i * 20)}%` }, hit + 490 + i * 60)}
                >
                  <Drop x={dx} y={dy} s={0.4} />
                </Sprite>
              );
            })}
          </React.Fragment>
        );
      }
      case 'tease': {
        // Pbbbt - and a cross little vein on them.
        const mx = ax + d * 4 * ah.s;
        const my = ah.y + (JOINTS[ak].mouth + 6) * ah.s;
        return (
          <React.Fragment key={`fx${p.n}`}>
            <span
              className="fx-ha"
              data-tone="tease"
              style={css({ left: pct(mx + d * 14, W), top: pct(my - 6, H), '--hx': `${d * 90}%`, '--hy': '-120%', '--hr': d * 8 }, 150)}
            >
              pbbbt!
            </span>
            {[0, 1, 2].map(i => (
              <Sprite key={i} box={[mx - 3, my - 3, 6, 7]} className="fx-tear" style={css({ '--tx': `${d * (260 + i * 90)}%` }, 180 + i * 100)}>
                <Drop x={mx} y={my} s={0.28} />
              </Sprite>
            ))}
            <Sprite box={[tx + d * 16 * th.s - 8, ty(jt.top + 4) - 8, 16, 16]} className="fx-mark" style={wait(700)}>
              <Vein x={tx + d * 16 * th.s} y={ty(jt.top + 4)} s={0.7} />
            </Sprite>
          </React.Fragment>
        );
      }
      case 'dance':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {/* A note on every beat, over one of them and then the other. */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const onThem = i % 2 === 1;
              const h = onThem ? th : ah;
              const x = onThem ? tx : ax;
              const side = i % 4 < 2 ? 1 : -1;
              return (
                <span
                  key={i}
                  className="fx-note"
                  style={css({ left: pct(x + side * 14, W), top: pct(h.y - 30 * h.s, H), '--hx': `${side * 80}%`, '--hy': '-260%', '--hr': side * 12 }, i * DANCE_BEAT)}
                >
                  {i % 3 === 1 ? '♫' : '♪'}
                </span>
              );
            })}
            {/* Jump and clap (usMoves, ROUTINES[3]): a sparkle where the hands meet, at the top of each jump. */}
            {p.variant === 3 &&
              [1, 3, 5].flatMap(beat =>
                [
                  { x: ax, h: ah },
                  { x: tx, h: th }
                ].map(({ x, h }, j) => {
                  const sy = h.y - 52 * h.s;
                  return (
                    <Sprite key={`c${beat}${j}`} box={[x - 7, sy - 7, 14, 14]} className="fx-pop" style={wait(beat * DANCE_BEAT)}>
                      <Sparkle x={x} y={sy} s={0.6} />
                    </Sprite>
                  );
                })
              )}
          </React.Fragment>
        );
      case 'tuck':
        return (
          <React.Fragment key={`fx${p.n}`}>
            {[0, 1].map(i => {
              const sx = tx + (i ? 1 : -1) * 26 * th.s;
              const sy = ty(jt.tummy - 14);
              return (
                <Sprite key={`s${i}`} box={[sx - 5, sy - 5, 10, 10]} className="fx-pop" style={wait(950 + i * 120)}>
                  <Sparkle x={sx} y={sy} s={0.4} />
                </Sprite>
              );
            })}
            {[0, 1].map(i => (
              <Sprite
                key={i}
                box={[tx + 10, ty(jt.top) - 30, 36, 26]}
                className="fx-rise"
                style={css({ '--rx': '30%', animationDuration: '1800ms' }, 1300 + i * 800)}
              >
                <Zzz x={tx + 12} y={ty(jt.top) - 6} />
              </Sprite>
            ))}
          </React.Fragment>
        );
      default:
        return null;
    }
  };

  /** A pillow's flight across in an arc, its landing, its feathers - and stars after the last of a run. */
  const pillowFx = (t: Throw, last: boolean): React.ReactNode => {
    if (!motionOk()) return null;
    const d = t.d;
    const tk = kindOf(t.target);
    const th = HEADS[tk];
    const jt = JOINTS[tk];
    const tx = homeX(t.target);
    const ah = HEADS[kindOf(t.actor)];
    const sx = homeX(t.actor);
    const sy = ah.y - 44 * ah.s;
    const ex = tx;
    const ey = th.y - 4 * th.s;
    const peak = Math.min(sy, ey) - 26;
    const top = th.y + (jt.top - 6) * th.s;
    const go = `${t.release}ms`;
    const hit = t.release + FLIGHT_MS;
    return (
      <React.Fragment key={`t${t.n}`}>
        <Sprite
          box={[ex - 18, ey - 15, 36, 30]}
          wraps={[
            { className: 'fx-fly-x', style: { ['--fx' as string]: `${((sx - ex) / 36) * 100}%`, animationDelay: go } },
            {
              className: 'fx-fly-y',
              style: { ['--fy' as string]: `${((sy - ey) / 30) * 100}%`, ['--fpk' as string]: `${((peak - ey) / 30) * 100}%`, animationDelay: go }
            },
            { className: 'fx-spin', style: { ['--d' as string]: d, animationDelay: go } }
          ]}
        >
          <Pillow x={ex} y={ey} s={ah.s} />
        </Sprite>
        <Sprite box={[ex - 16, ey - 16, 32, 32]} className="fx-pop" style={{ animationDelay: `${hit}ms` }}>
          <path d={burst(ex, ey, 15)} fill="#ffe066" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        </Sprite>
        <span
          className="fx-word"
          style={{ left: pct(ex - d * 2, W), top: pct(ey - 16, H), animationDelay: `${hit}ms`, ['--hr' as string]: d * 8 } as React.CSSProperties}
        >
          {t.word}
        </span>
        {[-1.6, -0.8, 0, 0.8, 1.6].map((spread, i) => (
          <Sprite
            key={i}
            box={[ex - 4, ey - 8, 8, 16]}
            wraps={[
              {
                className: 'fx-fall',
                style: {
                  ['--fx' as string]: `${(d * 0.7 + spread * 0.55) * 250}%`,
                  ['--fy' as string]: `${-(110 + Math.abs(spread) * 45)}%`,
                  animationDelay: `${hit + i * 25}ms`
                }
              },
              { className: 'fx-sway', style: { animationDelay: `${-i * 130}ms` } }
            ]}
          >
            <ellipse cx={ex} cy={ey} rx={2.6} ry={6.5} fill="#fff" stroke={INK} strokeWidth={1.2} />
            <path d={`M${ex},${ey - 5} L${ex},${ey + 6}`} stroke="#d6cdee" strokeWidth={1} />
          </Sprite>
        ))}
        {/* Seeing stars. */}
        {last &&
          [0, 1, 2].map(i => (
            <Sprite
              key={`o${i}`}
              box={[tx - 5, top - 5, 10, 10]}
              wraps={[
                { className: 'fx-orbit', style: { animationDelay: `${hit + 160}ms` } },
                { className: 'fx-ox', style: { animationDelay: `${-i * 200}ms` } },
                { className: 'fx-oy', style: { animationDelay: `${-i * 200 - 150}ms` } }
              ]}
            >
              <Sparkle x={tx} y={top} s={0.42} />
            </Sprite>
          ))}
      </React.Fragment>
    );
  };

  // Tapping them boops (a combo when fast); tapping yourself giggles.
  const combo = useRef({ at: 0, n: 0 });
  // Each Dance does the next dance, starting from any of them; theirs does the same one.
  const nextDance = useRef(Math.floor(Math.random() * DANCES));
  const doPlay = (kind: PlayKind) => {
    haptic(FIRM.has(kind) ? 'confirm' : 'tick');
    if (asleep) {
      // Let sleepers sleep: counted, but not felt on their phone.
      start({ kind, target: 'them', combo: 1, hush: true });
      onPlay(kind, true);
      return;
    }
    let n = 1;
    if (kind === 'boop') {
      const t = Date.now();
      n = t - combo.current.at < COMBO_MS ? combo.current.n + 1 : 1;
      combo.current = { at: t, n };
    }
    let variant: number | undefined;
    if (kind === 'dance') {
      variant = nextDance.current;
      nextDance.current = (variant + 1) % DANCES;
    }
    start({ kind, target: 'them', combo: n, variant });
    onPlay(kind, false, variant);
  };
  const giggle = () => {
    haptic('tick');
    start({ kind: 'giggle', target: 'me', combo: 1 });
  };
  const onKey = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      run();
    }
  };

  const bubbleFor = (p: Play) => {
    if (p.hush) return tr('Shh… {name} is sleeping 😴', { name: partnerName });
    if (p.kind === 'boop' && p.combo >= 2) return tr('Boop ×{n}!', { n: p.combo });
    if (p.kind === 'pillow' && p.combo >= 2) return `${SAYS.pillow} ×${p.combo}`;
    return tr(SAYS[p.kind]);
  };
  const leader = score.user === score.partner ? null : score.user > score.partner ? 'user' : 'partner';

  const character = (who: Who) => {
    const kind = kindOf(who);
    const head = HEADS[kind];
    const bx = 160 + BOX.x * head.s;
    const by = head.y + BOX.y * head.s;
    const bw = BOX.w * head.s;
    const bh = BOX.h * head.s;
    const doing = acting(who);
    return (
      // Moved by its layer: over to the other and back, nearer or further
      // as you come and go.
      <div
        key={who}
        className="us-char"
        style={{
          left: pct(bx, W),
          top: pct(by, H),
          width: pct(bw, W),
          height: pct(bh, H),
          transform: `translateX(${((xAt(who) - 160) / bw) * 100}%)`,
          zIndex: doing ? 3 : 2
        }}
      >
        <Rig
          kind={kind}
          mood={moodFor(who)}
          arms={armsOf(who)}
          asleep={who === 'them' && asleep}
          phase={who === 'me' ? 0 : 2.3}
          layers={rigOf(who)}
          hat={!!partyWho}
          facing={who === 'me' ? dirTo('them') : (-dirTo('them') as 1 | -1)}
        >
          {play && partsFor(play, who)}
          {throws
            .filter(t => t.actor === who)
            .map(t => (
              <HeldPillow key={t.n} d={t.d} ms={t.release / 0.8} />
            ))}
        </Rig>
        <span className="us-name" data-night={part === 'night' || undefined}>
          {who === 'me' ? tr('You') : partnerName.length > 12 ? partnerName.slice(0, 11) + '…' : partnerName}
        </span>
        {size === 'tab' &&
          (who === 'them' ? (
            <button
              type="button"
              className="us-tap"
              aria-label={tr('Boop {name}', { name: partnerName })}
              onClick={() => doPlay('boop')}
              onContextMenu={e => e.preventDefault()}
            />
          ) : (
            <button type="button" className="us-tap" aria-label={tr('Giggle')} onClick={giggle} />
          ))}
      </div>
    );
  };

  const scene = (
    <div
      ref={sceneRef}
      className="us-scene rounded-2xl"
      data-size={size}
      data-part={part}
      data-live={live || undefined}
    >
      <div className="us-stage" role="img" aria-label={tr('You and {name}', { name: partnerName })}>
        {/* What never moves, drawn once: the sun or moon, the hill. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="us-ground" overflow="visible" aria-hidden="true" focusable="false">
          {part === 'night' ? (
            <path
              d={size === 'tab' ? 'M262,-30 A16,16 0 1 0 276,-8 A12,12 0 1 1 262,-30 Z' : 'M286,18 A16,16 0 1 0 300,40 A12,12 0 1 1 286,18 Z'}
              fill="#ffe58a"
              stroke={INK}
              strokeWidth={2}
            />
          ) : (
            <circle
              cx={size === 'tab' ? 258 : 284}
              cy={size === 'tab' ? -14 : 30}
              r={part === 'evening' ? 15 : 13}
              fill={part === 'evening' ? '#ff8a5c' : '#ffd23f'}
              stroke={INK}
              strokeWidth={2}
            />
          )}
          <path
            d="M-60,170 L-60,142 C10,118 110,126 160,128 C220,130 300,116 380,138 L380,170 Z"
            fill={part === 'night' ? '#2c4a3a' : part === 'evening' ? '#9bc47a' : '#8fd47e'}
          />
          <path
            d="M-60,170 L-60,160 C40,150 120,156 160,155 C230,154 300,150 380,158 L380,170 Z"
            fill={part === 'night' ? '#253f31' : part === 'evening' ? '#8db76d' : '#7fc96f'}
          />
        </svg>

        {/* Everything that moves, each in its own layer. */}
        {part === 'night' ? (
          <>
            <Sprite box={[0, -36, W, 96]} className="us-twinkle">
              {[[24, 22], [96, 18], [230, 20], [300, 28], [70, -20], [196, -26]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" />
              ))}
            </Sprite>
            <Sprite box={[0, -36, W, 96]} className="us-twinkle" style={{ animationDelay: '1.3s' }}>
              {[[60, 46], [262, 52], [140, 40], [118, -10], [228, -4]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" />
              ))}
            </Sprite>
          </>
        ) : (
          <>
            <Sprite box={[38, 14, 50, 26]} className="us-cloud">
              <g fill="#fff" opacity={0.92}>
                <ellipse cx={60} cy={30} rx={20} ry={8} />
                <ellipse cx={72} cy={24} rx={12} ry={8} />
              </g>
            </Sprite>
            {size === 'tab' && (
              <Sprite box={[176, -30, 44, 22]} className="us-cloud" style={{ animationDelay: '-9s' }}>
                <g fill="#fff" opacity={0.85}>
                  <ellipse cx={196} cy={-14} rx={18} ry={7} />
                  <ellipse cx={206} cy={-19} rx={10} ry={7} />
                </g>
              </Sprite>
            )}
          </>
        )}

        {partyWho &&
          (() => {
            // Bunting along the top, balloons tied to a cake on the grass
            // beside the one whose day it is.
            const top = size === 'tab' ? -24 : 6;
            const flags = Array.from({ length: 11 }, (_, i) => {
              const t = (i + 0.5) / 11;
              const x = 20 + 280 * t;
              const y = top + 2 * t * (1 - t) * 16;
              return { x, y, c: ['#ff6b8b', '#ffd23f', '#6cc6ff', '#8ee0a1', '#b69cff'][i % 5] };
            });
            const hx = homeX(partyWho);
            const side = hx < 160 ? -1 : 1;
            // Beside them on the outside, but never past the edge of what is in view.
            const cx = Math.min(view[1] - 24, Math.max(view[0] + 24, hx + side * 46));
            return (
              <>
                <Sprite box={[14, top - 4, 292, 30]}>
                  <path d={`M20,${top} Q160,${top + 16} 300,${top}`} fill="none" stroke={INK} strokeWidth={1.4} />
                  {flags.map((f, i) => (
                    <path key={i} d={`M${f.x - 6},${f.y} L${f.x + 6},${f.y} L${f.x},${f.y + 10} Z`} fill={f.c} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
                  ))}
                </Sprite>
                {[
                  [cx - 10, 62, '#ff6b8b', 0],
                  [cx + 10, 54, '#6cc6ff', -1.1],
                  [cx, 44, '#ffd23f', -2.2]
                ].map(([bx, by, c, delay], i) => (
                  <Sprite key={i} box={[(bx as number) - 9, (by as number) - 12, 18, 66 - ((by as number) - 44)]} className="us-balloon" style={{ animationDelay: `${delay}s` }}>
                    <path d={`M${bx},${(by as number) + 11} Q${(bx as number) + 4},${(by as number) + 30} ${cx},${118}`} fill="none" stroke={INK} strokeWidth={1} />
                    <ellipse cx={bx as number} cy={by as number} rx={8} ry={10} fill={c as string} stroke={INK} strokeWidth={1.8} />
                    <ellipse cx={(bx as number) - 3} cy={(by as number) - 4} rx={2} ry={3} fill="#fff" opacity={0.6} />
                  </Sprite>
                ))}
                <Sprite box={[cx - 20, 112, 40, 40]}>
                  <ellipse cx={cx} cy={149} rx={19} ry={3.2} fill="#eef2ff" stroke={INK} strokeWidth={1.6} />
                  <rect x={cx - 15} y={131} width={30} height={18} rx={4} fill="#ffb3c7" stroke={INK} strokeWidth={1.8} />
                  <path d={`M${cx - 15},${136} Q${cx - 11},${140} ${cx - 7},${136} Q${cx - 3},${141} ${cx + 1},${136} Q${cx + 5},${140} ${cx + 9},${136} Q${cx + 12},${140} ${cx + 15},${136} V${134} Q${cx + 15},${131} ${cx + 12},${131} H${cx - 12} Q${cx - 15},${131} ${cx - 15},${134} Z`} fill="#fff" stroke={INK} strokeWidth={1.2} />
                  <rect x={cx - 10} y={120} width={20} height={12} rx={3} fill="#fff1d6" stroke={INK} strokeWidth={1.8} />
                  {[-5, 0, 5].map(dx => (
                    <rect key={dx} x={cx + dx - 1.2} y={113} width={2.4} height={7} rx={1} fill="#fff" stroke={INK} strokeWidth={1} />
                  ))}
                </Sprite>
                {[-5, 0, 5].map((dx, i) => (
                  <Sprite key={`f${dx}`} box={[cx + dx - 2, 106, 4, 7]} className="us-flame" style={{ animationDelay: `${-i * 0.15}s` }}>
                    <path d={`M${cx + dx},${106.5} C${cx + dx + 2.2},${109.5} ${cx + dx + 1.8},${112.5} ${cx + dx},${112.8} C${cx + dx - 1.8},${112.5} ${cx + dx - 2.2},${109.5} ${cx + dx},${106.5} Z`} fill="#ffd23f" stroke="#ff8a3d" strokeWidth={0.8} />
                  </Sprite>
                ))}
                {cakeTaps > 0 &&
                  Array.from({ length: 14 }, (_, i) => (
                    <span
                      key={`c${cakeTaps}-${i}`}
                      className="us-confetti"
                      style={
                        {
                          left: pct(cx, W),
                          top: pct(110, H),
                          background: ['#ff6b8b', '#ffd23f', '#6cc6ff', '#8ee0a1', '#b69cff'][i % 5],
                          animationDelay: `${(i % 4) * 40}ms`,
                          '--dx': `${Math.round((i / 13 - 0.5) * 120)}px`,
                          '--up': `${40 + (i % 3) * 18}px`,
                          '--spin': `${(i % 2 ? 1 : -1) * (200 + i * 30)}deg`
                        } as React.CSSProperties
                      }
                    />
                  ))}
                {size === 'tab' && (
                  <button
                    type="button"
                    className="us-cake-tap"
                    style={{ left: pct(cx - 20, W), top: pct(104, H), width: pct(40, W), height: pct(48, H) }}
                    onClick={tapCake}
                    aria-label={tr('Happy Birthday!')}
                  />
                )}
              </>
            );
          })()}

        {/* Between them while you are both here: a little heart; in a hug, more. */}
        {(partnerOnline || hugging) && !play && (
          <Sprite box={hugging ? [146, 30, 28, 26] : [151, 51, 18, 17]} className="us-beat">
            <Heart x={160} y={hugging ? 44 : 60} s={hugging ? 0.9 : 0.55} />
          </Sprite>
        )}
        {hugging && (
          <>
            <Sprite box={[120, 30, 16, 16]} className="us-rise">
              <Heart x={128} y={40} s={0.5} />
            </Sprite>
            <Sprite box={[185, 26, 14, 14]} className="us-rise" style={{ animationDelay: '0.5s' }}>
              <Heart x={192} y={36} s={0.45} />
            </Sprite>
          </>
        )}

        {/* Heavy weather over whoever has it; sun-sparkles for a sunny one. */}
        {(myWeather === 'RAINY' || myWeather === 'STORMY') && <RainCloud x={meX} y={24} />}
        {(theirWeather === 'RAINY' || theirWeather === 'STORMY') && <RainCloud x={themX} y={24} />}
        {myWeather === 'SUNNY' && (
          <Sprite box={[meX + 19, 31, 18, 18]} className="us-spin">
            <Sparkle x={meX + 28} y={40} s={0.6} />
          </Sprite>
        )}
        {theirWeather === 'SUNNY' && (
          <Sprite box={[themX + 19, 31, 18, 18]} className="us-spin">
            <Sparkle x={themX + 28} y={40} s={0.6} />
          </Sprite>
        )}
        {asleep && (
          <Sprite box={[themX + 12, 18, 36, 26]} className="us-rise us-forever">
            <Zzz x={themX + 14} y={42} />
          </Sprite>
        )}

        {character('them')}
        {character('me')}
        {play && effects(play)}
        {throws.map((t, i) => pillowFx(t, i === throws.length - 1))}

        {/* Last week's champion holds the trophy, on the grass beside them. */}
        {trophy &&
          !partyWho &&
          (() => {
            const x = trophy === activeUser ? meX : themX;
            const side = x < 160 ? -1 : 1;
            return (
              <span className="us-trophy" style={{ left: pct(x + side * 40, W), top: pct(146, H) }} aria-hidden="true">
                🏆
              </span>
            );
          })()}

        {play && (
          <Bubble
            key={`b${play.n}`}
            x={homeX(play.target)}
            y={34}
            text={bubbleFor(play)}
            view={view}
            delay={play.hush ? 0 : hitAt(play)}
          />
        )}
        {!play && partyWho && cheerUntil > Date.now() && (
          <Bubble key={`cheer${cakeTaps}`} x={homeX(partyWho)} y={30} text={tr('Happy birthday! 🎂')} view={view} />
        )}
        {!play && !(partyWho && cheerUntil > Date.now()) && partnerTyping && !hugging && <Bubble x={themX} y={30} text="• • •" view={view} />}
        {!play && !(partyWho && cheerUntil > Date.now()) && !partnerOnline && !asleep && !partnerTyping && <Bubble x={themX} y={30} text="…" view={view} />}
      </div>
      {size === 'tab' && (
        <button
          type="button"
          className="us-sound"
          aria-pressed={soundOn}
          aria-label={soundOn ? tr('Sounds on') : tr('Sounds off')}
          onClick={switchSound}
        >
          {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );

  // On Home: the window onto it, opening the tab.
  if (size === 'preview') {
    return (
      <div
        role="button"
        tabIndex={0}
        className="us-preview"
        aria-label={tr('Play with {name}', { name: partnerName })}
        onClick={onOpen}
        onKeyDown={onKey(() => onOpen?.())}
      >
        {scene}
        <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
          <span className="tabular-nums text-linen-primary">
            <span className="text-linen-secondary">{tr('Boops today')} · </span>
            {leader === activeUser && '👑 '}
            {tr('You')} <b>{score[activeUser]}</b>
            <span className="mx-1.5 text-linen-secondary">·</span>
            {leader === theirSeat && '👑 '}
            {partnerName} <b>{score[theirSeat]}</b>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-linen-accent">
            {tr('Play')}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    );
  }

  const side = (seat: Seat) => (
    <div className="us-board-side" data-lead={leader === seat || undefined}>
      <span className="us-board-who">
        {seat === 'user' ? '🐻' : '🐰'} {nameOf(seat)}
        {leader === seat && ' 👑'}
      </span>
      <span key={score[seat]} className="us-board-n us-pop">
        {score[seat]}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {scene}

      {/* The plays, under your thumb. */}
      <div>
        <div className="us-pad" role="group" aria-label={tr('Play with {name}', { name: partnerName })}>
          {PLAYS.map(p => (
            <button key={p.kind} type="button" className="us-pad-btn" data-kind={p.kind} onClick={() => doPlay(p.kind)}>
              <span className="us-pad-ico" aria-hidden="true">
                {p.emoji}
              </span>
              <span>{tr(p.label)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-linen-secondary">
          {asleep
            ? tr('Shh… {name} is sleeping 😴', { name: partnerName })
            : tr('Or tap {name} in the picture', { name: partnerName })}
        </p>
      </div>

      {/* The scores: today, this week, and last week's champion. */}
      <div className="us-board">
        <p className="us-board-title">{tr('Boops today')}</p>
        <div className="us-board-row">
          {side(activeUser)}
          <span className="us-board-vs">{tr('vs')}</span>
          {side(theirSeat)}
        </div>
        <p className="mt-2.5 text-center text-[12px] tabular-nums text-linen-secondary">
          {tr('This week')} · {tr('You')} <b className="text-linen-primary">{weekly[activeUser]}</b>
          <span className="mx-1.5">·</span>
          {partnerName} <b className="text-linen-primary">{weekly[theirSeat]}</b>
        </p>
        {trophy && score.lastWeek && (
          <p className="mt-1.5 text-center text-[12px] text-linen-primary">
            🏆 {tr("Last week's champion: {name} ({a} to {b})", {
              name: nameOf(trophy),
              a: Math.max(score.lastWeek.user, score.lastWeek.partner),
              b: Math.min(score.lastWeek.user, score.lastWeek.partner)
            })}
          </p>
        )}
      </div>

      {/* Good morning, and the last word last night. */}
      <div className="space-y-1 text-[13px] text-linen-primary">
        <p>
          ☀️{' '}
          {morning.winner
            ? morning.streak > 1
              ? tr('{name} said good morning first · {n} days in a row', { name: nameOf(morning.winner), n: morning.streak })
              : tr('{name} said good morning first', { name: nameOf(morning.winner) })
            : tr('Nobody has said good morning yet today')}
        </p>
        {lastWord && <p>🌙 {tr('{name} had the last word last night', { name: nameOf(lastWord) })}</p>}
      </div>

      {/* How much you are missing each other. */}
      <div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-linen-secondary">{tr('Miss-you meter')}</span>
          <span className="font-medium text-linen-primary">{tr(MISS_WORDS[miss.level])}</span>
        </div>
        <div className="miss-meter mt-1.5" data-level={miss.level} aria-hidden="true">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} data-on={i <= miss.level || undefined} />
          ))}
        </div>
        {miss.level >= 2 && (
          <button
            type="button"
            onClick={() => {
              haptic('confirm');
              onSendHeart();
            }}
            className="mt-2.5 w-full rounded-xl bg-linen-variant/70 px-3 py-2 text-[13px] font-semibold text-linen-primary transition-colors hover:bg-linen-variant active:scale-[0.98]"
          >
            {tr('Send {name} a heart', { name: partnerName })} ❤️
          </button>
        )}
      </div>
    </div>
  );
};
