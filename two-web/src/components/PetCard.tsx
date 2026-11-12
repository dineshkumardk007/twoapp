import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import {
  STROKE_COUNTS_EVERY_MS,
  fed,
  levelOf,
  moodOf,
  named,
  petOf,
  played,
  stroked,
  whatChanged,
  willEat,
  type PetHalf,
  type PetMood
} from '../core/pet';
import { loadSounds, playSound } from '../core/sounds';

interface PetCardProps {
  /** What each phone has done for the puppy: this one, and the other. */
  mine?: PetHalf;
  theirs?: PetHalf;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  /** This phone has done something for it: to keep, and to send. */
  onHalf: (half: PetHalf) => void;
}

const INK = '#3b2723';
const FUR = '#f2c078';
const DARK = '#c98a55';

/** What it is doing this moment, over and above its mood. */
type Doing = 'eat' | 'play' | 'stroke' | 'full' | null;
const DOING_MS: Record<Exclude<Doing, null>, number> = { eat: 1500, play: 1500, stroke: 1100, full: 700 };

const line = { fill: 'none', stroke: INK, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const HEART = 'M0,5 C-7,-0.5 -6.4,-6.2 -2.8,-6.2 C-1.2,-6.2 -0.3,-5.3 0,-4.4 C0.3,-5.3 1.2,-6.2 2.8,-6.2 C6.4,-6.2 7,-0.5 0,5 Z';

/** The puppy, as it is: its face follows its mood, and it moves with what it is doing. */
export const PetArt: React.FC<{ mood: PetMood; doing: Doing; level: number }> = ({ mood, doing, level }) => {
  const glad = doing === 'stroke' || doing === 'play';
  const shut = mood === 'asleep' && !doing;
  const sad = (mood === 'hungry' || mood === 'sulking') && !doing;
  const cross = mood === 'sulking' && !doing;
  const eye = (x: number) =>
    shut || glad ? (
      <path key={x} d={shut ? `M${x - 4.5},61 Q${x},65 ${x + 4.5},61` : `M${x - 4.5},62 Q${x},56 ${x + 4.5},62`} {...line} strokeWidth={2.6} />
    ) : (
      <g key={x} className="pt-eye">
        <circle cx={x} cy={61} r={4} fill={INK} />
        <circle cx={x + 1.3} cy={59.6} r={1.3} fill="#fff" />
      </g>
    );
  return (
    <svg viewBox="0 0 200 150" className="pt" data-mood={mood} data-doing={doing ?? undefined} aria-hidden="true">
      <ellipse cx={100} cy={133} rx={54} ry={7} fill="#000" opacity={0.13} />
      <g className="pt-all">
        {/* The tail, wagging from where it joins. */}
        <g transform="translate(131 96)">
          <path d="M0,0 C12,-4 20,-16 16,-28 C22,-18 20,-2 4,6 Z" fill={DARK} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" className="pt-tail" />
        </g>
        <g className="pt-body">
          {/* Back legs, body, front legs. */}
          <rect x={70} y={108} width={15} height={22} rx={7} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <rect x={115} y={108} width={15} height={22} rx={7} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <ellipse cx={100} cy={100} rx={36} ry={25} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <ellipse cx={100} cy={107} rx={18} ry={14} fill="#fff7ea" />
          <rect x={82} y={112} width={15} height={20} rx={7} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <rect x={103} y={112} width={15} height={20} rx={7} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <path d="M85,129 h9 M106,129 h9" stroke={INK} strokeOpacity={0.4} strokeWidth={1.6} strokeLinecap="round" />
        </g>
        <g className="pt-head">
          {/* Ears that flop, behind the head. */}
          <g transform="translate(76 46)">
            <path d="M2,-2 C-12,-4 -22,8 -18,26 C-10,30 0,22 4,10 Z" fill={DARK} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" className="pt-ear" data-side="l" />
          </g>
          <g transform="translate(124 46)">
            <path d="M-2,-2 C12,-4 22,8 18,26 C10,30 0,22 -4,10 Z" fill={DARK} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" className="pt-ear" data-side="r" />
          </g>
          <circle cx={100} cy={62} r={31} fill={FUR} stroke={INK} strokeWidth={2.6} />
          <path d="M100,31 C92,40 92,50 100,56 C108,50 108,40 100,31 Z" fill="#fff7ea" />
          <ellipse cx={100} cy={75} rx={15} ry={11.5} fill="#fff7ea" />
          {cross && <path d="M80,51 L92,55 M120,51 L108,55" {...line} strokeWidth={2.6} />}
          {sad && !cross && <path d="M80,55 L91,52 M120,55 L109,52" {...line} strokeWidth={2.2} />}
          {eye(87)}
          {eye(113)}
          <ellipse cx={100} cy={69.5} rx={5.4} ry={3.8} fill={INK} />
          {doing === 'eat' ? (
            <ellipse cx={100} cy={80} rx={5} ry={4} fill="#7a2333" stroke={INK} strokeWidth={1.8} className="pt-chew" />
          ) : sad ? (
            <path d="M92,82 Q100,76 108,82" {...line} strokeWidth={2.4} />
          ) : shut ? (
            <path d="M95,79 Q100,82 105,79" {...line} strokeWidth={2.2} />
          ) : (
            <>
              <path d="M100,73.5 V77 M91,77.5 Q95.5,83 100,77 Q104.5,83 109,77.5" {...line} strokeWidth={2.4} />
              {(mood === 'happy' || glad) && <path d="M96,80.5 h8 v5 a4,4 0 0 1 -8,0 Z" fill="#f47a9b" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" className="pt-tongue" />}
            </>
          )}
          <ellipse cx={77} cy={73} rx={5} ry={3.4} fill="#f58aa0" opacity={0.55} />
          <ellipse cx={123} cy={73} rx={5} ry={3.4} fill="#f58aa0" opacity={0.55} />
        </g>
        {/* Its collar, and a tag that turns to gold as it is loved. */}
        <path d="M80,88 Q100,97 120,88" fill="none" stroke="#ef4444" strokeWidth={5.5} strokeLinecap="round" />
        <circle cx={100} cy={97} r={4.6} fill={level >= 3 ? '#fbbf24' : '#e5e7eb'} stroke={INK} strokeWidth={1.8} />
      </g>

      {/* The bowl. */}
      {doing === 'eat' && (
        <g className="pt-bowl">
          <path d="M72,122 H128 L122,138 H78 Z" fill="#60a5fa" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          <ellipse cx={100} cy={122} rx={28} ry={5.5} fill="#8b5a2b" stroke={INK} strokeWidth={2.2} />
          <circle cx={90} cy={120} r={3} fill="#a9713b" />
          <circle cx={104} cy={119} r={3.4} fill="#a9713b" />
          <circle cx={113} cy={121} r={2.6} fill="#a9713b" />
        </g>
      )}
      {/* The ball. */}
      {doing === 'play' && (
        <g className="pt-ball">
          <circle cx={30} cy={126} r={9} fill="#facc15" stroke={INK} strokeWidth={2.4} />
          <path d="M22.5,122 Q30,127 37.5,122 M22.5,130 Q30,125 37.5,130" fill="none" stroke="#fff" strokeWidth={1.8} />
        </g>
      )}
      {/* Hearts, when it is stroked or fed. */}
      {(doing === 'stroke' || doing === 'eat') &&
        [
          [72, 34, 0],
          [100, 20, 140],
          [128, 34, 280]
        ].map(([x, y, delay]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <path d={HEART} fill="#f43f5e" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" className="pt-heart" style={{ animationDelay: `${delay}ms` }} />
          </g>
        ))}
      {/* Asleep. */}
      {shut &&
        [
          [136, 34, 1, 0],
          [147, 20, 0.75, 600]
        ].map(([x, y, size, delay]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${size})`}>
            <path d="M0,0 H9 L0,10 H9" {...line} strokeWidth={2.6} className="pt-z" style={{ animationDelay: `${delay}ms` }} />
          </g>
        ))}
      {/* A little cloud over a sulk. */}
      {cross && (
        <g className="pt-cloud">
          <path d="M132,26 a8,8 0 0 1 14,-5 a9,9 0 0 1 16,4 a7,7 0 0 1 -2,14 h-26 a7,7 0 0 1 -2,-13 Z" fill="#9ca3af" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
        </g>
      )}
      {/* Wanting its dinner. */}
      {mood === 'hungry' && !doing && (
        <g className="pt-want" transform="translate(150 30)">
          <circle cx={0} cy={0} r={15} fill="#fff" stroke={INK} strokeWidth={2.2} />
          <path d="M-8,2 h16 l-2,6 h-12 Z" fill="#60a5fa" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <circle cx={-10} cy={18} r={3} fill="#fff" stroke={INK} strokeWidth={1.6} />
        </g>
      )}
    </svg>
  );
};

/**
 * The puppy the two of you look after (core/pet): fed, played with and
 * stroked from either phone. What the other one does for it is seen here as
 * it happens.
 */
export const PetCard: React.FC<PetCardProps> = ({ mine, theirs, partnerName, onHalf }) => {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => loadSounds(['pet-eat', 'pet-bark', 'pet-squeak', 'pet-whine', 'pet-ball']), []);

  const pet = petOf(mine, theirs);
  const mood = moodOf(pet, now, new Date(now).getHours());
  const { level, into, span } = levelOf(pet.care);

  const [doing, setDoing] = useState<Doing>(null);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);
  const show = (what: Exclude<Doing, null>, words?: string) => {
    setDoing(what);
    if (words !== undefined) setNote(words);
    later(DOING_MS[what], () => setDoing(current => (current === what ? null : current)));
    if (words !== undefined) later(3500, () => setNote(current => (current === words ? null : current)));
  };
  const sounds = (what: 'fed' | 'played' | 'stroked') => {
    if (what === 'fed') playSound('pet-eat');
    else if (what === 'played') {
      playSound('pet-ball');
      later(620, () => playSound('pet-bark'));
    } else playSound('pet-squeak');
  };

  // What the other one has just done for it, as it arrives - not what they did before this was opened.
  const theirBefore = useRef(theirs);
  useEffect(() => {
    const before = theirBefore.current;
    theirBefore.current = theirs;
    if (before === theirs || !theirs) return;
    const what = whatChanged(before, theirs);
    if (!what || Date.now() - theirs.at > 20_000) return;
    const name = petOf(mine, theirs).name;
    if (what === 'named') {
      setNote(tr('{who} named it {name}', { who: partnerName, name }));
      later(3500, () => setNote(null));
      return;
    }
    sounds(what);
    show(
      what === 'fed' ? 'eat' : what === 'played' ? 'play' : 'stroke',
      what === 'fed'
        ? tr('{who} fed {name}', { who: partnerName, name })
        : what === 'played'
          ? tr('{who} is playing with {name}', { who: partnerName, name })
          : tr('{who} stroked {name}', { who: partnerName, name })
    );
    // Only when their half changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirs]);

  const busy = doing === 'eat' || doing === 'play';
  const feed = () => {
    if (busy) return;
    getAudioContext();
    if (!willEat(pet, Date.now())) {
      haptic('reject');
      playSound('pet-squeak', { rate: 0.8 });
      show('full', tr('{name} is full for now', { name: pet.name }));
      return;
    }
    haptic('confirm');
    onHalf(fed(mine, Date.now()));
    sounds('fed');
    show('eat');
  };
  const play = () => {
    if (busy) return;
    getAudioContext();
    haptic('confirm');
    onHalf(played(mine, Date.now()));
    sounds('played');
    show('play');
  };
  const stroke = () => {
    if (busy) return;
    getAudioContext();
    haptic('tick');
    const t = Date.now();
    // Every stroke is enjoyed; it is kept and sent only when it counts, or it would be a record a tap.
    if (!mine || mine.strokedAt === 0 || t - mine.strokedAt >= STROKE_COUNTS_EVERY_MS) onHalf(stroked(mine, t));
    if (mood === 'hungry' || mood === 'sulking') playSound('pet-whine');
    else playSound('pet-squeak', { rate: mood === 'asleep' ? 0.8 : 1 });
    show('stroke');
  };

  const [naming, setNaming] = useState<string | null>(null);
  const saveName = () => {
    const half = naming === null ? null : named(mine, naming, Date.now());
    setNaming(null);
    if (half && half.name !== pet.name) {
      onHalf(half);
      haptic('confirm');
    }
  };

  const says =
    note ??
    (mood === 'new'
      ? tr('This is {name}. Say hello!', { name: pet.name })
      : mood === 'happy'
        ? tr('{name} is happy', { name: pet.name })
        : mood === 'hungry'
          ? tr('{name} is hungry', { name: pet.name })
          : mood === 'bored'
            ? tr('{name} wants to play', { name: pet.name })
            : mood === 'sulking'
              ? tr('{name} is sulking. Cheer it up!', { name: pet.name })
              : mood === 'asleep'
                ? tr('{name} is asleep', { name: pet.name })
                : tr('{name} is fine', { name: pet.name }));

  return (
    <div className="pt-card rounded-3xl border border-linen-border bg-linen-surface p-4 sm:p-5 shadow-xs">
      <div className="pt-top">
        {naming === null ? (
          <button type="button" className="pt-name" onClick={() => setNaming(pet.name)} aria-label={tr('Change its name')}>
            <span>{pet.name}</span>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <form
            className="pt-naming"
            onSubmit={e => {
              e.preventDefault();
              saveName();
            }}
          >
            <input value={naming} maxLength={16} autoFocus onChange={e => setNaming(e.target.value)} aria-label={tr('Its name')} />
            <button type="submit" aria-label={tr('Save')}>
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        )}
        <span className="pt-level" aria-label={tr('Level {n}', { n: level })}>
          <b>{tr('Level {n}', { n: level })}</b>
          <span className="pt-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((into / span) * 100)}%` }} />
          </span>
        </span>
      </div>

      <button type="button" className="pt-stage" onClick={stroke} aria-label={tr('Stroke {name}', { name: pet.name })}>
        <PetArt mood={mood} doing={doing} level={level} />
      </button>

      <p className="pt-says" aria-live="polite">
        {says}
      </p>

      <div className="pt-keys">
        <button type="button" className="pt-key" onClick={feed} disabled={busy}>
          <span aria-hidden="true">🍖</span>
          {tr('Feed')}
        </button>
        <button type="button" className="pt-key" onClick={play} disabled={busy}>
          <span aria-hidden="true">🎾</span>
          {tr('Play')}
        </button>
      </div>
    </div>
  );
};
