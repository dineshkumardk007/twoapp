import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Heart, Mic, RotateCcw, X } from 'lucide-react';
import { Bear, Bunny } from './StickerArt';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { useT } from '../core/i18n';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';
import { getAudioContext } from '../core/audioAlerts';
import { loadSounds, playSound, type Playing, type PlayOptions, type SoundName } from '../core/sounds';
import { markWaitingForMic } from '../core/voice';
import type { SurpriseMedia, SurprisePlan } from '../core/surprise';

interface SurpriseRevealProps {
  plan: SurprisePlan;
  media: Record<string, SurpriseMedia>;
  /** Who planned it. */
  fromName: string;
  /** Shown to the one who planned it, to see it as it will be: nothing is marked opened. */
  preview?: boolean;
  /** The letter has been reached: it counts as opened. */
  onOpened?: () => void;
  onClose: () => void;
}

/**
 * The scenes, in order. A gift under the night sky; opened, its light
 * becomes a heart of stars and the title is written beneath it; the photos
 * as a short film; the cake, its candles lit one by one, blown out; a hush
 * and fireworks; a letter under a wax seal; and the two of them under the
 * moon at the end.
 */
type Stage = 'gift' | 'open' | 'memories' | 'cake' | 'blown' | 'envelope' | 'seal' | 'letter' | 'finale';
const ORDER: Stage[] = ['gift', 'open', 'memories', 'cake', 'blown', 'envelope', 'seal', 'letter', 'finale'];
const reached = (stage: Stage, scene: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(scene);

/**
 * The film's timing, in ms from the start of each scene. Its sounds
 * (sound-design/recipes, sr-*) are cut to the same moments, and so are the
 * delays in index.css (sr-*).
 */
const OPEN = { sparks: 1000, heart: 2700, title: 3300, next: 6400 };
const PHOTO_MS = 3800;
const CAKE = { candles: 1700, candleGap: 450, song: 4000, wish: 4300 };
const BLOWN = { bursts: [[1100, 1700], [2100, 2600], [2600, 3200]] as const, kiss: 3700, envelope: 6400 };
const SEAL_MS = 1850;

const INK = '#4a2c2a';
const GOLD = '#e2b55a';
/** The candles, across the top tier, in the cake's own units (340 × 300). */
const CANDLES = [124, 147, 170, 193, 216];
const CANDLE_TOP = 70;
/** Blowing this hard (the microphone's level)... */
const BLOW_LEVEL = 0.12;
/** ...heard this often... */
const LISTEN_EVERY_MS = 40;
/** ...for this long puts out the next candle. */
const BLOW_PER_CANDLE_MS = 170;

/** A heart of stars: points on the classic heart curve, in % of a square. */
const HEART = Array.from({ length: 26 }, (_, i) => {
  const t = (i / 26) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: 50 + x * 2.75, y: 44 + y * 2.75, big: i % 4 === 0 };
});
/** The lines joining them, as a constellation is drawn. */
const HEART_LINES = HEART.map((p, i) => {
  const q = HEART[(i + 1) % HEART.length];
  return { x: p.x, y: p.y, len: Math.hypot(q.x - p.x, q.y - p.y), angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
});

/** A seeded random, so the sky is the same each time it is drawn. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A tile of stars, as an image: one layer of the sky, drawn once. */
function starTile(seed: number, count: number, w: number, h: number, r: [number, number], a: [number, number]): string {
  const rand = seeded(seed);
  const tints = ['#ffffff', '#fff1d6', '#e4e9ff'];
  let dots = '';
  for (let i = 0; i < count; i++) {
    const rr = r[0] + rand() * (r[1] - r[0]);
    dots += `<circle cx="${(rand() * w).toFixed(1)}" cy="${(rand() * h).toFixed(1)}" r="${rr.toFixed(2)}" fill="${tints[i % 3]}" fill-opacity="${(a[0] + rand() * (a[1] - a[0])).toFixed(2)}"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${dots}</svg>`)}")`;
}
const FAR_STARS = starTile(7, 170, 420, 900, [0.35, 0.9], [0.25, 0.7]);
const NEAR_STARS = starTile(31, 46, 420, 900, [0.8, 1.6], [0.45, 0.95]);
/** Film grain: fine noise over everything, a few percent. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.6 -0.55"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>'
)}")`;

const TWINKLES = Array.from({ length: 16 }, (_, i) => ({ left: (i * 61 + 7) % 100, top: (i * 37 + 3) % 58, delay: (i % 7) * 0.55, size: i % 3 ? 2 : 3 }));
const BOKEH = Array.from({ length: 9 }, (_, i) => ({
  left: (i * 41 + 5) % 100,
  top: 40 + ((i * 29) % 55),
  size: 46 + ((i * 23) % 80),
  delay: -i * 1.3,
  dur: 8 + (i % 4) * 2,
  warm: i % 3 !== 1
}));

/** Text in letters - or, for scripts whose letters join (Tamil), in words - each with its own moment. */
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u;
function letters(s: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(s), x => x.segment) : Array.from(s);
}
const Written: React.FC<{ text: string; start: number; step: number; cls: string }> = ({ text, start, step, cls }) => {
  const byLetter = LATIN.test(text);
  let n = 0;
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (!part) return null;
        if (/^\s+$/.test(part)) return part;
        if (!byLetter) {
          const at = start + n * step;
          n += Math.max(1, Math.round(part.length / 3));
          return (
            <span key={i} className={cls} style={{ animationDelay: `${at}ms` }}>
              {part}
            </span>
          );
        }
        return (
          // A word kept whole across lines; its letters arrive one by one.
          <span key={i} className="sr-word">
            {letters(part).map((c, k) => (
              <span key={k} className={cls} style={{ animationDelay: `${start + n++ * step}ms` }}>
                {c}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
};

/** Icing running down a tier's front: a band with drips of different lengths. */
function drips(x0: number, x1: number, top: number, depth: number, seed: number): string {
  let d = `M${x0},${top + depth} V${top + 6} Q${x0},${top} ${x0 + 12},${top} H${x1 - 12} Q${x1},${top} ${x1},${top + 6} V${top + depth}`;
  let x = x1;
  let i = seed;
  while (x > x0 + 1) {
    const w = Math.min(24, x - x0);
    const long = depth + 5 + ((i * 37) % 4) * 5;
    d += ` Q${x - w * 0.15},${top + long} ${x - w / 2},${top + long} Q${x - w * 0.85},${top + long} ${x - w},${top + depth}`;
    x -= w;
    i++;
  }
  return d + ' Z';
}

const Rose: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-6,4 C-16,6 -24,0 -22,-6 C-14,-8 -8,-4 -6,4 Z" fill="#8cbf86" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M6,4 C16,6 24,0 22,-6 C14,-8 8,-4 6,4 Z" fill="#8cbf86" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    <circle r={11} fill="#e64a73" stroke={INK} strokeWidth={2} />
    <path d="M-6.5,-1 C-6.5,-8 6.5,-8 6.5,0 C6.5,5.5 -2,6 -2.5,0.5 C-2.8,-3 2.4,-3.4 2.4,0" fill="none" stroke="#a81c46" strokeWidth={1.8} strokeLinecap="round" />
    <ellipse cx={-4} cy={-6} rx={3} ry={1.6} fill="#fff" opacity={0.35} transform="rotate(-25 -4 -6)" />
  </g>
);

/** The cake: two tiers on a gold stand, roses and pearls. Drawn once; its flames are layers of their own. */
const Cake: React.FC<{ age?: number }> = ({ age }) => (
  <svg viewBox="0 0 340 300" className="sr-cake-art" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sr-gold" x1="0" x2="1">
        <stop offset="0" stopColor="#b8862f" />
        <stop offset="0.42" stopColor="#f3d692" />
        <stop offset="0.5" stopColor="#fff2c6" />
        <stop offset="0.6" stopColor="#e2b55a" />
        <stop offset="1" stopColor="#a5732a" />
      </linearGradient>
      <linearGradient id="sr-pink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd0dc" />
        <stop offset="0.6" stopColor="#f6a6bd" />
        <stop offset="1" stopColor="#ea8aa8" />
      </linearGradient>
      <linearGradient id="sr-ivory" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffbf3" />
        <stop offset="0.7" stopColor="#f8e9d2" />
        <stop offset="1" stopColor="#eed7b6" />
      </linearGradient>
      <linearGradient id="sr-round" x1="0" x2="1">
        <stop offset="0" stopColor="#3b1d2e" stopOpacity="0.2" />
        <stop offset="0.22" stopColor="#3b1d2e" stopOpacity="0" />
        <stop offset="0.7" stopColor="#3b1d2e" stopOpacity="0" />
        <stop offset="1" stopColor="#3b1d2e" stopOpacity="0.24" />
      </linearGradient>
    </defs>
    <path d="M150,272 L134,294 H206 L190,272 Z" fill="url(#sr-gold)" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    <ellipse cx={170} cy={268} rx={152} ry={13} fill="url(#sr-gold)" stroke={INK} strokeWidth={2.6} />
    <rect x={46} y={182} width={248} height={84} rx={14} fill="url(#sr-pink)" stroke={INK} strokeWidth={2.8} />
    <rect x={47.5} y={183.5} width={245} height={81} rx={13} fill="url(#sr-round)" />
    <rect x={47.5} y={234} width={245} height={7} fill="url(#sr-gold)" />
    {Array.from({ length: 20 }, (_, i) => (
      <circle key={i} cx={57 + i * 12} cy={261} r={4.4} fill="#fff8ee" stroke={INK} strokeWidth={1.3} />
    ))}
    <path d={drips(46, 294, 182, 15, 1)} fill="#fffaf2" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    <rect x={96} y={118} width={148} height={70} rx={12} fill="url(#sr-ivory)" stroke={INK} strokeWidth={2.8} />
    <rect x={97.5} y={119.5} width={145} height={67} rx={11} fill="url(#sr-round)" />
    <path d={drips(96, 244, 118, 12, 3)} fill="#f2a2b6" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    {[112, 132, 208, 228].map(x => (
      <circle key={x} cx={x} cy={172} r={2.6} fill={GOLD} />
    ))}
    {age ? (
      <text
        x={170}
        y={176}
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontStyle="italic"
        fontWeight={700}
        fontSize={36}
        fill="url(#sr-gold)"
        stroke={INK}
        strokeWidth={1.2}
      >
        {age}
      </text>
    ) : null}
    <Rose x={74} y={186} />
    <Rose x={98} y={190} s={0.75} />
    <Rose x={268} y={186} />
    <Rose x={244} y={121} s={0.7} />
    {CANDLES.map(x => (
      <g key={x}>
        <rect x={x - 5} y={CANDLE_TOP} width={10} height={52} rx={3} fill="#fffaf0" stroke={INK} strokeWidth={2} />
        {[0, 1, 2, 3].map(k => (
          <path key={k} d={`M${x - 5},${CANDLE_TOP + 13 + k * 12} L${x + 5},${CANDLE_TOP + 6 + k * 12}`} stroke={GOLD} strokeWidth={3} />
        ))}
        <path d={`M${x},${CANDLE_TOP} V${CANDLE_TOP - 6}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      </g>
    ))}
  </svg>
);

/** Her tiara, between her ears. */
const Tiara: React.FC = () => (
  <g transform="translate(0 -25)">
    <path d="M-15,2 L-13,-10 L-6,-3 L0,-14 L6,-3 L13,-10 L15,2 Z" fill={GOLD} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={0} cy={-5} r={2.6} fill="#ff6f98" stroke={INK} strokeWidth={1.2} />
    <circle cx={-13} cy={-11} r={1.8} fill="#fff6dc" />
    <circle cx={13} cy={-11} r={1.8} fill="#fff6dc" />
    <circle cx={0} cy={-15} r={1.8} fill="#fff6dc" />
  </g>
);
/** His bow tie, under his chin. */
const BowTie: React.FC = () => (
  <g transform="translate(0 31)">
    <path d="M0,0 L-13,-7 L-13,7 Z M0,0 L13,-7 L13,7 Z" fill="#d2264e" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <circle r={3.4} fill="#d2264e" stroke={INK} strokeWidth={2} />
  </g>
);

type Mood = React.ComponentProps<typeof Bear>['mood'];
const Buddy: React.FC<{ who: 'bear' | 'bunny'; mood: Mood }> = ({ who, mood }) => (
  <svg viewBox="0 0 140 160" aria-hidden="true" focusable="false">
    {who === 'bear' ? (
      <Bear x={70} y={64} mood={mood} arms="hold">
        <BowTie />
      </Bear>
    ) : (
      <Bunny x={70} y={70} s={0.95} mood={mood} arms="hold">
        <Tiara />
      </Bunny>
    )}
  </svg>
);

/** The two of them on the hill at the end: her head on his shoulder, holding paws. */
const Couple: React.FC = () => (
  <svg viewBox="0 0 260 170" aria-hidden="true" focusable="false">
    <Bear x={96} y={72} mood="content" arms="none">
      <BowTie />
    </Bear>
    <Bunny x={160} y={80} s={0.92} rot={-13} mood="content" arms="none">
      <Tiara />
    </Bunny>
    <ellipse cx={122} cy={118} rx={8} ry={7} fill="#c4895a" stroke="#3b2723" strokeWidth={2.6} />
    <ellipse cx={135} cy={119} rx={7.5} ry={7} fill="#fffaf3" stroke="#3b2723" strokeWidth={2.6} />
  </svg>
);

/** A rose petal, falling. */
const Petal: React.FC<{ c: string }> = ({ c }) => (
  <svg viewBox="-10 -12 20 24" aria-hidden="true" focusable="false">
    <path d="M0,-11 C8,-6 9,4 0,11 C-9,4 -8,-6 0,-11 Z" fill={c} />
    <path d="M0,-8 C2,-2 2,4 0,9" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.2} fill="none" />
  </svg>
);
const HeartBit: React.FC<{ c: string }> = ({ c }) => (
  <svg viewBox="-13 -14 26 24" aria-hidden="true" focusable="false">
    <path d="M0,8 C-3,5 -12,0 -12,-6 C-12,-11 -8,-13 -5,-13 C-2.5,-13 -1,-11.5 0,-9.5 C1,-11.5 2.5,-13 5,-13 C8,-13 12,-11 12,-6 C12,0 3,5 0,8 Z" fill={c} />
  </svg>
);
const PETAL_COLORS = ['#e8476f', '#f47c99', '#c92a55', '#ffb3c6'];
const HEART_COLORS = ['#f3d692', '#ff8fab', '#ffd6e0'];

/** Rose petals and little hearts, drifting down through the scene. */
const Petals: React.FC = () => {
  const bits = useMemo(() => {
    const rand = seeded(97);
    return Array.from({ length: 24 }, (_, i) => ({
      left: rand() * 100,
      size: 12 + rand() * 12,
      fall: 6.5 + rand() * 4,
      delay: 1.6 + rand() * 3.5,
      sway: 1.6 + rand() * 1.2,
      swayBy: 3 + rand() * 6,
      spin: 2.2 + rand() * 2.4,
      heart: i % 4 === 0,
      c: i % 4 === 0 ? HEART_COLORS[i % 3] : PETAL_COLORS[i % 4]
    }));
  }, []);
  return (
    <div className="sr-petals" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} className="sr-petal" style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDuration: `${b.fall}s`, animationDelay: `${b.delay}s` }}>
          <span className="sr-petal-sway" style={{ animationDuration: `${b.sway}s`, '--by': `${b.swayBy}vw` } as React.CSSProperties}>
            <span className="sr-petal-spin" style={{ animationDuration: `${b.spin}s` }}>
              {b.heart ? <HeartBit c={b.c} /> : <Petal c={b.c} />}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
};

/** Keeps a scene on screen a moment after it ends, so it can fade rather than vanish. */
function useLinger(on: boolean, ms: number): boolean {
  const [shown, setShown] = useState(on);
  useEffect(() => {
    if (on) {
      setShown(true);
      return;
    }
    const t = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on || shown;
}

/**
 * The photos as a short film: each slowly drifting and closing in, one
 * dissolving into the next, between black bars. A tap moves on.
 */
const Reel: React.FC<{ photos: SurpriseMedia[]; onDone: () => void }> = ({ photos, onDone }) => {
  const tr = useT();
  const [at, setAt] = useState(0);
  const [looks, setLooks] = useState<Record<string, { soft: string; wide: boolean }>>({});
  const done = useRef(onDone);
  done.current = onDone;

  // A wide photo is shown whole, over a soft copy of itself: a tiny image
  // drawn large is a blur that costs nothing to move.
  useEffect(() => {
    let alive = true;
    photos.forEach(p => {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const wide = img.naturalWidth > img.naturalHeight * 1.08;
        let soft = '';
        try {
          const c = document.createElement('canvas');
          c.width = 24;
          c.height = Math.max(1, Math.round((24 * img.naturalHeight) / Math.max(1, img.naturalWidth)));
          c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
          soft = c.toDataURL('image/jpeg', 0.8);
        } catch {
          /* drawn without it */
        }
        setLooks(l => ({ ...l, [p.id]: { soft, wide } }));
      };
      img.src = p.dataUrl;
    });
    return () => {
      alive = false;
    };
  }, [photos]);

  const next = () => (at + 1 < photos.length ? setAt(at + 1) : done.current());
  useEffect(() => {
    const t = setTimeout(next, PHOTO_MS);
    return () => clearTimeout(t);
    // Each photo its own time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  return (
    <button type="button" className="sr-reel" onClick={next} aria-label={tr('Next')}>
      {photos.map((p, i) =>
        i === at || i === at - 1 ? (
          <span key={p.id} className="sr-slide" data-leaving={i < at || undefined} data-wide={looks[p.id]?.wide || undefined} data-kb={i % 2 ? 'b' : 'a'}>
            {looks[p.id]?.soft ? <img className="sr-slide-soft" src={looks[p.id].soft} alt="" /> : null}
            <img className="sr-slide-img" src={p.dataUrl} alt="" />
          </span>
        ) : null
      )}
      <span className="sr-bars" aria-hidden="true" />
    </button>
  );
};

/** One showing of the film. "Watch again" starts a new one. */
const Film: React.FC<SurpriseRevealProps & { onAgain: () => void }> = ({ plan, media, fromName, preview, onOpened, onClose, onAgain }) => {
  const tr = useT();
  const [stage, setStage] = useState<Stage>('gift');
  const [lit, setLit] = useState(0);
  const [out, setOut] = useState<boolean[]>(() => CANDLES.map(() => false));
  const [wishing, setWishing] = useState(false);
  const [kiss, setKiss] = useState<'no' | 'kiss' | 'close'>('no');
  const [listening, setListening] = useState(false);
  const [blowing, setBlowing] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const [instant, setInstant] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const giftRef = useRef<HTMLSpanElement>(null);
  const starRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fxRef = useRef<HTMLDivElement>(null);
  const song = useRef<Playing | null>(null);
  const music = useRef<Playing | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const outRef = useRef(out);
  outRef.current = out;
  const litRef = useRef(lit);
  litRef.current = lit;
  const calm = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useBackLayer(true, () => (viewing ? setViewing(null) : onClose()));

  const photos = plan.photoIds.map(id => media[id]).filter((m): m is SurpriseMedia => !!m && m.kind === 'photo');
  const voice = plan.voiceId ? media[plan.voiceId] : undefined;
  const title = plan.title || tr('Happy Birthday!');

  // Every timer and sound of this showing, ended with it.
  const timers = useRef<number[]>([]);
  const sounds = useRef<Playing[]>([]);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const cue = (name: SoundName, delayMs = 0, options: PlayOptions = {}): Playing => {
    const p = playSound(name, { ...options, delay: delayMs ? delayMs / 1000 : undefined });
    sounds.current.push(p);
    return p;
  };
  const heartbeat = () => {
    haptic('tick');
    after(140, () => haptic('tick'));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      sounds.current.forEach(p => p.stop());
      stopMic.current?.();
    },
    []
  );

  // Its sounds, ready long before each plays.
  useEffect(() => loadSounds(['sr-open', 'sr-memories', 'sr-candles', 'sr-puff', 'birthday-song', 'sr-fireworks', 'us-kiss', 'sr-envelope', 'sr-seal', 'sr-finale']), []);
  useEffect(() => {
    // The gift, arriving: a heartbeat in the hand.
    const t = setTimeout(heartbeat, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = () => {
    if (stage !== 'gift') return;
    haptic('confirm');
    // The tap is what lets the phone play sound, so everything after it can be on cue.
    getAudioContext();
    cue('sr-open');
    setStage('open');
    after(OPEN.heart, heartbeat);
    after(OPEN.next, () => setStage(photos.length ? 'memories' : 'cake'));
  };

  // The light from the gift: each star of the heart flies up out of the box
  // to its place. Measured, so it starts at the box wherever the box is.
  useLayoutEffect(() => {
    if (stage !== 'open' || calm) return;
    const box = giftRef.current?.getBoundingClientRect();
    if (!box) return;
    const sx = box.left + box.width / 2;
    const sy = box.top + box.height * 0.15;
    const flights: Animation[] = [];
    starRefs.current.forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      const r = el.getBoundingClientRect();
      const dx = sx - (r.left + r.width / 2);
      const dy = sy - (r.top + r.height / 2);
      const swirl = (i % 2 ? 1 : -1) * (30 + ((i * 37) % 80));
      flights.push(
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
            { transform: `translate(${dx * 0.45 + swirl}px, ${dy * 0.6}px) scale(1.5)`, opacity: 1, offset: 0.42 },
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 }
          ],
          { duration: 1300 + ((i * 53) % 320), delay: OPEN.sparks + i * 24, easing: 'cubic-bezier(0.33, 0.1, 0.2, 1)', fill: 'both' }
        )
      );
    });
    return () => flights.forEach(f => f.cancel());
  }, [stage, calm]);

  // The photos: a waltz under them, closing as they end.
  useEffect(() => {
    if (stage !== 'memories') return;
    music.current = cue('sr-memories');
    return () => music.current?.stop(0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // The cake: brought in, its candles lit one by one, then the song and a wish.
  useEffect(() => {
    if (stage !== 'cake') return;
    cue('sr-candles', CAKE.candles);
    CANDLES.forEach((_, i) => after(CAKE.candles + i * CAKE.candleGap, () => setLit(i + 1)));
    after(CAKE.song, () => {
      if (plan.song) song.current = cue('birthday-song');
    });
    after(CAKE.wish, () => setWishing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const putOut = (i: number) => {
    if (outRef.current[i] || i >= litRef.current || !wishing) return;
    const next = outRef.current.map((o, k) => o || k === i);
    outRef.current = next;
    setOut(next);
    haptic('tick');
    cue('sr-puff', 0, { rate: 0.92 + ((i * 7) % 5) * 0.05 });
    if (next.every(Boolean)) {
      stopMic.current?.();
      song.current?.stop(0.25);
      after(380, () => setStage('blown'));
    }
  };
  const putOutNext = () => {
    const i = outRef.current.findIndex(o => !o);
    if (i >= 0) putOut(i);
  };

  // Candles out: a hush, then fireworks, and he kisses her cheek.
  useEffect(() => {
    if (stage !== 'blown') return;
    cue('sr-fireworks');
    after(BLOWN.bursts[0][1], heartbeat);
    after(BLOWN.kiss, () => {
      setKiss('kiss');
      cue('us-kiss');
    });
    after(BLOWN.kiss + 1300, () => setKiss('close'));
    after(BLOWN.envelope, () => {
      setStage('envelope');
      cue('sr-envelope');
    });

    const layer = fxRef.current;
    if (!layer || calm || typeof layer.animate !== 'function') return;
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    const spots = [[0.25, 0.2], [0.76, 0.15], [0.5, 0.43]];
    const colors = [['#ffe6a6', '#ffd27a', '#fff6dc'], ['#ff9ab8', '#ffc2d4', '#ff6f98'], ['#fff6dc', '#ffd27a', '#ffb3c8']];
    const made: HTMLElement[] = [];
    const moves: Animation[] = [];
    const add = (cls: string, x: number, y: number, color?: string) => {
      const el = document.createElement('span');
      el.className = cls;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      if (color) el.style.setProperty('--c', color);
      layer.appendChild(el);
      made.push(el);
      return el;
    };
    BLOWN.bursts.forEach(([launch, burst], k) => {
      const x = spots[k][0] * w;
      const y = spots[k][1] * h;
      const rocket = add('sr-rocket', x, h);
      moves.push(
        rocket.animate(
          [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.12 }, { transform: `translateY(${y - h}px)`, opacity: 0.8 }],
          { duration: burst - launch, delay: launch, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'both' }
        )
      );
      const flash = add('sr-flash', x, y, colors[k][0]);
      moves.push(
        flash.animate(
          [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.15 }, { transform: 'scale(1.7)', opacity: 0 }],
          { duration: 1000, delay: burst, easing: 'ease-out', fill: 'both' }
        )
      );
      const n = 32;
      const reach = Math.min(w, h) * (0.21 + k * 0.025);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + k * 0.4;
        const r = reach * (0.72 + ((i * 37) % 28) / 100);
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        const deg = (a * 180) / Math.PI;
        const spark = add('sr-spark', x, y, colors[k][i % 3]);
        moves.push(
          spark.animate(
            [
              { transform: `translate(0px, 0px) rotate(${deg}deg) scaleX(0.3)`, opacity: 1 },
              { transform: `translate(${dx * 0.86}px, ${dy * 0.86}px) rotate(${deg}deg) scaleX(1)`, opacity: 1, offset: 0.42 },
              { transform: `translate(${dx}px, ${dy + reach * 0.4}px) rotate(${deg + 24}deg) scaleX(0.15)`, opacity: 0 }
            ],
            { duration: 1800, delay: burst, easing: 'cubic-bezier(0.12, 0.75, 0.3, 1)', fill: 'both' }
          )
        );
      }
    });
    return () => {
      moves.forEach(m => m.cancel());
      made.forEach(el => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const openLetter = () => {
    if (stage !== 'envelope') return;
    haptic('confirm');
    cue('sr-seal');
    setStage('seal');
    after(SEAL_MS, () => setStage('letter'));
  };
  useEffect(() => {
    if (stage === 'letter' && !preview) onOpened?.();
    // Once, on reaching the letter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  const toFinale = () => {
    haptic('confirm');
    setStage('finale');
    cue('sr-finale');
  };
  const again = () => {
    haptic('tick');
    onAgain();
  };

  /**
   * Blowing into the phone: its microphone's level, LISTEN_EVERY_MS. A breath
   * on the microphone is far louder than speech or a song from the speaker,
   * so a steady level over BLOW_LEVEL puts the candles out one after another.
   */
  const listen = async () => {
    if (listening) return;
    song.current?.stop(0.25);
    markWaitingForMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = getAudioContext();
      if (!ctx) throw new Error('no audio');
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      let held = 0;
      let last = performance.now();
      let wasBlowing = false;
      const tick = () => {
        const t = performance.now();
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const level = Math.sqrt(sum / data.length);
        const dt = Math.min(100, t - last);
        last = t;
        const now = level > BLOW_LEVEL;
        if (now !== wasBlowing) {
          wasBlowing = now;
          setBlowing(now);
        }
        held = now ? held + dt : Math.max(0, held - dt / 2);
        if (held > BLOW_PER_CANDLE_MS) {
          held = 0;
          putOutNext();
        }
      };
      const timer = setInterval(tick, LISTEN_EVERY_MS);
      stopMic.current = () => {
        clearInterval(timer);
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        stopMic.current = null;
        setListening(false);
        setBlowing(false);
      };
      setListening(true);
    } catch {
      setMicFailed(true);
    } finally {
      markWaitingForMic(false);
    }
  };

  const showReel = useLinger(stage === 'memories', 1100);
  const showTable = useLinger(stage === 'cake' || stage === 'blown', 1000);
  const showPetals = useLinger(stage === 'blown' || stage === 'envelope' || stage === 'seal', 1600);
  const outCount = out.filter(Boolean).length;
  const glow = stage === 'cake' || stage === 'blown' ? (lit / CANDLES.length) * (1 - outCount / CANDLES.length) : 0;
  // The letter appearing as if being written, a few words at a time: over
  // at most about nine seconds, and never more than 120 pieces in motion.
  const phrases = useMemo(() => {
    const parts = (plan.letter || '').split(/(\s+)/);
    const words = parts.filter(p => p && !/^\s+$/.test(p)).length;
    const per = Math.max(1, Math.ceil(words / 120));
    const out: string[] = [];
    let current = '';
    let n = 0;
    parts.forEach(p => {
      current += p;
      if (p && !/^\s+$/.test(p) && ++n % per === 0) {
        out.push(current);
        current = '';
      }
    });
    if (current) out.push(current);
    return { list: out, ms: out.length ? Math.max(40, Math.min(75 * per, 9000 / out.length)) : 0 };
  }, [plan.letter]);
  const textMs = 500 + phrases.list.length * phrases.ms;
  const photosMs = textMs + photos.length * 160;
  const signMs = photosMs + (voice ? 500 : 0) + 200;
  const showLetter = useLinger(stage === 'letter', 700);

  return (
    <div className="sr-root" data-stage={stage} role="dialog" aria-modal="true" aria-label={plan.title || tr('A surprise')}>
      {/* The night: two layers of stars drifting at their own speeds, a few twinkling, the moon, and soft lights out of focus. */}
      <div className="sr-sky" aria-hidden="true">
        <span className="sr-stars sr-stars-far" style={{ backgroundImage: FAR_STARS }} />
        <span className="sr-stars sr-stars-near" style={{ backgroundImage: NEAR_STARS }} />
        {TWINKLES.map((s, i) => (
          <span key={i} className="sr-twinkle" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        <span className="sr-moon" />
        {BOKEH.map((b, i) => (
          <span
            key={i}
            className="sr-bokeh"
            data-warm={b.warm || undefined}
            style={{ left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
          />
        ))}
      </div>
      <div className="sr-dim" aria-hidden="true" />
      <div className="sr-fx" ref={fxRef} aria-hidden="true" />

      {/* The heart of stars, and the title written beneath it. */}
      <div className="sr-heaven" aria-hidden={stage === 'gift' || undefined}>
        <div className="sr-heart">
          <span className="sr-heart-glow" />
          {HEART_LINES.map((l, i) => (
            <span
              key={i}
              className="sr-hline"
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.len}%`, '--a': `${l.angle}deg`, animationDelay: `${OPEN.heart + i * 22}ms` } as React.CSSProperties}
            />
          ))}
          {HEART.map((p, i) => (
            <span key={i} ref={el => (starRefs.current[i] = el)} className="sr-hstar" data-big={p.big || undefined} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <i style={{ animationDelay: `${(i % 9) * 0.37}s` }} />
            </span>
          ))}
        </div>
        {reached(stage, 'open') && (
          <h1 className="sr-title">
            <span className="sr-title-glow" aria-hidden="true" />
            <Written text={title} start={OPEN.title} step={Math.min(70, 1500 / Math.max(1, title.length))} cls="sr-ch" />
          </h1>
        )}
        {stage === 'finale' && (
          <p className="sr-finale-sign">
            — {fromName} <Heart className="inline h-4 w-4" fill="currentColor" aria-hidden="true" />
          </p>
        )}
      </div>

      {(stage === 'gift' || stage === 'open') && (
        <div className="sr-gift-stage">
          <p className="sr-kicker">{tr('{name} left something for you', { name: fromName })}</p>
          <button type="button" className="sr-gift" onClick={open} aria-label={tr('Open it')}>
            <span className="sr-gift-glow" aria-hidden="true" />
            <span className="sr-gift-beam" aria-hidden="true" />
            <span className="sr-gift-box" ref={giftRef} aria-hidden="true">
              <span className="sr-gift-sheen" />
              <span className="sr-ribbon sr-ribbon-v" />
              <span className="sr-ribbon sr-ribbon-h" />
            </span>
            <span className="sr-gift-lid" aria-hidden="true">
              <span className="sr-ribbon sr-ribbon-v" />
            </span>
            <span className="sr-bow" aria-hidden="true">
              <svg viewBox="0 0 120 70">
                <defs>
                  <linearGradient id="sr-bow-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff2c6" />
                    <stop offset="0.45" stopColor="#ecc778" />
                    <stop offset="1" stopColor="#b8862f" />
                  </linearGradient>
                </defs>
                <path d="M54,44 L36,68 L44,68 L50,62 L52,70 Z" fill="#c9973f" />
                <path d="M66,44 L84,68 L76,68 L70,62 L68,70 Z" fill="#c9973f" />
                <path d="M60,40 C44,8 10,8 14,30 C17,46 44,46 60,40 Z" fill="url(#sr-bow-gold)" />
                <path d="M60,40 C76,8 110,8 106,30 C103,46 76,46 60,40 Z" fill="url(#sr-bow-gold)" />
                <path d="M58,38 C46,22 26,18 24,28" stroke="#a5732a" strokeWidth={2.4} fill="none" opacity={0.5} strokeLinecap="round" />
                <path d="M62,38 C74,22 94,18 96,28" stroke="#a5732a" strokeWidth={2.4} fill="none" opacity={0.5} strokeLinecap="round" />
                <ellipse cx={60} cy={40} rx={9} ry={8} fill="#e2b55a" />
                <ellipse cx={58} cy={37} rx={4} ry={2.4} fill="#fff6dc" opacity={0.7} />
              </svg>
            </span>
          </button>
          <p className="sr-hint">{tr('Tap to open')}</p>
        </div>
      )}

      {showReel && (
        <div className="sr-memories" data-leaving={stage !== 'memories' || undefined}>
          <Reel photos={photos} onDone={() => setStage('cake')} />
        </div>
      )}

      {showTable && (
        <div className="sr-cake-stage" data-leaving={!(stage === 'cake' || stage === 'blown') || undefined}>
          <div className="sr-table">
            <span className="sr-spot" aria-hidden="true" />
            <div className="sr-buddy sr-buddy-bear" data-kiss={kiss !== 'no' || undefined}>
              <div className="sr-lean">
                <div className="sr-sway">
                  <Buddy who="bear" mood={kiss === 'kiss' ? 'kiss' : kiss === 'close' ? 'content' : 'happy'} />
                </div>
              </div>
            </div>
            <div className="sr-buddy sr-buddy-bunny" data-kiss={kiss !== 'no' || undefined}>
              <div className="sr-lean">
                <div className="sr-sway">
                  <Buddy who="bunny" mood={kiss === 'kiss' ? 'love' : kiss === 'close' ? 'content' : lit === CANDLES.length ? 'love' : 'smile'} />
                </div>
              </div>
            </div>
            {kiss === 'kiss' && (
              <span className="sr-kiss-heart" aria-hidden="true">
                <HeartBit c="#ff4d7d" />
              </span>
            )}
            <div className="sr-cake">
              <Cake age={plan.age} />
              {CANDLES.map((x, i) => (
                <button
                  key={x}
                  type="button"
                  className="sr-candle"
                  data-lit={lit > i || undefined}
                  data-out={out[i] || undefined}
                  style={{ left: `${(x / 340) * 100}%`, top: `${((CANDLE_TOP - 30) / 300) * 100}%` }}
                  onClick={() => putOut(i)}
                  disabled={out[i] || !wishing || stage !== 'cake'}
                  aria-label={tr('Blow out a candle')}
                >
                  <span className="sr-flame-glow" aria-hidden="true" />
                  <span className="sr-strike" aria-hidden="true" />
                  <span className="sr-flame-wrap" aria-hidden="true">
                    <span className="sr-flame" style={{ animationDelay: `${-i * 0.13}s` }} />
                  </span>
                  <span className="sr-smoke" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </button>
              ))}
            </div>
            <span className="sr-candlelight" style={{ opacity: glow }} aria-hidden="true" />
          </div>
          <div className="sr-wish" data-on={(wishing && stage === 'cake') || undefined}>
            <p className="sr-wish-line">{tr('Make a wish… then blow out the candles')}</p>
            {!micFailed ? (
              <button type="button" className="sr-blow" data-on={listening || undefined} data-blowing={blowing || undefined} onClick={listen} disabled={!wishing || stage !== 'cake'}>
                <Mic className="h-4 w-4" aria-hidden="true" />
                {listening ? tr('Blow on the phone!') : tr('Blow')}
              </button>
            ) : null}
            <p className="sr-or">{micFailed ? tr('Tap the candles to blow them out') : tr('or tap the candles')}</p>
          </div>
        </div>
      )}

      {showPetals && (
        <div className="sr-petal-layer" data-leaving={!(stage === 'blown' || stage === 'envelope' || stage === 'seal') || undefined}>
          <Petals />
        </div>
      )}

      {(stage === 'envelope' || stage === 'seal') && (
        <div className="sr-env-stage">
          <button type="button" className="sr-env" onClick={openLetter} disabled={stage !== 'envelope'} aria-label={tr('A letter for you')}>
            <span className="sr-env-back" aria-hidden="true" />
            <span className="sr-env-sheet" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <svg className="sr-env-front" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,0 L150,112 L300,0 V200 H0 Z" fill="#f5e4cc" />
              <path d="M0,200 L150,96 L300,200 Z" fill="#efd8b8" />
              <path d="M0,0 L150,112 L300,0" fill="none" stroke="#d9bd96" strokeWidth={2} />
            </svg>
            <span className="sr-env-flap" aria-hidden="true">
              <svg viewBox="0 0 300 130" preserveAspectRatio="none">
                <path d="M0,0 H300 L150,126 Z" fill="#f8ead6" stroke="#d9bd96" strokeWidth={2} strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sr-seal" aria-hidden="true">
              <span className="sr-seal-half sr-seal-l" />
              <span className="sr-seal-half sr-seal-r" />
              <svg viewBox="-13 -14 26 24" className="sr-seal-heart">
                <path d="M0,8 C-3,5 -12,0 -12,-6 C-12,-11 -8,-13 -5,-13 C-2.5,-13 -1,-11.5 0,-9.5 C1,-11.5 2.5,-13 5,-13 C8,-13 12,-11 12,-6 C12,0 3,5 0,8 Z" fill="#8f1534" />
              </svg>
            </span>
          </button>
          <p className="sr-env-hint">
            <span>{tr('A letter for you')}</span>
            <span className="sr-hint">{tr('Tap to open')}</span>
          </p>
        </div>
      )}

      {showLetter && (
        <div className="sr-letter" data-leaving={stage !== 'letter' || undefined}>
          <article
            className="sr-paper"
            data-instant={instant || undefined}
            style={{ '--text-ms': `${textMs}ms`, '--voice-ms': `${photosMs}ms`, '--sign-ms': `${signMs}ms` } as React.CSSProperties}
            onClick={() => setInstant(true)}
          >
            <span className="sr-paper-grain" style={{ backgroundImage: GRAIN }} aria-hidden="true" />
            <div className="sr-paper-orn" aria-hidden="true">
              <span />
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              <span />
            </div>
            <h2 className="sr-paper-title">{title}</h2>
            {plan.letter && (
              <p className="sr-paper-text">
                {phrases.list.map((phrase, i) => (
                  <span key={i} className="sr-w" style={{ animationDelay: `${500 + i * phrases.ms}ms` }}>
                    {phrase}
                  </span>
                ))}
              </p>
            )}
            {photos.length > 0 && (
              <div className="sr-photos" data-one={photos.length === 1 || undefined}>
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className="sr-polaroid"
                    style={{ '--i': i, '--tilt': `${i % 2 ? 3 : -3}deg` } as React.CSSProperties}
                    onClick={e => {
                      e.stopPropagation();
                      setViewing(p.dataUrl);
                    }}
                  >
                    <img src={p.dataUrl} alt="" />
                  </button>
                ))}
              </div>
            )}
            {voice && voice.kind === 'voice' && (
              <div className="sr-voice" onClick={e => e.stopPropagation()}>
                <p>
                  <Heart className="sr-voice-heart h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                  {tr('A voice message from {name}', { name: fromName })}
                </p>
                <VoiceNotePlayer id={voice.id} audioDataUrl={voice.dataUrl} durationSeconds={voice.durationSeconds} peaks={voice.peaks} tone="theirs" />
              </div>
            )}
            <p className="sr-sign">
              — <Written text={fromName} start={signMs} step={70} cls="sr-sign-ch" /> <Heart className="inline h-4 w-4" fill="currentColor" aria-hidden="true" />
            </p>
            <button
              type="button"
              className="sr-done"
              onClick={e => {
                e.stopPropagation();
                toFinale();
              }}
            >
              <Heart className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              {tr('Done')}
            </button>
          </article>
        </div>
      )}

      {stage === 'finale' && (
        <div className="sr-finale">
          <span className="sr-shooting" aria-hidden="true" />
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className="sr-firefly"
              aria-hidden="true"
              style={{ left: `${8 + ((i * 47) % 84)}%`, bottom: `${10 + ((i * 29) % 22)}%`, animationDelay: `${-i * 0.9}s`, animationDuration: `${5 + (i % 4)}s` }}
            />
          ))}
          <svg className="sr-hill" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="sr-hill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2a1d4d" />
                <stop offset="1" stopColor="#0d0a1f" />
              </linearGradient>
            </defs>
            <path d="M0,92 C80,52 150,34 210,40 C280,48 340,74 400,66 V200 H0 Z" fill="url(#sr-hill)" />
            <path d="M0,92 C80,52 150,34 210,40 C280,48 340,74 400,66" fill="none" stroke="#8f7bd6" strokeOpacity={0.35} strokeWidth={1.5} />
          </svg>
          <div className="sr-couple">
            <Couple />
          </div>
          <div className="sr-finale-actions">
            <button type="button" className="sr-again" onClick={again}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {tr('Watch again')}
            </button>
            <button type="button" className="sr-end" onClick={onClose}>
              {preview ? tr('Close preview') : tr('Close')}
            </button>
          </div>
        </div>
      )}

      <span className="sr-vignette" aria-hidden="true" />
      <span className="sr-grain" style={{ backgroundImage: GRAIN }} aria-hidden="true" />

      {!preview && !reached(stage, 'letter') ? null : (
        <button type="button" className="sr-close" onClick={onClose} aria-label={tr('Close')}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {viewing && (
        <button type="button" className="sr-viewer" onClick={() => setViewing(null)} aria-label={tr('Close')}>
          <img src={viewing} alt="" />
        </button>
      )}
    </div>
  );
};

/**
 * A surprise opening (core/surprise), as a short film: the gift, the heart
 * of stars, the photos, the cake and its candles - into the microphone, or
 * a tap each - fireworks, the letter under its seal, and the two of them at
 * the end. Every moving piece is a layer that only moves or fades.
 */
export const SurpriseReveal: React.FC<SurpriseRevealProps> = props => {
  const [take, setTake] = useState(0);
  const told = useRef(false);
  const opened = () => {
    if (told.current) return;
    told.current = true;
    props.onOpened?.();
  };
  return <Film key={take} {...props} onOpened={opened} onAgain={() => setTake(t => t + 1)} />;
};
