import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, WeatherState } from '../types';
import { Bear, Bunny, Heart, Sparkle, Zzz, Drop, type Mood } from './StickerArt';
import { wsRelay } from '../core/ws';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { useBackLayer } from '../core/backStack';
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
}

interface UsSceneProps {
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
  onPlay: (kind: PlayKind, quiet: boolean) => void;
  onSendHeart: () => void;
}

const MISS_WORDS = ['All good 😌', 'A little 🙂', 'Missing you 🥺', 'A lot 😭', 'Dangerously high 🚨'];

const PLAYS: { kind: PlayKind; emoji: string; label: string }[] = [
  { kind: 'boop', emoji: '👉', label: 'Boop' },
  { kind: 'tickle', emoji: '🤭', label: 'Tickle' },
  { kind: 'pinch', emoji: '🥰', label: 'Pinch cheeks' },
  { kind: 'pat', emoji: '🫶', label: 'Head pat' },
  { kind: 'pillow', emoji: '🪶', label: 'Pillow fight' }
];

/** What the one it is done to says. */
const SAYS: Record<PlayKind | 'giggle', string> = {
  boop: 'Boop!',
  tickle: 'hahaha!',
  pinch: 'squish!',
  pat: 'aww',
  pillow: 'bonk!',
  giggle: 'hehe'
};

/** How the one it is done to looks. */
const LOOKS: Record<PlayKind | 'giggle', Mood> = {
  boop: 'laugh',
  tickle: 'laugh',
  pinch: 'happy',
  pat: 'kiss',
  pillow: 'shock',
  giggle: 'laugh'
};

/** Taps closer together than this are one combo. */
const COMBO_MS = 700;
/** Held this long, a press opens the menu instead of booping. */
const HOLD_MS = 450;

const BEAR_FUR = '#c4895a';
const BUNNY_FUR = '#fffaf3';
const INK = '#3b2723';

type Part = 'night' | 'evening' | 'day';
function partOfDay(at: number): Part {
  const h = new Date(at).getHours();
  return h >= 21 || h < 6 ? 'night' : h >= 18 ? 'evening' : 'day';
}

/** The scene's own size, in the units everything in it is placed by. */
const W = 320;
const H = 170;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * A piece of the scene in a layer of its own: a box of the scene, drawn
 * once. What moves is the layer - a transform or a fade the phone's
 * graphics chip does by itself - so nothing is drawn again while it moves,
 * and the page's own work is never held up by it. (Moving a part inside one
 * picture made the phone draw the whole picture again on every frame.)
 */
const Sprite: React.FC<{
  box: [number, number, number, number];
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ box: [x, y, w, h], className, style, children }) => (
  <div
    className={`us-sprite${className ? ` ${className}` : ''}`}
    style={{ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H), ...style }}
  >
    <svg viewBox={`${x} ${y} ${w} ${h}`} width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false">
      {children}
    </svg>
  </div>
);

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

/** A speech bubble over a character, pointing down at it, kept inside the scene. */
const Bubble: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => {
  const w = Math.max(30, text.length * 6.6 + 18);
  const cx = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, x));
  return (
    <div className="us-bubble-at" style={{ left: pct(cx, W), top: pct(y, H) }}>
      <div className="us-bubble us-pop">
        {text}
        <span className="us-bubble-tail" style={{ left: `calc(50% + ${((x - cx) / w) * 100}%)` }} />
      </div>
    </div>
  );
};

/** One play as it happens: what, to whom, and its number so the same again plays again. */
interface Play {
  n: number;
  kind: PlayKind | 'giggle';
  target: 'me' | 'them';
  combo: number;
  /** The words over their head instead: they are asleep. */
  hush?: boolean;
}

/**
 * Home's "Us two": a little live scene of the two of you - a bear for the
 * one who started Two, a bunny for the other, the same on both phones -
 * that shows how things are. Together when they are online, typing when
 * they are, asleep under the moon at night, a rain cloud over whoever is
 * having a heavy day, and a hug when a heart goes either way.
 *
 * The boop battle: tap them to boop them - fast taps make a combo - or hold
 * for the rest: a tickle, a pinch of the cheeks, a head pat, a pillow. It
 * happens on their phone too, except that someone asleep is let sleep: no
 * buzz. Today's and this week's scores below, and last week's champion
 * holds the trophy in the scene.
 */
export const UsScene: React.FC<UsSceneProps> = ({
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
  onSendHeart
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
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const part = partOfDay(now);
  const asleep =
    !partnerOnline && (part === 'night' || (!!partnerLastSeen && now - partnerLastSeen > 10 * 60 * 60 * 1000));

  // A hug: a heart either way.
  const [hugUntil, setHugUntil] = useState(0);
  // The play under way, if any, for a moment.
  const [play, setPlay] = useState<Play | null>(null);
  const playN = useRef(0);
  const start = (p: Omit<Play, 'n'>) => setPlay({ ...p, n: ++playN.current });
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => setPlay(current => (current && current.n === play.n ? null : current)), 1_900);
    return () => clearTimeout(t);
  }, [play]);

  useEffect(() => {
    const hug = () => setHugUntil(Date.now() + 4_000);
    const off = wsRelay.subscribe(msg => {
      if (msg.type !== 'REMOTE_RECORD' || msg.record?.type !== 'PULSE' || msg.replay || msg.restoring) return;
      if (msg.record.authorId !== activeUser) hug();
    });
    const playedOnMe = (e: Event) => {
      const d = (e as CustomEvent<Partial<PlayDetail>>).detail || {};
      const kind = cleanPlayKind(d.kind);
      // Felt only by someone looking - and never by someone asleep.
      if (!d.quiet && isShown()) {
        haptic(kind === 'pillow' ? 'confirm' : 'tick');
        if (kind === 'tickle') [150, 300, 450].forEach(ms => setTimeout(() => haptic('tick'), ms));
      }
      start({ kind, target: 'me', combo: Math.max(1, Number(d.combo) || 1) });
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
  const hugging = hugUntil > Date.now();

  const miss = useMemo(() => missLevel(messages, partnerOnline, now), [messages, partnerOnline, now]);
  const morning = useMemo(() => goodMorning(messages, now), [messages, now]);
  const lastWord = useMemo(() => lastWordLastNight(messages, now), [messages, now]);
  const score = boopsFor(boops, chatDay(now));
  const theirSeat: Seat = activeUser === 'user' ? 'partner' : 'user';
  const nameOf = (seat: Seat) => (seat === activeUser ? tr('You') : partnerName);
  const weekly = { user: score.weekUser || 0, partner: score.weekPartner || 0 };
  const trophy = champion(score.lastWeek);

  // The bear is always the one who started Two, the bunny the other.
  const bearIsMe = activeUser === 'user';
  // Nearer each other online, nearer still in a hug.
  const gap = hugging ? 24 : partnerOnline ? 50 : 66;
  const meX = bearIsMe ? 160 - gap : 160 + gap;
  const themX = bearIsMe ? 160 + gap : 160 - gap;
  const xOf = (who: 'me' | 'them') => (who === 'me' ? meX : themX);
  const isBear = (who: 'me' | 'them') => (who === 'me') === bearIsMe;
  /** Where a character's head is, and how big it is drawn. */
  const headOf = (who: 'me' | 'them') => (isBear(who) ? { y: 90, s: 0.8 } : { y: 98, s: 0.74 });

  const moodOf = (who: 'me' | 'them'): Mood => {
    if (play && !play.hush) {
      if (play.target === who) return LOOKS[play.kind];
      if (play.kind !== 'giggle') return 'grin';
    }
    if (hugging) return 'happy';
    if (who === 'them') {
      if (asleep) return 'sleep';
      if (partnerTyping) return 'grin';
      return partnerOnline ? 'happy' : 'smile';
    }
    return miss.level >= 3 ? 'puppy' : 'smile';
  };

  /** How the one it is done to moves (index.css, "Us two"). */
  const motionOf = (who: 'me' | 'them'): string => {
    if (!play || play.hush || play.target !== who) return '';
    switch (play.kind) {
      case 'boop':
        return play.combo >= 5 ? 'us-hop-big' : 'us-hop';
      case 'giggle':
        return 'us-hop';
      case 'tickle':
        return 'us-wiggle';
      case 'pinch':
        return 'us-squish';
      case 'pat':
        return 'us-nod';
      case 'pillow':
        return 'us-bonk';
    }
  };

  /** Each character's box in the scene: room for ears, a hop and its name. */
  const CHAR_BOX: [number, number, number, number] = [112, 24, 96, 146];

  const character = (who: 'me' | 'them', tap: React.ReactNode) => {
    const head = headOf(who);
    const motion = motionOf(who);
    const Char = isBear(who) ? Bear : Bunny;
    const arms = hugging ? 'up' : who === 'them' && partnerTyping ? 'hold' : 'down';
    const [x, y, w, h] = CHAR_BOX;
    return (
      // Moved by its layer: nearer or further as you come and go.
      <div
        className="us-sprite us-move"
        style={{ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H), transform: `translateX(${pct(xOf(who) - 160, w)})` }}
      >
        <div key={motion ? `${who}${play?.n}` : who} className={`us-fill ${motion}`}>
          <div className={asleep && who === 'them' ? 'us-fill' : 'us-fill us-breathe'}>
            <svg viewBox={`${x} ${y} ${w} ${h - 18}`} width="100%" height={pct(h - 18, h)} overflow="visible" aria-hidden="true" focusable="false">
              <Char x={160} y={head.y} s={head.s} mood={moodOf(who)} arms={arms} />
            </svg>
          </div>
        </div>
        <span className="us-name" data-night={part === 'night' || undefined}>
          {who === 'me' ? tr('You') : partnerName.length > 12 ? partnerName.slice(0, 11) + '…' : partnerName}
        </span>
        {tap}
      </div>
    );
  };

  /** What a play draws besides the move: hands on cheeks, a patting paw, a flying pillow. */
  const props = () => {
    if (!play || play.hush || play.kind === 'boop' || play.kind === 'giggle') return null;
    const target = play.target;
    const actor = target === 'me' ? 'them' : 'me';
    const x = xOf(target);
    const head = headOf(target);
    const fur = isBear(actor) ? BEAR_FUR : BUNNY_FUR;
    const paw = (cx: number, cy: number) => <ellipse cx={cx} cy={cy} rx={7} ry={6} fill={fur} stroke={INK} strokeWidth={2} />;
    const key = `p${play.n}`;
    switch (play.kind) {
      case 'pinch':
        return (
          <Sprite key={key} box={[x - 40, head.y - 8, 80, 28]} className="us-pinch">
            {paw(x - 21 * head.s - 6, head.y + 6 * head.s)}
            {paw(x + 21 * head.s + 6, head.y + 6 * head.s)}
            <g fill="#ff7d9a" opacity={0.85}>
              <ellipse cx={x - 19 * head.s} cy={head.y + 6 * head.s} rx={6} ry={4} />
              <ellipse cx={x + 19 * head.s} cy={head.y + 6 * head.s} rx={6} ry={4} />
            </g>
          </Sprite>
        );
      case 'pat':
        return (
          <Sprite key={key} box={[x - 10, head.y - 34 * head.s - 9, 20, 18]} className="us-pat">
            {paw(x, head.y - 34 * head.s)}
          </Sprite>
        );
      case 'tickle':
        return (
          <Sprite key={key} box={[x - 36, head.y + 34 * head.s - 9, 72, 18]} className="us-tickle">
            {paw(x - 26, head.y + 34 * head.s)}
            {paw(x + 26, head.y + 34 * head.s)}
          </Sprite>
        );
      case 'pillow': {
        // Thrown from the one doing it: how far that is on this screen.
        const perUnit = (sceneRef.current?.clientWidth || W) / W;
        return (
          <React.Fragment key={key}>
            <Sprite
              box={[x - 16, head.y - 14, 32, 28]}
              className="us-throw"
              style={{ '--dx': `${(xOf(actor) - x) * perUnit}px` } as React.CSSProperties}
            >
              <rect x={x - 13} y={head.y - 8} width={26} height={16} rx={6} fill="#fff" stroke={INK} strokeWidth={2} />
              <path d={`M${x - 9},${head.y - 8} L${x - 13},${head.y - 12} M${x + 9},${head.y + 8} L${x + 13},${head.y + 12}`} stroke={INK} strokeWidth={2} />
            </Sprite>
            {[-14, 0, 13].map((dx, i) => (
              <Sprite
                key={i}
                box={[x + dx - 4, head.y - 26, 8, 16]}
                className="us-feather"
                style={{ animationDelay: `${0.42 + i * 0.08}s` }}
              >
                <ellipse cx={x + dx} cy={head.y - 18} rx={2.5} ry={6} fill="#fff" stroke={INK} strokeWidth={1.2} />
              </Sprite>
            ))}
          </React.Fragment>
        );
      }
    }
  };

  // Tapping them boops (a combo when fast); holding opens the rest.
  const [menuOpen, setMenuOpen] = useState(false);
  useBackLayer(menuOpen, () => setMenuOpen(false));
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; opened: boolean } | null>(null);
  const combo = useRef({ at: 0, n: 0 });
  const doPlay = (kind: PlayKind) => {
    haptic(kind === 'pillow' ? 'confirm' : 'tick');
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
    start({ kind, target: 'them', combo: n });
    onPlay(kind, false);
  };
  const pressStart = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = {
      opened: false,
      timer: setTimeout(() => {
        if (!hold.current) return;
        hold.current.opened = true;
        haptic('tick');
        setMenuOpen(true);
      }, HOLD_MS)
    };
  };
  const pressEnd = (tap: boolean) => {
    const h = hold.current;
    hold.current = null;
    if (!h) return;
    clearTimeout(h.timer);
    if (tap && !h.opened) doPlay('boop');
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
    return p.kind === 'boop' ? tr('Boop!') : SAYS[p.kind];
  };
  const leader = score.user === score.partner ? null : score.user > score.partner ? 'user' : 'partner';

  return (
    <div className="space-y-3">
      <div
        ref={sceneRef}
        className="us-scene relative overflow-hidden rounded-2xl"
        data-part={part}
        data-live={inView || undefined}
        role="img"
        aria-label={tr('You and {name}', { name: partnerName })}
      >
        {/* What never moves, drawn once: the sky, the sun or moon, the hill. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="us-sky" x1="0" y1="0" x2="0" y2="1">
              {part === 'night' ? (
                <>
                  <stop offset="0" stopColor="#1b1546" />
                  <stop offset="1" stopColor="#3a2d7a" />
                </>
              ) : part === 'evening' ? (
                <>
                  <stop offset="0" stopColor="#ffb38a" />
                  <stop offset="1" stopColor="#ffd9c2" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor="#9ed8ff" />
                  <stop offset="1" stopColor="#e3f4ff" />
                </>
              )}
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="url(#us-sky)" />
          {part === 'night' ? (
            <path d="M286,18 A16,16 0 1 0 300,40 A12,12 0 1 1 286,18 Z" fill="#ffe58a" stroke={INK} strokeWidth={2} />
          ) : (
            <circle cx={284} cy={30} r={part === 'evening' ? 15 : 13} fill={part === 'evening' ? '#ff8a5c' : '#ffd23f'} stroke={INK} strokeWidth={2} />
          )}
          <path
            d="M-10,170 L-10,140 C40,120 110,126 160,128 C220,130 280,118 330,136 L330,170 Z"
            fill={part === 'night' ? '#2c4a3a' : part === 'evening' ? '#9bc47a' : '#8fd47e'}
          />
        </svg>

        {/* Everything that moves, each in its own layer. */}
        {part === 'night' ? (
          <>
            <Sprite box={[0, 0, W, 60]} className="us-twinkle">
              {[[24, 22], [96, 18], [230, 20], [300, 28]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" />
              ))}
            </Sprite>
            <Sprite box={[0, 0, W, 60]} className="us-twinkle" style={{ animationDelay: '1.3s' }}>
              {[[60, 46], [262, 52], [140, 40]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" />
              ))}
            </Sprite>
          </>
        ) : (
          <Sprite box={[38, 14, 50, 26]} className="us-cloud">
            <g fill="#fff" opacity={0.92}>
              <ellipse cx={60} cy={30} rx={20} ry={8} />
              <ellipse cx={72} cy={24} rx={12} ry={8} />
            </g>
          </Sprite>
        )}

        {/* Between them while you are both here: a little heart; in a hug, more. */}
        {(partnerOnline || hugging) && (
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

        {character(
          'them',
          <button
            type="button"
            className="us-tap"
            aria-label={tr('Boop {name}', { name: partnerName })}
            onPointerDown={pressStart}
            onPointerUp={() => pressEnd(true)}
            onPointerLeave={() => pressEnd(false)}
            onPointerCancel={() => pressEnd(false)}
            onContextMenu={e => e.preventDefault()}
            onKeyDown={onKey(() => doPlay('boop'))}
          />
        )}
        {character('me', <button type="button" className="us-tap" aria-label={tr('Giggle')} onClick={giggle} />)}
        {props()}

        {/* Last week's champion holds the trophy, on the grass beside them. */}
        {trophy &&
          (() => {
            const x = trophy === activeUser ? meX : themX;
            const side = x < 160 ? -1 : 1;
            return (
              <span className="us-trophy" style={{ left: pct(x + side * 40, W), top: pct(146, H) }} aria-hidden="true">
                🏆
              </span>
            );
          })()}

        {play && <Bubble key={`b${play.n}`} x={xOf(play.target)} y={34} text={bubbleFor(play)} />}
        {!play && partnerTyping && !hugging && <Bubble x={themX} y={30} text="• • •" />}
        {!play && !partnerOnline && !asleep && !partnerTyping && <Bubble x={themX} y={30} text="…" />}

        {/* The rest of the boop battle, from a long press or the button below. */}
        {menuOpen && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/25 p-2" onClick={() => setMenuOpen(false)}>
            <div role="menu" aria-label={tr('Play with {name}', { name: partnerName })} className="us-menu" onClick={e => e.stopPropagation()}>
              {PLAYS.map(p => (
                <button
                  key={p.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    doPlay(p.kind);
                  }}
                  className="us-menu-item"
                >
                  <span className="text-[22px] leading-none" aria-hidden="true">
                    {p.emoji}
                  </span>
                  <span>{tr(p.label)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The scores: today, this week, and last week's champion. */}
      <div className="space-y-1.5 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-linen-secondary">{tr('Boops today')}</span>
          <span className="tabular-nums text-linen-primary">
            {leader === activeUser && '👑 '}
            {tr('You')} <b>{score[activeUser]}</b>
            <span className="mx-1.5 text-linen-secondary">·</span>
            {leader === theirSeat && '👑 '}
            {partnerName} <b>{score[theirSeat]}</b>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-linen-secondary">{tr('This week')}</span>
          <span className="tabular-nums text-linen-primary">
            {tr('You')} <b>{weekly[activeUser]}</b>
            <span className="mx-1.5 text-linen-secondary">·</span>
            {partnerName} <b>{weekly[theirSeat]}</b>
          </span>
        </div>
        {trophy && score.lastWeek && (
          <p className="text-linen-primary">
            🏆 {tr("Last week's champion: {name} ({a} to {b})", {
              name: nameOf(trophy),
              a: Math.max(score.lastWeek.user, score.lastWeek.partner),
              b: Math.min(score.lastWeek.user, score.lastWeek.partner)
            })}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-[11px] text-linen-secondary">{tr('Tap {name} to boop · hold for more', { name: partnerName })}</span>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="shrink-0 rounded-full border border-linen-border px-3 py-1 text-[12px] font-semibold text-linen-primary transition-colors hover:bg-linen-variant active:scale-95"
          >
            {tr('More')} 🤭
          </button>
        </div>
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
